-- ============================================================================
-- get_my_conversations() RETURNS TABLE(channel_id TEXT, ...), which makes
-- channel_id an implicit PL/pgSQL variable in scope for the whole function
-- body. The two LATERAL subqueries below referenced bare `channel_id` in
-- their WHERE clause, which Postgres can't resolve between that variable and
-- public.messages.channel_id -- "column reference channel_id is ambiguous"
-- on every single call to the Chats tab. Fix: alias public.messages and
-- qualify the column.
-- ============================================================================

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
    lm.message_text AS last_message_text,
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
    SELECT m.message_text, m.created_at, m.sender_id
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
