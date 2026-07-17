-- ============================================================================
-- Chat media messages: photos (camera/gallery) and voice notes.
--
-- The messages table only stored text. This adds a discriminator + media
-- pointer so a row can instead carry an image or audio clip uploaded to the
-- existing (baseline) `messages` storage bucket.
--
-- The `messages` bucket was created private with an owner-only SELECT policy
-- ((storage.foldername(name))[1] = auth.uid()), so the *receiver* could never
-- read the sender's upload. user-photos hit the exact same wall and was fixed
-- by going public (20260710120000). We do the same here: media object keys are
-- unguessable UUID paths, and the app already treats user-photos as public, so
-- this keeps chat media viewable by both participants via getPublicUrl.
-- ============================================================================

-- 1. Media columns on messages -------------------------------------------------
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'audio')),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  -- Voice-note length in milliseconds; NULL for text/image.
  ADD COLUMN IF NOT EXISTS media_duration_ms INTEGER;

COMMENT ON COLUMN public.messages.message_type IS
  'text = message_text only; image/audio = media_url points at the messages bucket object.';

-- message_text is already nullable in baseline, so image/audio rows can omit it.

-- 2. Make the messages bucket public so the receiver can load media -----------
UPDATE storage.buckets SET public = true WHERE id = 'messages';

-- 3. Media-aware conversation preview -----------------------------------------
-- get_my_conversations returns last_message_text for the Chats list. For a
-- media last-message there is no text, so surface a human label instead. Body
-- is otherwise identical to 20260713140000 (only the last_message_text
-- expression changed).
CREATE OR REPLACE FUNCTION public.get_my_conversations()
RETURNS TABLE (
  channel_id             TEXT,
  other_user_id          UUID,
  other_user_name        TEXT,
  other_user_photo       TEXT,
  last_message_text      TEXT,
  last_message_at        TIMESTAMPTZ,
  last_message_sender_id UUID,
  unread_count           INT,
  matched_at             TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    um.channel_id,
    other.user_id AS other_user_id,
    other.full_name AS other_user_name,
    ph.photo_url AS other_user_photo,
    COALESCE(
      NULLIF(lm.message_text, ''),
      CASE lm.message_type
        WHEN 'image' THEN '📷 Photo'
        WHEN 'audio' THEN '🎤 Voice message'
        ELSE NULL
      END
    ) AS last_message_text,
    lm.created_at AS last_message_at,
    lm.sender_id AS last_message_sender_id,
    COALESCE(uc.unread_count, 0)::INT AS unread_count,
    um.matched_at
  FROM public.user_matches um
  JOIN public.user_profiles other
    ON other.user_id = (CASE WHEN um.user1_id = v_user_id THEN um.user2_id ELSE um.user1_id END)
  LEFT JOIN LATERAL (
    SELECT photo_url
    FROM public.user_photos
    WHERE user_id = other.user_id
    ORDER BY is_primary DESC, display_order ASC
    LIMIT 1
  ) ph ON true
  LEFT JOIN LATERAL (
    SELECT m.message_text, m.message_type, m.created_at, m.sender_id
    FROM public.messages m
    WHERE m.channel_id = um.channel_id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
    FROM public.messages m
    WHERE m.channel_id = um.channel_id
      AND m.receiver_id = v_user_id
      AND m.is_read = false
  ) uc ON true
  WHERE (um.user1_id = v_user_id OR um.user2_id = v_user_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.block_users b
      WHERE (b.blocker_id = v_user_id AND b.blocked_id = other.user_id)
         OR (b.blocker_id = other.user_id AND b.blocked_id = v_user_id)
    )
  ORDER BY COALESCE(lm.created_at, um.matched_at) DESC;
END;
$$;
