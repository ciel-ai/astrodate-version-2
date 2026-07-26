-- Locked "who liked me" cards currently show a flat gray placeholder because
-- get_who_liked_me() nulls out photo_url entirely for locked rows -- there's
-- no image data at all to show. Adding a genuinely-blurred (resolution
-- destroyed, not just CSS-filtered) thumbnail lets locked cards show that
-- instead, same pattern Tinder/Bumble/Hinge use.
--
-- Deliberately a NEW column, not a reuse of the existing (deceptively "dead")
-- user_photos.thumbnail_url: that column is actually read live by
-- get_discover_deck() and get_user_photos_batch() via
-- COALESCE(thumbnail_url, photo_url) -- populating it with a blurred image
-- here would silently replace every user's real Discover-deck photos with
-- blurred placeholders app-wide. Kept fully separate to avoid that collision.
ALTER TABLE public.user_photos
  ADD COLUMN IF NOT EXISTS blurred_thumbnail_url text;

COMMENT ON COLUMN public.user_photos.blurred_thumbnail_url IS
  'Server-generated (downsample-to-~24px, blur, upscale) re-encoded copy of the primary photo, safe to expose on locked "who liked me" cards. Populated by the generate-photo-thumbnail edge function, never by the client directly.';
