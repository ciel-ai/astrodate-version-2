/**
 * moderate-chat-media Edge Function
 *
 * The real fix for the C2 finding in the 2026-07-28 pre-launch audit (see
 * 20260728120000_close_match_like_forgery_and_media_ownership.sql, which only
 * shipped a stop-gap: proving media_url belongs to the sender's own storage
 * folder). That stop-gap closed the arbitrary-external-URL injection hole but
 * ran zero content classification on chat images/audio -- unlike profile
 * photos (moderate-photo) and chat text (moderate-message), chat media was
 * the one surface on the app with no moderation at all.
 *
 * Classifies a just-uploaded chat image or voice note with Gemini and inserts
 * the `messages` row itself (service role), same shape as moderate-message:
 * the two steps can't be split apart by a caller hitting the REST API
 * directly with a forged moderation_status. This supersedes direct-client
 * inserts for media entirely -- see the migration shipped alongside this
 * function, which removes the `messages` INSERT policy altogether (text
 * already went server-side in 20260723120000; this closes the last direct
 * client-insert path).
 *
 * Reuses the same four-category taxonomy as moderate-message (SAFE / SPAM /
 * HARASSMENT / ILLEGAL) rather than moderate-photo's binary SAFE/UNSAFE --
 * the `messages.moderation_status` column's CHECK constraint only allows
 * those four values, and only ILLEGAL blocks the insert; SPAM/HARASSMENT
 * still get delivered but flagged (message-bubble.tsx already renders a
 * "flagged during review" note for either, so no client UI change needed).
 *
 * Fails open to SAFE on any moderation error/misconfiguration (missing key,
 * upstream error/timeout, malformed response) -- same policy as
 * moderate-message/moderate-photo, logged to moderation_outages.
 *
 * Required Edge Function secret: GEMINI_API_KEY (already provisioned).
 * Request body: { id, channelId, receiverId, storagePath, mediaKind: 'image'|'audio', durationMs? }
 * Response: { success: true, mediaUrl, moderationStatus } | { success: false, blocked, reason }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";

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
    console.error("moderate-chat-media: failed to log moderation outage", err);
  }
}

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type ModerationStatus = "SAFE" | "SPAM" | "HARASSMENT" | "ILLEGAL";
const VALID_STATUSES = new Set<ModerationStatus>(["SAFE", "SPAM", "HARASSMENT", "ILLEGAL"]);

const IMAGE_SYSTEM_PROMPT = `You are a content moderation classifier for chat photos on a dating app.
Classify the image into exactly ONE of these four categories:

SAFE        - A normal photo: a person, people, a scene, an object, a sticker, artwork, etc.
SPAM        - Advertisements, screenshots pushing the recipient to another app/contact/service, or promotional watermarked images.
HARASSMENT  - Nudity, sexually explicit content, graphic violence, hate symbols, or unwanted explicit content.
ILLEGAL     - Anything depicting or facilitating illegal activity (CSAM, drugs/weapons for sale, etc.)

Rules:
- Respond with ONLY the single category word. No explanation, no punctuation, no extra text.
- When unsure, prefer SAFE -- this classifier exists to catch clearly explicit/illegal images, not to police borderline fashion or beach photos.`;

const AUDIO_SYSTEM_PROMPT = `You are a content moderation classifier for voice messages on a dating app.
Listen to the audio and classify its content into exactly ONE of these four categories:

SAFE        - Normal conversation, greetings, questions, compliments, general chat, singing, ambient noise.
SPAM        - Advertisements, solicitations, or pushing the recipient to contact them on another app/service.
HARASSMENT  - Insults, threats, sexual harassment, hate speech, bullying, or explicit sexual content.
ILLEGAL     - Content facilitating or describing illegal activity (drug dealing, violence solicitation, fraud, etc.)

Rules:
- Respond with ONLY the single category word. No explanation, no punctuation, no extra text.
- When in doubt between SAFE and SPAM, return SPAM.
- When in doubt between HARASSMENT and ILLEGAL, return HARASSMENT.`;

export async function classifyChatMedia(
  // deno-lint-ignore no-explicit-any
  serviceClient: any,
  mediaKind: "image" | "audio",
  bytes: Uint8Array,
  contentType: string,
): Promise<{ status: ModerationStatus }> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiApiKey) {
    console.error("moderate-chat-media: GEMINI_API_KEY is not set -- failing open to SAFE");
    await logModerationOutage(serviceClient, "missing_api_key");
    return { status: "SAFE" };
  }

  try {
    const geminiPayload = {
      system_instruction: {
        parts: [{ text: mediaKind === "image" ? IMAGE_SYSTEM_PROMPT : AUDIO_SYSTEM_PROMPT }],
      },
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: contentType, data: encodeBase64(bytes) } },
            { text: mediaKind === "image" ? "Classify this chat photo." : "Classify this voice message." },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 10, temperature: 0 },
    };

    const geminiRes = await fetchWithTimeout(
      `${GEMINI_API_URL}?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(geminiPayload),
      },
      12000,
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("moderate-chat-media: Gemini API error", geminiRes.status, errText);
      await logModerationOutage(serviceClient, "gemini_api_error", `status=${geminiRes.status} body=${errText.slice(0, 500)}`);
      return { status: "SAFE" };
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const classification = rawText.trim().toUpperCase() as ModerationStatus;
    const status: ModerationStatus = VALID_STATUSES.has(classification) ? classification : "SAFE";

    console.log(`moderate-chat-media: ${mediaKind} -> ${status}`);
    return { status };
  } catch (err) {
    console.error("moderate-chat-media: exception, failing open to SAFE", err);
    await logModerationOutage(serviceClient, "exception", err instanceof Error ? err.message : String(err));
    return { status: "SAFE" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ success: false, error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  const authClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }
  const senderId = authData.user.id;

  let body: {
    id?: string;
    channelId?: string;
    receiverId?: string;
    storagePath?: string;
    mediaKind?: "image" | "audio";
    durationMs?: number;
  };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const { id, channelId, receiverId, storagePath, mediaKind, durationMs } = body;
  if (!id || !channelId || !receiverId || !storagePath || (mediaKind !== "image" && mediaKind !== "audio")) {
    return json(
      { success: false, error: "id, channelId, receiverId, storagePath, and mediaKind ('image'|'audio') are required" },
      400,
    );
  }

  // The client always uploads to `${user.id}/...` (see sendMediaMessage in
  // src/lib/chats.ts) -- reject anything else outright rather than letting a
  // caller point this at another user's storage object.
  if (!storagePath.startsWith(`${senderId}/`)) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Mirror the messages table's (former) RLS INSERT policy: an active match
  // between sender and receiver on this channel, and no block in either
  // direction. Required here because this insert runs as service_role, which
  // bypasses RLS entirely.
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

  const { data: fileBlob, error: downloadError } = await serviceClient.storage
    .from("messages")
    .download(storagePath);

  if (downloadError || !fileBlob) {
    console.error("moderate-chat-media: download failed", downloadError);
    return json({ success: false, error: "download_failed" }, 500);
  }

  const contentType = fileBlob.type || (mediaKind === "image" ? "image/jpeg" : "audio/mp4");
  const mediaBytes = new Uint8Array(await fileBlob.arrayBuffer());

  const { status: moderationStatus } = await classifyChatMedia(serviceClient, mediaKind, mediaBytes, contentType);

  if (moderationStatus === "ILLEGAL") {
    // No message row is ever created for blocked media -- clean up the
    // storage object too, rather than leaving an orphaned file with nothing
    // pointing at it (same reasoning moderate-photo uses for rejected profile
    // photos).
    await serviceClient.storage.from("messages").remove([storagePath]).catch(() => {});
    return json({
      success: false,
      blocked: true,
      reason: "This content violates community guidelines and cannot be sent.",
    });
  }

  const { data: { publicUrl } } = serviceClient.storage.from("messages").getPublicUrl(storagePath);

  const { error: insertError } = await serviceClient.from("messages").insert({
    id,
    sender_id: senderId,
    receiver_id: receiverId,
    channel_id: channelId,
    message_type: mediaKind,
    media_url: publicUrl,
    media_duration_ms: durationMs ?? null,
    moderation_status: moderationStatus,
  });

  if (insertError) {
    // Row insert failed after the object was already uploaded -- remove the
    // orphan rather than leaving a storage object nothing points at.
    await serviceClient.storage.from("messages").remove([storagePath]).catch(() => {});
    console.error("moderate-chat-media: insert failed", insertError);
    return json({ success: false, blocked: false, reason: insertError.message }, 500);
  }

  return json({ success: true, mediaUrl: publicUrl, moderationStatus });
});
