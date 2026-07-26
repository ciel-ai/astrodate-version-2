-- Uploaded profile photos had zero content moderation -- chat text is
-- classified (20260723120000_require_server_side_text_moderation.sql), but
-- a client could insert directly into user_photos (single "FOR ALL, owner
-- of user_id" policy) with a photo_url pointing at anything, no gate at all.
-- On a dating app, photos are the higher-risk UGC surface, not lower.
--
-- Same fix shape as the text-moderation migration: split the single ALL
-- policy into SELECT/UPDATE/DELETE (still owner-scoped, unchanged behavior)
-- and drop the client's ability to INSERT entirely. All inserts now go
-- through moderate-photo (service role, which bypasses RLS and doesn't need
-- an INSERT policy at all), which classifies the image with Gemini before
-- ever writing the row -- see that function's own header comment.
DROP POLICY IF EXISTS "Users can manage their own photos" ON public.user_photos;

CREATE POLICY "Users can view their own photos"
  ON public.user_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own photos"
  ON public.user_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
  ON public.user_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Deliberately no INSERT policy for `authenticated` -- moderate-photo's
-- service-role client is the only path that can add a row now.
