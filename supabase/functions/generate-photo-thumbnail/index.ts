/**
 * generate-photo-thumbnail Edge Function
 *
 * Generates a privacy-safe blurred thumbnail for one of the caller's own
 * photos and persists it to user_photos.blurred_thumbnail_url (column added
 * by 20260724130000_add_blurred_thumbnail_url.sql -- nothing populated it
 * before this).
 *
 * Used to give locked "who liked me" cards (see_who_likes_you gating,
 * get_who_liked_me()) something better than a flat gray placeholder: a
 * genuinely blurred copy of the person's real primary photo, same pattern
 * Tinder/Bumble/Hinge use.
 *
 * SECURITY: the `user-photos` storage bucket is PUBLIC
 * (20260710120000_make_user_photos_bucket_public.sql), so the blurred image
 * MUST be a separate, re-encoded file that has actually had its resolution
 * destroyed before blurring -- never a CSS filter or a `?blur=` query param
 * on the original's existing public URL, which anyone could strip to load
 * the unblurred original. Pipeline here: downsample to ~24px wide (destroys
 * the information a blur-only pass could partially leave recoverable), blur
 * at that tiny scale, then scale back up to display size, then re-encode as
 * a brand new JPEG at a distinct storage path.
 *
 * Image processing: magick-wasm (npm:@imagemagick/magick-wasm), Supabase's
 * own documented approach for image manipulation in Edge Functions --
 * Sharp and other native-binding libraries aren't supported there, only
 * WASM ones. See https://supabase.com/docs/guides/functions/examples/image-manipulation.
 *
 * Called two ways:
 *   - Fire-and-forget from the client (src/lib/user-photos.ts) right after a
 *     photo becomes primary (upload of the first photo, or setPrimaryPhoto)
 *     -- a real user JWT, whose owner must match the photo row.
 *   - The one-off backfill script (scripts/backfill-photo-thumbnails.ts) for
 *     existing users whose primary photo predates this feature -- trusted by
 *     presenting the project's own service-role key as the bearer token
 *     (the same trust tier this function's own admin client already has),
 *     not a separate worker secret/Vault entry that would only ever be used
 *     for this one-time sweep.
 *
 * Idempotent: a photo that already has blurred_thumbnail_url short-circuits
 * without redoing the image work, same convention generate-icebreaker uses
 * for icebreaker_text.
 *
 * Request body: { photo_id: string }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { ImageMagick, initializeImageMagick, MagickFormat } from "npm:@imagemagick/magick-wasm@^0";

const wasmBytes = await Deno.readFile(
  new URL("magick.wasm", import.meta.resolve("npm:@imagemagick/magick-wasm@^0")),
);
await initializeImageMagick(wasmBytes);

const TINY_DIMENSION = 24;
const DISPLAY_DIMENSION = 400;
// The 24px resize is what actually destroys recognizable detail (the safety
// mechanism); this blur pass only needs to smooth the blocky pixel edges
// that resizing a 24px image back up to display size leaves behind. A large
// sigma here was redundant with the resize-down for privacy and flattened
// the result into a single uniform color -- looks like a broken image
// instead of a soft blurred photo.
const BLUR_SIGMA = 1.2;

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

function blurThumbnail(original: Uint8Array): Uint8Array {
  return ImageMagick.read(original, (img): Uint8Array => {
    // Destroy resolution first -- blurring a full-resolution image alone is
    // sometimes partially reversible; a 24px source has nothing left to
    // recover regardless of blur strength.
    img.resize(TINY_DIMENSION, TINY_DIMENSION);
    img.blur(0, BLUR_SIGMA);
    img.resize(DISPLAY_DIMENSION, DISPLAY_DIMENSION);
    return img.write(MagickFormat.Jpeg, (data) => data);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ success: false, error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ success: false, error: "Unauthorized" }, 401);
  }

  // Trusted internal caller (the one-off backfill script): presents the
  // project's own service-role key directly, same trust tier this function's
  // adminClient below already has. No separate user to reconcile ownership
  // against -- the photo_id in the body is trusted as-is.
  const isTrustedInternalCall = authHeader === `Bearer ${serviceRoleKey}`;

  let ownerUserId: string | null = null;
  if (!isTrustedInternalCall) {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }
    ownerUserId = authData.user.id;
  }

  let body: { photo_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid JSON body" }, 400);
  }

  const photoId = (body.photo_id ?? "").trim();
  if (!photoId) {
    return json({ success: false, error: "photo_id is required" }, 400);
  }

  // Service role -- needed regardless of caller to download/upload storage
  // objects and write blurred_thumbnail_url; ownership was already
  // established above via the caller's own JWT (or the trusted-internal path).
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: photo, error: photoError } = await adminClient
    .from("user_photos")
    .select("id, user_id, storage_path, blurred_thumbnail_url")
    .eq("id", photoId)
    .maybeSingle();

  if (photoError || !photo) {
    return json({ success: false, error: "photo_not_found" }, 404);
  }

  if (!isTrustedInternalCall && photo.user_id !== ownerUserId) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  if (photo.blurred_thumbnail_url) {
    return json({ success: true, blurred_thumbnail_url: photo.blurred_thumbnail_url });
  }

  if (!photo.storage_path) {
    return json({ success: false, error: "photo_missing_storage_path" }, 422);
  }

  const { data: original, error: downloadError } = await adminClient.storage
    .from("user-photos")
    .download(photo.storage_path);

  if (downloadError || !original) {
    console.error("[generate-photo-thumbnail] download failed:", downloadError);
    return json({ success: false, error: "download_failed" }, 500);
  }

  let blurred: Uint8Array;
  try {
    const originalBytes = new Uint8Array(await original.arrayBuffer());
    blurred = blurThumbnail(originalBytes);
  } catch (imgErr) {
    console.error("[generate-photo-thumbnail] image processing failed:", imgErr);
    return json({ success: false, error: "image_processing_failed" }, 500);
  }

  // Distinct path from the original -- never overwrite/reuse it, so there's
  // no way to reach the unblurred bytes from the blurred file's URL.
  const blurredPath = `${photo.user_id}/thumb_blurred.jpg`;

  const { error: uploadError } = await adminClient.storage
    .from("user-photos")
    .upload(blurredPath, blurred, { contentType: "image/jpeg", upsert: true });

  if (uploadError) {
    console.error("[generate-photo-thumbnail] upload failed:", uploadError);
    return json({ success: false, error: "upload_failed" }, 500);
  }

  const { data: { publicUrl } } = adminClient.storage.from("user-photos").getPublicUrl(blurredPath);

  const { error: saveError } = await adminClient
    .from("user_photos")
    .update({ blurred_thumbnail_url: publicUrl })
    .eq("id", photoId)
    .is("blurred_thumbnail_url", null); // don't clobber a concurrent successful write

  if (saveError) {
    console.error("[generate-photo-thumbnail] failed to save blurred_thumbnail_url:", saveError);
    return json({ success: false, error: "save_failed" }, 500);
  }

  return json({ success: true, blurred_thumbnail_url: publicUrl });
});
