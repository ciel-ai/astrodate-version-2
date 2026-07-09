-- "Who liked you" frontend support (Phase 3 backing changes).
--
-- Two additions needed to render the grid:
--   1) get_who_liked_me() gains compatibility_score, always populated
--      regardless of reveal_state (score visibility is separate from
--      photo/identity visibility -- see 20260707040000).
--   2) get_my_sent_likes(): the "Your likes" sub-tab (outgoing likes the
--      user has sent) is always fully visible to its owner -- there is no
--      reveal mechanic on your own sent likes, so this is a plain read with
--      the same trust filters, no locked/revealed split at all.
--
-- The score itself is the pure-SQL western_compatibility_cache lookup (sign
-- pair -> compatibility_percentage), the same cheap approach already used by
-- get_todays_match_nudge() -- NOT the paid-API astro-compatibility/
-- compute-synastry edge functions, which are far too expensive to call once
-- per grid card.

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
  v_my_sign                TEXT;
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

  SELECT ad.western_sign INTO v_my_sign
  FROM public.astro_details ad
  WHERE ad.user_id = v_user_id;

  WITH eligible_likes AS (
    SELECT
      ul.user_id,
      ul.action_type,
      ul.reveal_state,
      ul.reveal_source,
      ul.seen,
      ul.created_at,
      up.full_name,
      wcc.compatibility_percentage AS compatibility_score,
      (
        SELECT p.photo_url
        FROM public.user_photos p
        WHERE p.user_id = ul.user_id
        ORDER BY p.is_primary DESC, p.display_order ASC
        LIMIT 1
      ) AS photo_url
    FROM public.user_likes ul
    JOIN public.user_profiles up ON up.user_id = ul.user_id
    LEFT JOIN public.astro_details ad ON ad.user_id = ul.user_id
    LEFT JOIN public.western_compatibility_cache wcc
      ON wcc.sign_a = v_my_sign AND wcc.sign_b = ad.western_sign
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
          'user_id',             user_id,
          'action_type',         action_type,
          'reveal_state',        reveal_state,
          'is_visible',          (v_is_paid OR reveal_state = 'revealed'),
          'reveal_source',       CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN reveal_source ELSE NULL END,
          'full_name',           CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN full_name ELSE NULL END,
          'photo_url',           CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN photo_url ELSE NULL END,
          'compatibility_score', compatibility_score,
          'seen',                seen,
          'created_at',          created_at
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

-- ============================================================================
-- get_my_sent_likes(): "Your likes" -- outgoing likes, always fully visible
-- to their owner. No reveal_state, no tier gating, no free-reveal affordance.
-- Still excludes blocked/actioned-report/soft-deleted targets and anyone
-- already matched (they belong in Chats, not in a pending-likes list).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_sent_likes()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_my_sign TEXT;
  v_likes   JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT ad.western_sign INTO v_my_sign
  FROM public.astro_details ad
  WHERE ad.user_id = v_user_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id',             ul.liked_user_id,
        'action_type',         ul.action_type,
        'full_name',           up.full_name,
        'photo_url',           (
          SELECT p.photo_url
          FROM public.user_photos p
          WHERE p.user_id = ul.liked_user_id
          ORDER BY p.is_primary DESC, p.display_order ASC
          LIMIT 1
        ),
        'compatibility_score', wcc.compatibility_percentage,
        'created_at',          ul.created_at
      ) ORDER BY ul.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_likes
  FROM public.user_likes ul
  JOIN public.user_profiles up ON up.user_id = ul.liked_user_id
  LEFT JOIN public.astro_details ad ON ad.user_id = ul.liked_user_id
  LEFT JOIN public.western_compatibility_cache wcc
    ON wcc.sign_a = v_my_sign AND wcc.sign_b = ad.western_sign
  WHERE ul.user_id = v_user_id
    AND ul.action_type IN ('like', 'super_like')
    AND up.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.block_users b
      WHERE (b.blocker_id = v_user_id AND b.blocked_id = ul.liked_user_id)
         OR (b.blocker_id = ul.liked_user_id AND b.blocked_id = v_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.reported_user_id = ul.liked_user_id AND r.status = 'actioned'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE um.user1_id = LEAST(v_user_id, ul.liked_user_id)
        AND um.user2_id = GREATEST(v_user_id, ul.liked_user_id)
    );

  RETURN jsonb_build_object('likes', v_likes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_sent_likes() TO authenticated;
