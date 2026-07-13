-- ============================================================================
-- Chats tab backend: conversation-list aggregation, realtime for new matches,
-- and re-enabling block-from-chat now that the feature is actually shipping.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_my_conversations(): one row per active (non-blocked) match, with the
-- last message preview and unread count already aggregated server-side --
-- avoids N+1 queries from the client for the Chats list. Mirrors the
-- LATERAL-join pattern already used by get_who_liked_me / get_fallback_feed.
-- ----------------------------------------------------------------------------
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
    SELECT message_text, created_at, sender_id
    FROM public.messages
    WHERE channel_id = um.channel_id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS unread_count
    FROM public.messages
    WHERE channel_id = um.channel_id
      AND receiver_id = v_user_id
      AND is_read = false
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

REVOKE ALL ON FUNCTION public.get_my_conversations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_conversations() TO authenticated;


-- ----------------------------------------------------------------------------
-- Add user_matches to the realtime publication (messages is already in it,
-- same pattern) so a new match shows up in the Chats list live instead of
-- only after a pull-to-refresh.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_matches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_matches;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;


-- ----------------------------------------------------------------------------
-- block_user was locked to service_role-only in the prior security audit
-- (zero client call sites at the time, flagged there as "safe to re-grant
-- the moment the corresponding feature ships"). The Chats block/report menu
-- is that feature -- re-grant to authenticated now.
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
