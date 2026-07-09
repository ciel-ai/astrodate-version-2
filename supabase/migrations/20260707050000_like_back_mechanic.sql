-- "Who liked you" like-back mechanic (Phase 2).
--
-- Every card in this tab is, by definition, someone who already liked the
-- current user -- there is no "maybe" here the way there is in Discover.
-- So the heart button's ENTIRE behavior hinges on server-side visibility,
-- recomputed fresh inside this function on every call:
--
--   is_visible = is_paid OR reveal_state = 'revealed'
--
--   visible  -> real like-back: insert the reciprocal like and create the
--               mutual match. Guaranteed mutual by construction (the
--               liker->viewer row already satisfies action_type IN
--               ('like','super_like') before we even get here).
--   locked   -> no user_likes row is touched, no match is created, full
--               stop. The function returns {success:false, reason:'locked'}
--               instead of raising, so the client can distinguish "this
--               needs the paywall" from a real error.
--
-- This is a defense-in-depth guard, not just client-side UI gating: a
-- naive implementation that trusted the client to only call this when
-- unlocked would let a free user tap every locked card's heart button and
-- instantly convert their whole backlog into free mutual matches, since
-- every row in this table is already a guaranteed match once revealed.
-- Do not remove the locked-state check below to "simplify" this function.

-- No prior mutual-match-detection or user_matches-creation logic exists
-- anywhere in this codebase (client or server) -- Discover's like button is
-- still an unwired placeholder (see src/components/discover-action-bar.tsx).
-- This is the first thing to create user_matches rows, so channel_id below
-- introduces the convention: a deterministic 'match_<user1>_<user2>' string
-- over the canonically-ordered pair, satisfying user_matches' NOT NULL
-- UNIQUE constraint without needing a separate ID-generation call.
CREATE OR REPLACE FUNCTION public.like_back(p_liker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_plan_slug   TEXT;
  v_is_paid     BOOLEAN;
  v_reveal_state TEXT;
  v_user1       UUID;
  v_user2       UUID;
  v_channel_id  TEXT;
  v_match_id    UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_liker_id IS NULL OR p_liker_id = v_user_id THEN
    RAISE EXCEPTION 'p_liker_id is required and must not be the caller';
  END IF;

  SELECT pc.plan_slug INTO v_plan_slug
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');
  v_is_paid := (v_plan_slug <> 'free');

  -- Same trust filters as get_who_liked_me(): a row that wouldn't survive
  -- being shown in the grid (blocked, actioned-report, soft-deleted liker)
  -- can't be liked back either.
  SELECT ul.reveal_state INTO v_reveal_state
  FROM public.user_likes ul
  JOIN public.user_profiles up ON up.user_id = ul.user_id
  WHERE ul.user_id = p_liker_id
    AND ul.liked_user_id = v_user_id
    AND ul.action_type IN ('like', 'super_like')
    AND up.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.block_users b
      WHERE (b.blocker_id = v_user_id AND b.blocked_id = ul.user_id)
         OR (b.blocker_id = ul.user_id AND b.blocked_id = v_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.reported_user_id = ul.user_id AND r.status = 'actioned'
    );

  IF v_reveal_state IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_found');
  END IF;

  IF NOT (v_is_paid OR v_reveal_state = 'revealed') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'locked');
  END IF;

  -- Reciprocal like. Never downgrade an existing super_like from the
  -- viewer to a plain like if one somehow already exists.
  INSERT INTO public.user_likes (user_id, liked_user_id, action_type)
  VALUES (v_user_id, p_liker_id, 'like')
  ON CONFLICT (user_id, liked_user_id) DO UPDATE
    SET action_type = CASE WHEN public.user_likes.action_type = 'super_like' THEN 'super_like' ELSE 'like' END,
        updated_at = now();

  v_user1 := LEAST(v_user_id, p_liker_id);
  v_user2 := GREATEST(v_user_id, p_liker_id);
  v_channel_id := 'match_' || v_user1::TEXT || '_' || v_user2::TEXT;

  INSERT INTO public.user_matches (user1_id, user2_id, channel_id)
  VALUES (v_user1, v_user2, v_channel_id)
  ON CONFLICT ON CONSTRAINT user_matches_unique DO UPDATE
    SET updated_at = public.user_matches.updated_at
  RETURNING id, channel_id INTO v_match_id, v_channel_id;

  RETURN jsonb_build_object(
    'success',      true,
    'matched',      true,
    'match_id',     v_match_id,
    'channel_id',   v_channel_id,
    'liker_user_id', p_liker_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.like_back(UUID) TO authenticated;

-- ============================================================================
-- get_who_liked_me(): once a like-back creates a match, that person is no
-- longer an incoming like awaiting action -- they move to Chats and must
-- disappear from this grid (and its count) rather than lingering as a
-- "revealed" card here.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_who_liked_me()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id               UUID := auth.uid();
  v_plan_slug              TEXT;
  v_is_paid                BOOLEAN;
  v_free_reveal_used        BOOLEAN;
  v_count                   INT;
  v_unseen_count            INT;
  v_free_reveal_available   BOOLEAN;
  v_likers                  JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pc.plan_slug INTO v_plan_slug
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');
  v_is_paid := (v_plan_slug <> 'free');

  SELECT COALESCE(up.free_reveal_used, true) INTO v_free_reveal_used
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id;

  v_free_reveal_used := COALESCE(v_free_reveal_used, true);

  WITH eligible_likes AS (
    SELECT
      ul.user_id,
      ul.action_type,
      ul.reveal_state,
      ul.reveal_source,
      ul.seen,
      ul.created_at,
      up.full_name,
      (
        SELECT p.photo_url
        FROM public.user_photos p
        WHERE p.user_id = ul.user_id
        ORDER BY p.is_primary DESC, p.display_order ASC
        LIMIT 1
      ) AS photo_url
    FROM public.user_likes ul
    JOIN public.user_profiles up ON up.user_id = ul.user_id
    WHERE ul.liked_user_id = v_user_id
      AND ul.action_type IN ('like', 'super_like')
      AND up.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.block_users b
        WHERE (b.blocker_id = v_user_id AND b.blocked_id = ul.user_id)
           OR (b.blocker_id = ul.user_id AND b.blocked_id = v_user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.reported_user_id = ul.user_id AND r.status = 'actioned'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE um.user1_id = LEAST(v_user_id, ul.user_id)
          AND um.user2_id = GREATEST(v_user_id, ul.user_id)
      )
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT seen),
    BOOL_OR((NOT v_free_reveal_used) AND reveal_state = 'locked'),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id',       user_id,
          'action_type',   action_type,
          'reveal_state',  reveal_state,
          'is_visible',    (v_is_paid OR reveal_state = 'revealed'),
          'reveal_source', CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN reveal_source ELSE NULL END,
          'full_name',     CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN full_name ELSE NULL END,
          'photo_url',     CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN photo_url ELSE NULL END,
          'seen',          seen,
          'created_at',    created_at
        ) ORDER BY created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_count, v_unseen_count, v_free_reveal_available, v_likers
  FROM eligible_likes;

  RETURN jsonb_build_object(
    'is_paid',                v_is_paid,
    'plan_slug',               v_plan_slug,
    'count',                   COALESCE(v_count, 0),
    'unseen_count',             COALESCE(v_unseen_count, 0),
    'free_reveal_used',         v_free_reveal_used,
    'free_reveal_available',    COALESCE(v_free_reveal_available, false),
    'likes',                    v_likers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_who_liked_me() TO authenticated;
