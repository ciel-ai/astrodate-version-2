-- ============================================================================
-- Batched fixes from a full sign-in -> Discover audit (2026-07-10). Six
-- independent issues, bundled into one migration per project convention
-- (batch fixes, single db push/reset rather than one migration per fix).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. synastry_cache / synastry_cache_details SELECT policies allowed ANY
-- authenticated user to read ANY pair's row -- USING (auth.role() =
-- 'authenticated') never checked the caller was actually one of the two
-- people. Concretely: any logged-in user could hit
-- /rest/v1/synastry_cache_details?select=* and read the Ashtakoota breakdown,
-- Manglik status, and "why you match" narrative for two OTHER users. Scope
-- both to pair membership. Write policies (service-role only) are untouched.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users read synastry cache" ON public.synastry_cache;
CREATE POLICY "Users can read their own synastry cache"
  ON public.synastry_cache
  FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);

DROP POLICY IF EXISTS "Authenticated users can read synastry cache" ON public.synastry_cache_details;
CREATE POLICY "Users can read their own synastry cache details"
  ON public.synastry_cache_details
  FOR SELECT
  USING (auth.uid() = user_a_id OR auth.uid() = user_b_id);


-- ----------------------------------------------------------------------------
-- 2. get_likes_remaining / get_super_likes_remaining took p_user_id with no
-- check the caller IS that user -- any authenticated client could query
-- another user's remaining daily-like/super-like counts. get_rewinds_remaining
-- (added later, 20260709140000_discover_rewind.sql:166-168) already has this
-- guard; bringing these two in line with it.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_likes_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features  JSONB;
  v_limit     INT;
  v_used      INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot query like quota for another user';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM public.plan_catalog
    WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'daily_likes')::INT, 10);
  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;

  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.daily_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_super_likes_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features      JSONB;
  v_limit         INT;
  v_used          INT;
  v_period_start  DATE;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot query super-like quota for another user';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM public.plan_catalog
    WHERE plan_slug = 'free';
  END IF;

  IF (v_features->>'weekly_super_likes') IS NOT NULL THEN
    v_limit        := (v_features->>'weekly_super_likes')::INT;
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
  ELSE
    v_limit        := COALESCE((v_features->>'daily_super_likes')::INT, 1);
    v_period_start := CURRENT_DATE;
  END IF;

  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;

  SELECT CASE
    WHEN quota_date = v_period_start THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.super_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;


-- ----------------------------------------------------------------------------
-- 3. enqueue_synastry_prewarm's freshness check joined synastry_cache (the
-- legacy planet-score table) to decide whether a pair still needs prewarming,
-- but get_indian_compatibility actually reads ashtakoota_score from
-- synastry_cache_details -- the wrong source of truth by name and intent. If
-- process_synastry_prewarm_job ever throws after compute-synastry succeeds
-- but before its own synastry_cache write, the two tables can desync for up
-- to 7 days with no other reconciliation path. Point the freshness check at
-- the table Indian-45 scoring actually reads.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enqueue_synastry_prewarm(p_user_id UUID)
RETURNS TABLE(enqueued_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot enqueue prewarm for another user';
  END IF;

  WITH viewer AS (
    SELECT
      up.user_id,
      up.gender,
      up.location,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age,
      COALESCE(pref.min_age, 18) AS min_age,
      COALESCE(pref.max_age, 65) AS max_age,
      NULLIF(lower(trim(COALESCE(pref.gender_preference, ''))), '') AS gender_preference
    FROM public.user_profiles up
    LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
    LEFT JOIN public.user_preferences pref ON pref.user_id = up.user_id
    WHERE up.user_id = p_user_id
  ),
  candidate_activity AS (
    SELECT us.user_id, MAX(us.created_at) AS last_signal_at
    FROM public.user_signals us
    GROUP BY us.user_id
  ),
  ranked_candidates AS (
    SELECT
      c.user_id AS candidate_user_id
    FROM viewer v
    JOIN public.user_profiles c ON c.user_id <> v.user_id
    LEFT JOIN public.astro_details cad ON cad.user_id = c.user_id
    LEFT JOIN public.user_preferences cpref ON cpref.user_id = c.user_id
    LEFT JOIN public.user_online_status os ON os.user_id = c.user_id
    LEFT JOIN candidate_activity ca ON ca.user_id = c.user_id
    LEFT JOIN public.synastry_cache_details sc
      ON sc.user_a_id = LEAST(v.user_id, c.user_id)
     AND sc.user_b_id = GREATEST(v.user_id, c.user_id)
     AND sc.is_stale = false
     AND sc.ashtakoota_score IS NOT NULL
     AND sc.computed_at >= now() - INTERVAL '7 days'
    WHERE cad.user_id IS NOT NULL
      AND sc.user_a_id IS NULL
      AND c.user_id NOT IN (
        SELECT ul.liked_user_id
        FROM public.user_likes ul
        WHERE ul.user_id = v.user_id
      )
      AND (
        v.gender_preference IS NULL
        OR v.gender_preference IN ('any', 'all', 'everyone')
        OR lower(COALESCE(c.gender, '')) = v.gender_preference
      )
      AND (
        cpref.gender_preference IS NULL
        OR lower(trim(cpref.gender_preference)) IN ('any', 'all', 'everyone', '')
        OR lower(COALESCE(v.gender, '')) = lower(trim(cpref.gender_preference))
      )
      AND (
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, cad.birth_date))::INT
          BETWEEN v.min_age AND v.max_age
      )
      AND (
        v.age IS NULL
        OR v.age BETWEEN COALESCE(cpref.min_age, 18) AND COALESCE(cpref.max_age, 65)
      )
    ORDER BY
      CASE WHEN os.is_online THEN 0 ELSE 1 END,
      public.synastry_location_priority(v.location, c.location),
      COALESCE(os.last_seen, ca.last_signal_at, c.created_at) DESC
    LIMIT 25
  ),
  inserted AS (
    INSERT INTO public.synastry_prewarm_jobs (user_id, candidate_user_id)
    SELECT p_user_id, candidate_user_id
    FROM ranked_candidates
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted;
END;
$$;


-- ----------------------------------------------------------------------------
-- 4. The active-pair dedup index only covered status IN ('pending',
-- 'processing'), not 'failed'. claim_synastry_prewarm_jobs stops reclaiming a
-- job once retry_count >= 3 (permanently failed, e.g. a user with
-- irrecoverably incomplete birth data) -- but nothing stopped the 30-minute
-- refresh cron from inserting a fresh duplicate 'pending' row for that same
-- pair every cycle thereafter, forever (ON CONFLICT DO NOTHING had nothing to
-- conflict against once the row fell outside the index). Extending the index
-- to cover 'failed' makes a permanently-failed pair correctly block
-- re-enqueueing, while a still-retryable failed row (retry_count < 3) is
-- already reclaimed by claim_synastry_prewarm_jobs itself, so it doesn't need
-- a fresh pending row to be retried either.
-- ----------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_synastry_prewarm_jobs_active_pair;
CREATE UNIQUE INDEX IF NOT EXISTS idx_synastry_prewarm_jobs_active_pair
  ON public.synastry_prewarm_jobs (pair_a_id, pair_b_id)
  WHERE status IN ('pending', 'processing', 'failed');


-- ----------------------------------------------------------------------------
-- 5. record_swipe's idempotency guard (20260709170000) checks for an existing
-- user_likes row before consuming any quota, but that check is a plain SELECT
-- with no lock -- two concurrent calls for the same (user, target) pair (a
-- double-tap firing two requests before the client's `swiping` state can
-- disable the button) can both pass the "not found" check before either
-- commits, double-charging swipe/super-like quota and potentially firing the
-- "It's a match!" response twice for one real action. A plain row lock can't
-- work here (the row doesn't exist yet on first swipe), so use a transaction
-- -scoped advisory lock keyed on the pair to serialize concurrent calls for
-- the same (user, target) -- released automatically at transaction end.
-- ----------------------------------------------------------------------------
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

  -- Serialize concurrent record_swipe calls for this exact (user, target)
  -- pair so the idempotency check below can't race. hashtext() is a signed
  -- 32-bit hash; pg_advisory_xact_lock takes a bigint key, which is fine.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_target_user_id::text));

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
