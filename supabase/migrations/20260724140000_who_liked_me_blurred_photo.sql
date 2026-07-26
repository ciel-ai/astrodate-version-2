-- Adds blurred_photo_url to get_who_liked_me()'s per-row payload: for locked
-- rows, the client can now show a genuinely blurred copy of the person's
-- primary photo (user_photos.blurred_thumbnail_url, populated by the
-- generate-photo-thumbnail edge function) instead of a flat gray
-- placeholder. photo_url and full_name stay NULL for locked rows exactly as
-- before -- full reveal gating is unchanged, this only adds a second,
-- privacy-safe field. Once revealed, blurred_photo_url goes back to NULL
-- (the client already has the real photo_url at that point, nothing to add).
--
-- Body is otherwise byte-for-byte identical to 20260714160000's version --
-- confirmed via pg_get_functiondef against the linked project before writing
-- this migration.
CREATE OR REPLACE FUNCTION public.get_who_liked_me()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id                    UUID := auth.uid();
  v_plan_slug                   TEXT;
  v_plan_features                JSONB;
  v_period_start                 TIMESTAMPTZ;
  v_is_paid                     BOOLEAN;
  v_see_limit                    INT;
  v_reveals_remaining             INT;
  v_my_sign                     TEXT;
  v_free_reveal_used             BOOLEAN;
  v_count                        INT;
  v_unseen_count                 INT;
  v_free_reveal_available        BOOLEAN;
  v_likers                       JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pc.plan_slug, pc.features, us.current_period_start
  INTO v_plan_slug, v_plan_features, v_period_start
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

  IF v_see_limit >= 0 THEN
    SELECT COUNT(*) INTO v_reveals_remaining
    FROM public.user_likes
    WHERE liked_user_id = v_user_id
      AND reveal_source = 'subscription'
      AND revealed_at >= COALESCE(v_period_start, '-infinity'::timestamptz);
    v_reveals_remaining := GREATEST(0, v_see_limit - v_reveals_remaining);
  ELSE
    v_reveals_remaining := NULL; -- unlimited plan, nothing to spend
  END IF;

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
      primary_photo.photo_url,
      primary_photo.blurred_thumbnail_url
    FROM public.user_likes ul
    JOIN public.user_profiles up ON up.user_id = ul.user_id
    LEFT JOIN public.astro_details ad ON ad.user_id = ul.user_id
    LEFT JOIN public.western_compatibility_cache wcc
      ON wcc.sign_a = v_my_sign AND wcc.sign_b = ad.western_sign
    LEFT JOIN LATERAL (
      SELECT p.photo_url, p.blurred_thumbnail_url
      FROM public.user_photos p
      WHERE p.user_id = ul.user_id
      ORDER BY p.is_primary DESC, p.display_order ASC
      LIMIT 1
    ) primary_photo ON true
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
          'is_visible',          (v_see_limit < 0 OR reveal_state = 'revealed'),
          'reveal_source',       CASE WHEN v_see_limit < 0 OR reveal_state = 'revealed' THEN reveal_source ELSE NULL END,
          'full_name',           CASE WHEN v_see_limit < 0 OR reveal_state = 'revealed' THEN full_name ELSE NULL END,
          'photo_url',           CASE WHEN v_see_limit < 0 OR reveal_state = 'revealed' THEN photo_url ELSE NULL END,
          'blurred_photo_url',   CASE WHEN v_see_limit < 0 OR reveal_state = 'revealed' THEN NULL ELSE blurred_thumbnail_url END,
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
    'is_paid',                     v_is_paid,
    'plan_slug',                    v_plan_slug,
    'subscription_reveals_remaining', v_reveals_remaining,
    'count',                        COALESCE(v_count, 0),
    'unseen_count',                  COALESCE(v_unseen_count, 0),
    'free_reveal_used',              v_free_reveal_used,
    'free_reveal_available',         COALESCE(v_free_reveal_available, false),
    'likes',                         v_likers
  );
END;
$$;

-- Explicit re-grant even though CREATE OR REPLACE shouldn't touch existing
-- grants -- this project has a documented history of functions silently
-- losing their `authenticated` grant across migrations, so every redefine
-- reasserts it rather than assuming it's still there.
REVOKE ALL ON FUNCTION public.get_who_liked_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_who_liked_me() TO authenticated;
