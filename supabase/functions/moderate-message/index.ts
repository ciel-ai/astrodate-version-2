/**
 * moderate-message Edge Function
 *
 * Classifies a chat message with Gemini before it's stored, so the Chats
 * feature never ships unmoderated. Ported from the legacy reference project
 * (D:\ciel-project\Astrodate\supabase\functions\moderate-message), adapted to
 * this project's conventions (jsr: imports, shared corsHeaders/json() shape
 * matching compute-synastry/index.ts).
 *
 * Fails open to SAFE on any error/misconfiguration (missing key, upstream
 * error, malformed response) -- a moderation outage must never silently
 * block every message in the app.
 *
 * Required Edge Function secret: GEMINI_API_KEY
 * Request body: { messageText: string }
 * Response: { status: 'SAFE' | 'SPAM' | 'HARASSMENT' | 'ILLEGAL', warning?: string }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Best-effort outage record so a Gemini failure is visible instead of only
// discoverable by grepping function logs. Never allowed to affect the
// response -- moderation must still fail open to SAFE even if this write
// itself fails (e.g. table momentarily unreachable).
async function logModerationOutage(
  supabaseUrl: string,
  serviceKey: string,
  reason: string,
  detail?: string,
): Promise<void> {
  try {
    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    await serviceClient.from("moderation_outages").insert({ reason, detail });
  } catch (err) {
    console.error("moderate-message: failed to log moderation outage", err);
  }
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a content moderation classifier for a dating app.
Classify the user's message into exactly ONE of these four categories:

SAFE        - Normal conversation, greetings, questions, compliments, general chat.
SPAM        - Promotional content, links, solicitations, repeated identical messages, advertisements.
HARASSMENT  - Insults, threats, sexual harassment, hate speech, bullying, unwanted explicit content.
ILLEGAL     - Content facilitating or describing illegal activities (drug dealing, violence solicitation, CSAM, fraud, etc.)

Rules:
- Respond with ONLY the single category word. No explanation, no punctuation, no extra text.
- When in doubt between SAFE and SPAM, return SPAM.
- When in doubt between HARASSMENT and ILLEGAL, return HARASSMENT.
- Short messages like "hi", "hello", "how are you" are always SAFE.
- Mildly flirtatious language is SAFE unless it becomes explicitly sexual or threatening.`;

type ModerationStatus = "SAFE" | "SPAM" | "HARASSMENT" | "ILLEGAL";
const VALID_STATUSES = new Set<ModerationStatus>(["SAFE", "SPAM", "HARASSMENT", "ILLEGAL"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  // Require a real authenticated caller -- moderation is only ever invoked
  // as part of the authenticated send-message flow, never anonymously.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  const authClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { messageText?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const messageText = body.messageText;
  if (!messageText || typeof messageText !== "string") {
    return json({ error: "messageText is required and must be a string" }, 400);
  }

  // Trivially SAFE -- skip the API call entirely.
  if (messageText.trim().length === 0) {
    return json({ status: "SAFE" });
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    console.error("moderate-message: GEMINI_API_KEY is not set -- failing open to SAFE");
    await logModerationOutage(supabaseUrl, serviceKey, "missing_api_key");
    return json({ status: "SAFE", warning: "Moderation service unavailable" });
  }

  try {
    const geminiPayload = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: messageText }] }],
      generationConfig: { maxOutputTokens: 10, temperature: 0 },
    };

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("moderate-message: Gemini API error", geminiRes.status, errText);
      await logModerationOutage(supabaseUrl, serviceKey, "gemini_api_error", `status=${geminiRes.status} body=${errText.slice(0, 500)}`);
      return json({ status: "SAFE", warning: "Moderation service error" });
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const classification = rawText.trim().toUpperCase() as ModerationStatus;
    const status: ModerationStatus = VALID_STATUSES.has(classification) ? classification : "SAFE";

    console.log(`moderate-message: "${messageText.slice(0, 40)}..." -> ${status}`);
    return json({ status });
  } catch (err) {
    console.error("moderate-message: exception, failing open to SAFE", err);
    await logModerationOutage(supabaseUrl, serviceKey, "exception", err instanceof Error ? err.message : String(err));
    return json({ status: "SAFE", warning: "Moderation service error" });
  }
});
