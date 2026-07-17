-- ============================================================================
-- Enforce plan_catalog.features->>'see_who_likes_you' in get_who_liked_me().
--
-- Since 20260713150000_restore_get_who_liked_me_full_shape.sql, visibility was
-- gated purely on `v_is_paid` (plan_slug <> 'free'), so Astro+ and AstroX both
-- got the full, uncapped likers list. But the seeded plan data
-- (20260630120200_subscriptions.sql) has always carried a real per-plan
-- number: astro_plus.see_who_likes_you = 5, astro_x.see_who_likes_you = -1
-- (unlimited) — that number was simply never read anywhere. Astro+ has been
-- indistinguishable from AstroX for this feature since that migration.
--
-- Fix: rank each eligible like by recency (most recent first) and only grant
-- paid visibility to rows within the caller's plan limit; -1/unlimited keeps
-- today's uncapped behavior. Rows beyond the cap fall back to the existing
-- free-reveal mechanic (reveal_state = 'revealed'), same as a free-tier user
-- would see them — they are not hidden outright, just not paid-unlocked.
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
  v_plan_features           JSONB;
  v_is_paid                BOOLEAN;
  v_see_limit               INT;
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

  SELECT pc.plan_slug, pc.features INTO v_plan_slug, v_plan_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');
  v_is_paid := (v_plan_slug <> 'free');
  v_see_limit := COALESCE((v_plan_features->>'see_who_likes_you')::INT, 0);

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
      ) AS photo_url,
      ROW_NUMBER() OVER (ORDER BY ul.created_at DESC) AS rn
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
  ),
  scored_likes AS (
    SELECT
      *,
      (v_is_paid AND (v_see_limit < 0 OR rn <= v_see_limit)) AS paid_visible
    FROM eligible_likes
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
          'is_visible',          (paid_visible OR reveal_state = 'revealed'),
          'reveal_source',       CASE WHEN paid_visible OR reveal_state = 'revealed' THEN reveal_source ELSE NULL END,
          'full_name',           CASE WHEN paid_visible OR reveal_state = 'revealed' THEN full_name ELSE NULL END,
          'photo_url',           CASE WHEN paid_visible OR reveal_state = 'revealed' THEN photo_url ELSE NULL END,
          'compatibility_score', compatibility_score,
          'seen',                seen,
          'created_at',          created_at
        ) ORDER BY created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_count, v_unseen_count, v_free_reveal_available, v_likers
  FROM scored_likes;

  RETURN jsonb_build_object(
    'is_paid',                v_is_paid,
    'plan_slug',               v_plan_slug,
    'see_limit',                v_see_limit,
    'count',                   COALESCE(v_count, 0),
    'unseen_count',             COALESCE(v_unseen_count, 0),
    'free_reveal_used',         v_free_reveal_used,
    'free_reveal_available',    COALESCE(v_free_reveal_available, false),
    'likes',                    v_likers
  );
END;
$$;
