/**
 * generate-icebreaker Edge Function
 *
 * Generates a one-time, personalised conversation-starter for a new match
 * and persists it to user_matches.icebreaker_text (columns have existed
 * since the baseline schema, but nothing populated them until now).
 *
 * Called fire-and-forget from the client right after record_swipe reports
 * matched:true (see discover.tsx) -- never awaited on the swipe hot path.
 * Idempotent: a match that already has icebreaker_text short-circuits
 * without calling Gemini again, so it's safe to invoke more than once.
 *
 * Required Edge Function secret: GEMINI_API_KEY (already provisioned --
 * shared with optimize-prompt).
 *
 * Request body: { match_id: string }
 * verify_jwt defaults to true (not listed in config.toml), so only requests
 * with a valid Supabase user JWT reach this code. That JWT's user must be
 * one of the two people on the match -- checked manually below since the
 * DB reads/writes here use the service role client (needed to read both
 * users' astro_details, which are owner-only under RLS).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_MODEL = "gemini-flash-latest";

// Shown when Gemini is unavailable or the daily quota is spent. Intentionally
// astrological so they always feel on-brand.
const STATIC_FALLBACKS = [
  "Your charts crossed paths for a reason ✨ — what's been the most unexpected thing to happen to you this year?",
  "The stars lined you two up — so tell me, are you more of a sunrise or sunset person? 🌅",
  "Mercury might have something to say about this match 😄 — what's the last thing that genuinely made you laugh out loud?",
  "Your Moon signs are doing all the talking 🌙 — what's something you've been quietly passionate about lately?",
  "Venus says hi 💫 — if you could have dinner anywhere in the world tonight, where would you pick?",
  "The cosmos doesn't do accidents ☄️ — what's one thing on your bucket list you've never told anyone about?",
  "With energy like yours, the universe had to introduce us 🔮 — coffee or tea, and why does it say so much about a person?",
];

function pickFallback(): string {
  return STATIC_FALLBACKS[Math.floor(Math.random() * STATIC_FALLBACKS.length)];
}

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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !geminiApiKey) {
    return json({ success: false, error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }
  const userId = authData.user.id;

  let body: { match_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const matchId = (body.match_id ?? "").trim();
  if (!matchId) {
    return json({ success: false, error: "match_id is required" }, 400);
  }

  // Service role -- needed below to read both users' astro_details, which
  // are owner-only under RLS (a regular client can only ever see its own
  // side of the pair).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: match, error: matchError } = await adminClient
    .from("user_matches")
    .select("id, user1_id, user2_id, icebreaker_text")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError || !match) {
    return json({ success: false, error: "match_not_found" }, 404);
  }

  if (match.user1_id !== userId && match.user2_id !== userId) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  // Idempotent -- if a previous call already succeeded, don't spend another
  // Gemini call or quota unit.
  if (match.icebreaker_text) {
    return json({ success: true, icebreaker: match.icebreaker_text });
  }

  // Per-user daily cap, same generic limiter optimize-prompt-adjacent
  // features use. Quota exhaustion falls back to a static line rather than
  // failing the request -- the chat screen should never be left with no
  // icebreaker just because Gemini calls ran out for the day.
  let useGemini = true;
  const { data: allowed, error: quotaError } = await adminClient.rpc(
    "increment_ai_usage",
    { p_user: userId, p_endpoint: "generate-icebreaker", p_limit: 30 },
  );
  if (quotaError) {
    console.error("[generate-icebreaker] quota RPC error", quotaError);
    useGemini = false;
  } else if (!allowed) {
    useGemini = false;
  }

  let icebreakerText: string | null = null;

  if (useGemini) {
    try {
      const [aRes, bRes] = await Promise.all([
        adminClient
          .from("astro_details")
          .select("western_sign, indian_sign, venus_sign")
          .eq("user_id", match.user1_id)
          .maybeSingle(),
        adminClient
          .from("astro_details")
          .select("western_sign, indian_sign, venus_sign")
          .eq("user_id", match.user2_id)
          .maybeSingle(),
      ]);

      const a = aRes.data;
      const b = bRes.data;

      const astroContext =
        a && b
          ? `User A: Sun in ${a.western_sign ?? "?"}, Moon in ${a.indian_sign ?? "?"}, Venus in ${a.venus_sign ?? "?"}. ` +
            `User B: Sun in ${b.western_sign ?? "?"}, Moon in ${b.indian_sign ?? "?"}, Venus in ${b.venus_sign ?? "?"}.`
          : "Astro details not yet available for this pair.";

      const instruction =
        "You are AstroDate's cosmic matchmaker. Generate ONE short, warm, and playful " +
        "icebreaker question (max 30 words) for two people who just matched on an " +
        "astrology dating app. Make it feel personal by weaving in their astrological " +
        "signs naturally -- do not just list signs, use them to set up the question. " +
        `Context: ${astroContext} ` +
        "Respond with only the icebreaker question and nothing else.";

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: instruction }] },
            contents: [{ parts: [{ text: "Generate the icebreaker now." }] }],
          }),
        },
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const rawText: string | undefined =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText && rawText.trim().length > 0) {
          icebreakerText = rawText.trim().replace(/^["']|["']$/g, "").slice(0, 300);
        }
      } else {
        const errBody = await geminiRes.text().catch(() => "");
        console.error("[generate-icebreaker] Gemini API error", geminiRes.status, errBody);
      }
    } catch (geminiErr) {
      console.warn("[generate-icebreaker] Gemini call failed, using static fallback:", geminiErr);
    }
  }

  if (!icebreakerText) {
    icebreakerText = pickFallback();
  }

  const { error: saveError } = await adminClient
    .from("user_matches")
    .update({
      icebreaker_text: icebreakerText,
      icebreaker_generated_at: new Date().toISOString(),
    })
    .eq("id", matchId)
    .is("icebreaker_text", null); // don't clobber a concurrent successful write

  if (saveError) {
    console.error("[generate-icebreaker] failed to save icebreaker:", saveError);
    return json({ success: false, error: "save_failed" }, 500);
  }

  return json({ success: true, icebreaker: icebreakerText });
});
