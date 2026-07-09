-- ============================================================================
-- record_swipe never checked whether (user, target) already had a user_likes
-- row before consuming quota -- it just upserted. discover.tsx's own
-- handleSwipe deliberately leaves a card on screen after a timeout so the
-- user can retry ("leave the card in place so the user can retry the same
-- swipe"), which is exactly the scenario that breaks: if the first call
-- actually succeeded server-side and only the response was lost in transit,
-- the retry silently spends a second swipe (or second super-like) for one
-- real-world action, and if it was a mutual like, re-runs the reciprocal
-- check and returns matched:true again -- a duplicate "It's a match!" alert
-- for a match that already happened.
--
-- Fix: check for an existing row FIRST, before any quota consumption. If
-- found, this is a replay (or simply a re-decided swipe on someone already
-- acted on) -- return the existing decision without charging anything again.
-- matched is always returned false in the replay path specifically so the
-- client's existing "if (result.matched) Alert.alert(...)" doesn't re-fire;
-- real matches are visible via the Likes/Chats tabs regardless, not
-- something this endpoint needs to re-announce on a retry. Consistent with
-- rewind_last_swipe already being the one sanctioned way to change an
-- already-made decision -- record_swipe must never silently flip or
-- re-charge one.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.record_swipe(p_target_user_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_db_action    TEXT;
  v_swipe_ok     BOOLEAN;
  v_super_left   INT;
  v_reciprocal   TEXT;
  v_user1        UUID;
  v_user2        UUID;
  v_channel_id   TEXT;
  v_match_id     UUID;
  v_matched      BOOLEAN := false;
  v_existing     public.user_likes%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_target');
  END IF;

  IF p_action NOT IN ('like', 'pass', 'super_like') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_action');
  END IF;

  -- Idempotency guard -- must run before any quota is touched.
  SELECT * INTO v_existing
  FROM public.user_likes
  WHERE user_id = v_user_id AND liked_user_id = p_target_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', CASE WHEN v_existing.action_type = 'dislike' THEN 'pass' ELSE v_existing.action_type END,
      'matched', false,
      'match_id', NULL,
      'channel_id', NULL
    );
  END IF;

  v_db_action := CASE WHEN p_action = 'pass' THEN 'dislike' ELSE p_action END;

  IF p_action = 'super_like' THEN
    SELECT public.get_super_likes_remaining(v_user_id) INTO v_super_left;
    IF v_super_left <= 0 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'super_like_limit_reached');
    END IF;
  END IF;

  SELECT public.consume_like(v_user_id) INTO v_swipe_ok;
  IF NOT v_swipe_ok THEN
    RETURN jsonb_build_object('success', false, 'reason', 'swipe_limit_reached');
  END IF;

  IF p_action = 'super_like' THEN
    PERFORM public.consume_super_like(v_user_id);
  END IF;

  INSERT INTO public.user_likes (user_id, liked_user_id, action_type)
  VALUES (v_user_id, p_target_user_id, v_db_action)
  ON CONFLICT (user_id, liked_user_id) DO UPDATE
    SET action_type = EXCLUDED.action_type, updated_at = now();

  IF v_db_action IN ('like', 'super_like') THEN
    SELECT ul.action_type INTO v_reciprocal
    FROM public.user_likes ul
    WHERE ul.user_id = p_target_user_id
      AND ul.liked_user_id = v_user_id
      AND ul.action_type IN ('like', 'super_like');

    IF v_reciprocal IS NOT NULL THEN
      v_user1 := LEAST(v_user_id, p_target_user_id);
      v_user2 := GREATEST(v_user_id, p_target_user_id);
      v_channel_id := 'match_' || v_user1::TEXT || '_' || v_user2::TEXT;

      INSERT INTO public.user_matches (user1_id, user2_id, channel_id)
      VALUES (v_user1, v_user2, v_channel_id)
      ON CONFLICT ON CONSTRAINT user_matches_unique DO UPDATE
        SET updated_at = public.user_matches.updated_at
      RETURNING id, channel_id INTO v_match_id, v_channel_id;

      v_matched := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'matched', v_matched,
    'match_id', v_match_id,
    'channel_id', v_channel_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_swipe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_swipe(UUID, TEXT) TO authenticated;
