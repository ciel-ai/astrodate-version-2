/**
 * optimize-prompt Edge Function
 *
 * Polishes a user's dating-profile prompt answer using Gemini. Backs the
 * "AI Optimizer" copy on finish-ques.tsx, which previously had no feature
 * behind it at all.
 *
 * Required Edge Function secret: GEMINI_API_KEY
 *
 * Request body: { question: string, answer: string }
 * verify_jwt defaults to true for this function (not listed in config.toml),
 * so only requests with a valid Supabase user JWT ever reach this code.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// An alias, not a pinned version -- Google repoints this at whatever their
// current flash model is, so this doesn't need updating every time a
// specific version gets deprecated (which is what broke this the first time).
const GEMINI_MODEL = "gemini-flash-latest";
const MAX_ANSWER_LEN = 300; // matches prompt-editor-form.tsx's TextInput maxLength

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!supabaseUrl || !anonKey || !geminiApiKey) {
    return json({ success: false, error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // Client scoped to the caller's own JWT -- auth.uid() inside the RPC
  // resolves to this user, and consume_prompt_optimize's self-only guard
  // means this can only ever spend the caller's own quota.
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }
  const userId = authData.user.id;

  let body: { question?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const question = (body.question ?? "").trim();
  const answer = (body.answer ?? "").trim();
  if (!answer) {
    return json({ success: false, error: "answer is required" }, 400);
  }

  // Check (don't yet consume) quota so a Gemini failure below never costs the
  // user one of their daily optimizes -- consume_prompt_optimize only runs
  // after Gemini actually returns something usable.
  const { data: remaining, error: quotaError } = await authClient.rpc(
    "get_prompt_optimize_remaining",
    { p_user_id: userId },
  );
  if (quotaError) {
    console.error("[optimize-prompt] quota RPC error", quotaError);
    return json({ success: false, error: "quota_check_failed" }, 500);
  }
  if (typeof remaining === "number" && remaining <= 0) {
    return json({ success: false, error: "quota_exceeded" }, 429);
  }

  const instruction =
    `You are helping a user polish a short dating-profile prompt answer for the ` +
    `AstroDate app. Given the prompt question and the user's draft answer, ` +
    `rewrite the answer to be clearer, more engaging, and authentic. Preserve ` +
    `the original meaning and any personal details -- do not invent new facts. ` +
    `Keep it concise: no more than ${MAX_ANSWER_LEN} characters. Return ONLY the ` +
    `rewritten answer text, with no quotation marks, labels, or commentary.`;

  const userContent = question
    ? `Prompt question: "${question}"\nDraft answer: "${answer}"`
    : `Draft answer: "${answer}"`;

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ parts: [{ text: userContent }] }],
      }),
    },
  );

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text().catch(() => "");
    console.error("[optimize-prompt] Gemini API error", geminiRes.status, errBody);
    return json({ success: false, error: "ai_api_error" }, 502);
  }

  const geminiData = await geminiRes.json();
  const rawText: string | undefined =
    geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText || !rawText.trim()) {
    return json({ success: false, error: "empty_ai_response" }, 502);
  }

  const optimized = rawText.trim().replace(/^["']|["']$/g, "").slice(0, MAX_ANSWER_LEN);

  // Only spend the quota once Gemini actually produced something usable. A
  // failure here shouldn't block returning the result the user already got.
  const { error: consumeError } = await authClient.rpc("consume_prompt_optimize", { p_user_id: userId });
  if (consumeError) {
    console.error("[optimize-prompt] failed to record quota usage", consumeError);
  }

  return json({ success: true, optimized });
});
