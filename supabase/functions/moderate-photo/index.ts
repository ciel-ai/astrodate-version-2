/**
 * moderate-photo Edge Function
 *
 * Classifies a just-uploaded profile photo with Gemini vision and inserts
 * the user_photos row itself, so the two steps can never be split apart by a
 * caller hitting the REST API directly -- same reasoning and shape as
 * moderate-message (20260723120000_require_server_side_text_moderation.sql),
 * applied to photos instead of chat text. Before this, uploaded photos had
 * zero content moderation at all: chat messages were classified, profile
 * photos -- arguably the higher-risk surface on a dating app -- were not.
 * user_photos' INSERT is now service_role-only (see the migration that ships
 * alongside this function), so a client can no longer add a row without
 * going through this classification gate.
 *
 * Fails open to SAFE on any moderation error/misconfiguration (missing key,
 * upstream error, malformed response, unreadable image) -- a moderation
 * outage must never silently block every photo upload in the app. Logged to
 * moderation_outages (same table moderate-message already uses) so an outage
 * is visible instead of only discoverable by grepping function logs.
 *
 * Required Edge Function secret: GEMINI_API_KEY (already provisioned --
 * shared with moderate-message/generate-icebreaker/optimize-prompt).
 * Request body: { storage_path: string, display_order: number, is_primary: boolean }
 * Response: { success: true, photo: {...} } | { success: false, blocked: boolean, reason: string }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

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

// deno-lint-ignore no-explicit-any
async function logModerationOutage(serviceClient: any, reason: string, detail?: string): Promise<void> {
  try {
    await serviceClient.from("moderation_outages").insert({ reason, detail });
  } catch (err) {
    console.error("moderate-photo: failed to log moderation outage", err);
  }
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Deliberately narrower than moderate-message's four categories -- a profile
// photo doesn't have "spam", and unlike chat text (where mild flirtation is
// fine), a dating app's profile photos need to just be presentable. UNSAFE
// covers nudity/explicit sexual content, graphic violence, hate symbols, and
// anything illegal (CSAM, weapons for sale, drugs, etc.).
const SYSTEM_PROMPT = `You are a content moderation classifier for profile photos on a dating app.
Classify the image into exactly ONE of these two categories:

SAFE   - A normal profile photo: a person, people, a scene, an object, artwork, etc. with nothing explicit or illegal.
UNSAFE - Nudity, sexually explicit content, graphic violence, hate symbols, weapons displayed as a threat, or anything depicting illegal activity (drugs, CSAM, etc.).

Rules:
- Respond with ONLY the single category word. No explanation, no punctuation, no extra text.
- When unsure, prefer SAFE -- this classifier exists to catch clearly explicit/illegal images, not to police borderline fashion or beach photos.`;

type ModerationStatus = "SAFE" | "UNSAFE";

async function classifyPhoto(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  imageBytes: Uint8Array,
  contentType: string,
): Promise<{ status: ModerationStatus }> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    console.error("moderate-photo: GEMINI_API_KEY is not set -- failing open to SAFE");
    await logModerationOutage(serviceClient, "missing_api_key");
    return { status: "SAFE" };
  }

  try {
    const geminiPayload = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: contentType, data: encodeBase64(imageBytes) } },
            { text: "Classify this profile photo." },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 10, temperature: 0 },
    };

    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("moderate-photo: Gemini API error", geminiRes.status, errText);
      await logModerationOutage(serviceClient, "gemini_api_error", `status=${geminiRes.status} body=${errText.slice(0, 500)}`);
      return { status: "SAFE" };
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const classification = rawText.trim().toUpperCase();
    const status: ModerationStatus = classification === "UNSAFE" ? "UNSAFE" : "SAFE";

    console.log(`moderate-photo: classified as ${status}`);
    return { status };
  } catch (err) {
    console.error("moderate-photo: exception, failing open to SAFE", err);
    await logModerationOutage(serviceClient, "exception", err instanceof Error ? err.message : String(err));
    return { status: "SAFE" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceKey) {
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

  let body: { storage_path?: string; display_order?: number; is_primary?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { storage_path: storagePath, display_order: displayOrder, is_primary: isPrimary } = body;
  if (!storagePath || typeof displayOrder !== "number" || typeof isPrimary !== "boolean") {
    return json({ success: false, error: "storage_path, display_order, and is_primary are required" }, 400);
  }

  // The client always uploads to `${user.id}/...` (see uploadUserPhoto in
  // src/lib/user-photos.ts) -- reject anything else outright rather than
  // letting a caller point this at another user's storage path.
  if (!storagePath.startsWith(`${userId}/`)) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data: fileBlob, error: downloadError } = await serviceClient.storage
    .from("user-photos")
    .download(storagePath);

  if (downloadError || !fileBlob) {
    console.error("moderate-photo: download failed", downloadError);
    return json({ success: false, error: "download_failed" }, 500);
  }

  const contentType = fileBlob.type || "image/jpeg";
  const imageBytes = new Uint8Array(await fileBlob.arrayBuffer());

  const { status: moderationStatus } = await classifyPhoto(serviceClient, imageBytes, contentType);

  if (moderationStatus === "UNSAFE") {
    // No DB row is ever created for a rejected photo -- clean up the storage
    // object too, rather than leaving an orphaned file with nothing pointing
    // at it (same reasoning uploadUserPhoto already uses for its own
    // failure path when the DB insert errors after a successful upload).
    await serviceClient.storage.from("user-photos").remove([storagePath]).catch(() => {});
    return json({
      success: false,
      blocked: true,
      reason: "This photo doesn't meet our community guidelines. Please choose a different photo.",
    });
  }

  const { data: { publicUrl } } = serviceClient.storage.from("user-photos").getPublicUrl(storagePath);

  const { data: inserted, error: insertError } = await serviceClient
    .from("user_photos")
    .insert({
      user_id: userId,
      photo_url: publicUrl,
      storage_path: storagePath,
      display_order: displayOrder,
      is_primary: isPrimary,
    })
    .select()
    .single();

  if (insertError) {
    console.error("moderate-photo: insert failed", insertError);
    return json({ success: false, blocked: false, reason: insertError.message }, 500);
  }

  return json({ success: true, photo: inserted });
});
