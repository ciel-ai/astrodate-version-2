/**
 * moderate-message Edge Function
 *
 * Classifies a chat TEXT message with Gemini and inserts it, so the two steps
 * can never be split apart by a caller hitting the REST API directly with a
 * forged moderation_status. Previously this function only returned a status
 * and trusted the client to insert the row itself with that status attached
 * -- nothing stopped a modified/direct-API client from inserting with
 * moderation_status: 'SAFE' regardless of what Gemini would have said. Media
 * messages (image/audio) are unaffected by this change -- there's no text to
 * classify, so they still insert directly from the client (see
 * 20260723120000_require_server_side_text_moderation.sql, which restricts the
 * messages INSERT policy's direct-client path to message_type <> 'text').
 *
 * Fails open to SAFE on any moderation error/misconfiguration (missing key,
 * upstream error, malformed response) -- a moderation outage must never
 * silently block every message in the app. Match/block checks below mirror
 * the messages table's RLS INSERT policy exactly, since this function uses
 * the service role (which bypasses RLS) to perform the insert.
 *
 * Required Edge Function secret: GEMINI_API_KEY
 * Request body: { id: string, channelId: string, receiverId: string, messageText: string }
 * Response: { success: true, moderationStatus } | { success: false, blocked: boolean, reason: string }
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
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  reason: string,
  detail?: string,
): Promise<void> {
  try {
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

async function classifyMessage(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  messageText: string,
): Promise<{ status: ModerationStatus; warning?: string }> {
  if (messageText.trim().length === 0) {
    return { status: "SAFE" };
  }

  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    console.error("moderate-message: GEMINI_API_KEY is not set -- failing open to SAFE");
    await logModerationOutage(serviceClient, "missing_api_key");
    return { status: "SAFE", warning: "Moderation service unavailable" };
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
      await logModerationOutage(serviceClient, "gemini_api_error", `status=${geminiRes.status} body=${errText.slice(0, 500)}`);
      return { status: "SAFE", warning: "Moderation service error" };
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const classification = rawText.trim().toUpperCase() as ModerationStatus;
    const status: ModerationStatus = VALID_STATUSES.has(classification) ? classification : "SAFE";

    console.log(`moderate-message: "${messageText.slice(0, 40)}..." -> ${status}`);
    return { status };
  } catch (err) {
    console.error("moderate-message: exception, failing open to SAFE", err);
    await logModerationOutage(serviceClient, "exception", err instanceof Error ? err.message : String(err));
    return { status: "SAFE", warning: "Moderation service error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

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
  const senderId = authData.user.id;

  let body: { id?: string; channelId?: string; receiverId?: string; messageText?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { id, channelId, receiverId, messageText } = body;
  if (!id || !channelId || !receiverId || typeof messageText !== "string") {
    return json({ error: "id, channelId, receiverId, and messageText are required" }, 400);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Mirror the messages table's RLS INSERT policy: an active match between
  // sender and receiver on this channel, and no block in either direction.
  // Required here because this insert runs as service_role, which bypasses
  // RLS entirely.
  const { data: matchRow } = await serviceClient
    .from("user_matches")
    .select("channel_id")
    .eq("channel_id", channelId)
    .or(
      `and(user1_id.eq.${senderId},user2_id.eq.${receiverId}),and(user1_id.eq.${receiverId},user2_id.eq.${senderId})`,
    )
    .maybeSingle();
  if (!matchRow) {
    return json({ success: false, blocked: false, reason: "Not matched with this user" }, 403);
  }

  const { data: blockRow } = await serviceClient
    .from("block_users")
    .select("blocker_id")
    .or(
      `and(blocker_id.eq.${senderId},blocked_id.eq.${receiverId}),and(blocker_id.eq.${receiverId},blocked_id.eq.${senderId})`,
    )
    .maybeSingle();
  if (blockRow) {
    return json({ success: false, blocked: false, reason: "Cannot message a blocked user" }, 403);
  }

  const { status: moderationStatus } = await classifyMessage(serviceClient, messageText);

  if (moderationStatus === "ILLEGAL") {
    return json({
      success: false,
      blocked: true,
      reason: "Message violates community guidelines and cannot be sent.",
    });
  }

  const { error: insertError } = await serviceClient.from("messages").insert({
    id,
    sender_id: senderId,
    receiver_id: receiverId,
    message_text: messageText,
    channel_id: channelId,
    message_type: "text",
    moderation_status: moderationStatus,
  });

  if (insertError) {
    console.error("moderate-message: insert failed", insertError);
    const isDbBlocked = insertError.message?.includes("Message blocked");
    return json({
      success: false,
      blocked: isDbBlocked,
      reason: isDbBlocked ? "Message violates community guidelines." : insertError.message,
    });
  }

  return json({ success: true, moderationStatus });
});
