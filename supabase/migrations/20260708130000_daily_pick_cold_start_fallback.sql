-- ============================================================================
-- Top Match of the Day was getting stuck at "no pick" for any user whose
-- highest-scored cached candidate didn't satisfy BOTH conditions in
-- generate_daily_picks_now()'s WHERE clause: astro_score IS NOT NULL AND the
-- candidate's profile updated_at within the last 7 days. If a user's only
-- scored candidates all happened to be slightly-stale profiles, DISTINCT ON
-- returned zero rows for that user -- no daily_picks row -> get_my_daily_pick()
-- returns NULL forever, instead of falling back to the next-best available
-- candidate. The RPC also only ever picked in the user_a_id direction of
-- synastry_cache, silently skipping users who only appear as user_b_id --
-- the separate 'daily-picks-midnight' pg_cron job (realtime_cron.sql) already
-- covered both directions with near-duplicate raw SQL, so this also collapses
-- that job down to calling the one fixed function instead of keeping two
-- copies of the same query free to drift apart again.
--
-- Fix, mirroring the deck builder's own cold-start philosophy (fall back to
-- the next-best band rather than serve nothing):
--   Tier 1: best scored candidate whose profile is recently active (unchanged
--           preference for freshness when available).
--   Tier 2: for any user Tier 1 didn't cover, best scored candidate regardless
--           of profile freshness.
--   Tier 3 (in get_my_daily_pick, read-time): for a user with literally zero
--           synastry_cache rows yet (e.g. brand-new, prewarm hasn't run),
--           fall back live to get_fallback_feed's top-scored candidate and
--           persist it so the rest of the day stays stable.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.generate_daily_picks_now()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_inserted INT := 0;
  v_batch    INT := 0;
BEGIN
  -- Tier 1: prefer a candidate whose profile has been active in the last 7 days.
  INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
  SELECT DISTINCT ON (v.viewer_id)
    v.viewer_id, v.candidate_id, v.astro_score, CURRENT_DATE
  FROM (
    SELECT sc.user_a_id AS viewer_id, sc.user_b_id AS candidate_id, sc.astro_score, up.updated_at
    FROM public.synastry_cache sc
    JOIN public.user_profiles up ON up.user_id = sc.user_b_id
    WHERE sc.astro_score IS NOT NULL
    UNION ALL
    SELECT sc.user_b_id, sc.user_a_id, sc.astro_score, up.updated_at
    FROM public.synastry_cache sc
    JOIN public.user_profiles up ON up.user_id = sc.user_a_id
    WHERE sc.astro_score IS NOT NULL
  ) v
  WHERE v.updated_at > now() - INTERVAL '7 days'
  ORDER BY v.viewer_id, v.astro_score DESC
  ON CONFLICT (user_id, pick_date) DO NOTHING;
  GET DIAGNOSTICS v_batch = ROW_COUNT;
  v_inserted := v_inserted + v_batch;

  -- Tier 2 (cold-start fallback): anyone Tier 1 skipped -- because every
  -- scored candidate they have happens to be profile-stale -- still gets
  -- today's best-scoring candidate rather than no pick at all.
  INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
  SELECT DISTINCT ON (v.viewer_id)
    v.viewer_id, v.candidate_id, v.astro_score, CURRENT_DATE
  FROM (
    SELECT sc.user_a_id AS viewer_id, sc.user_b_id AS candidate_id, sc.astro_score
    FROM public.synastry_cache sc
    WHERE sc.astro_score IS NOT NULL
    UNION ALL
    SELECT sc.user_b_id, sc.user_a_id, sc.astro_score
    FROM public.synastry_cache sc
    WHERE sc.astro_score IS NOT NULL
  ) v
  WHERE NOT EXISTS (
    SELECT 1 FROM public.daily_picks dp
    WHERE dp.user_id = v.viewer_id AND dp.pick_date = CURRENT_DATE
  )
  ORDER BY v.viewer_id, v.astro_score DESC
  ON CONFLICT (user_id, pick_date) DO NOTHING;
  GET DIAGNOSTICS v_batch = ROW_COUNT;
  v_inserted := v_inserted + v_batch;

  RETURN v_inserted;
END;
$$;

-- get_my_daily_pick() -- add the read-time cold-start tier for users with no
-- synastry_cache data at all yet, so a fresh signup never sees an empty
-- Top Match of the Day just because tonight's cron hasn't run for them.
CREATE OR REPLACE FUNCTION public.get_my_daily_pick()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_result   json;
  v_has_pick BOOLEAN;
  v_fallback RECORD;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.daily_picks
    WHERE user_id = v_user_id AND pick_date = CURRENT_DATE
  ) INTO v_has_pick;

  IF NOT v_has_pick THEN
    SELECT match_user_id, final_match_score
    INTO v_fallback
    FROM public.get_fallback_feed(v_user_id)
    ORDER BY final_match_score DESC
    LIMIT 1;

    IF v_fallback.match_user_id IS NOT NULL THEN
      INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
      VALUES (v_user_id, v_fallback.match_user_id, v_fallback.final_match_score, CURRENT_DATE)
      ON CONFLICT (user_id, pick_date) DO NOTHING;
    END IF;
  END IF;

  SELECT json_build_object(
    'picked_user_id',   dp.picked_user_id,
    'astro_score',      dp.astro_score,
    'pick_date',        dp.pick_date,
    'full_name',        up.full_name,
    'gender',           up.gender,
    'location',         up.location,
    'western_sign',     ad.western_sign,
    'indian_sign',      ad.indian_sign,
    'dominant_element', ad.dominant_element
  )
  INTO v_result
  FROM public.daily_picks dp
  JOIN public.user_profiles up ON up.user_id = dp.picked_user_id
  LEFT JOIN public.astro_details ad ON ad.user_id = dp.picked_user_id
  WHERE dp.user_id = v_user_id
    AND dp.pick_date = CURRENT_DATE
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- Collapse the cron job's duplicated raw SQL down to the function above, so
-- there's one implementation of "how a daily pick is chosen" instead of two
-- that can silently diverge (which is how the user_a_id-only gap happened).
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily-picks-midnight')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-picks-midnight');

    PERFORM cron.schedule(
      'daily-picks-midnight',
      '0 0 * * *',
      $cron$ SELECT public.generate_daily_picks_now(); $cron$
    );
  END IF;
END
$outer$;
