-- ============================================================================
-- AstroDate — "Today Favors [sign]" match nudge
-- ============================================================================
-- Phase 2 of Daily Insights: reuses data that already exists — the user's own
-- Discover candidate pool (get_fallback_feed) and the fully-precomputed
-- western_compatibility_cache (144 sign pairs, seeded via
-- scripts/seed-zodiac-compatibility.ts) — for a pure SQL query. No Astrology
-- API calls at request time, no new Edge Function.
--
-- Algorithm: map today's day-of-week ruling planet to the zodiac sign it
-- classically rules ("today's day-ruler sign"), then, among the distinct
-- western signs actually present in the caller's current Discover pool, pick
-- whichever one scores highest against the day-ruler sign in
-- western_compatibility_cache. That's the "favored sign" shown in the UI,
-- along with a sample of real matching candidates from the pool.
-- ============================================================================


-- ============================================================================
-- get_fallback_feed — add a trailing western_sign column so the new nudge
-- query can read each candidate's sign without duplicating this function's
-- filtering logic. Same pattern as when distance_km/distance_label were added
-- in 20260701120000_nearby_location.sql: existing columns/order unchanged, so
-- current callers keep working unmodified.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_fallback_feed(uuid);
CREATE OR REPLACE FUNCTION public.get_fallback_feed(input_user_id UUID)
RETURNS TABLE (
  match_user_id UUID,
  full_name TEXT,
  gender TEXT,
  age INT,
  location TEXT,
  final_match_score NUMERIC,
  personality_score NUMERIC,
  indian_score NUMERIC,
  western_score NUMERIC,
  indian_recommendation TEXT,
  western_report TEXT,
  distance_km NUMERIC,
  distance_label TEXT,
  western_sign TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_min_age           INT;
  v_max_age           INT;
  v_gender_pref       TEXT;
  v_viewer_gender     TEXT;
  v_location          TEXT;
  v_max_distance      INT;
  v_viewer_geog       GEOGRAPHY;
BEGIN
  SELECT
    COALESCE(up.min_age, 18),
    COALESCE(up.max_age, 65),
    up.gender_preference,
    prof.gender,
    COALESCE(up.location, prof.location),
    COALESCE(up.max_distance, 50)
  INTO v_min_age, v_max_age, v_gender_pref, v_viewer_gender, v_location, v_max_distance
  FROM public.user_profiles prof
  LEFT JOIN public.user_preferences up ON up.user_id = prof.user_id
  WHERE prof.user_id = input_user_id;

  v_min_age      := COALESCE(v_min_age, 18);
  v_max_age      := COALESCE(v_max_age, 65);
  v_max_distance := COALESCE(v_max_distance, 50);

  -- Viewer's current point (NULL if they haven't shared / revoked consent).
  SELECT ul.geog INTO v_viewer_geog
  FROM public.user_locations ul
  WHERE ul.user_id = input_user_id AND ul.consent;

  IF v_gender_pref IS NULL THEN
    SELECT
      CASE
        WHEN s1.interest IS NULL THEN 'Everyone'
        WHEN 'everyone' = ANY(s1.interest) THEN 'Everyone'
        WHEN array_length(s1.interest, 1) = 1 THEN
          CASE
            WHEN s1.interest[1] = 'women' THEN 'Female'
            WHEN s1.interest[1] = 'men' THEN 'Male'
            WHEN s1.interest[1] = 'beyond-binary' THEN 'Non-binary'
            ELSE 'Everyone'
          END
        ELSE 'Everyone'
      END
    INTO v_gender_pref
    FROM public.section1_qns s1
    WHERE s1.user_id = input_user_id;
  END IF;

  RETURN QUERY
  SELECT
    up.user_id AS match_user_id,
    up.full_name,
    up.gender,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age,
    up.location,
    ROUND(GREATEST(10.0 - (ROW_NUMBER() OVER (ORDER BY up.updated_at DESC) * 0.2), 1.0)::NUMERIC, 2) AS final_match_score,
    0::NUMERIC AS personality_score,
    0::NUMERIC AS indian_score,
    0::NUMERIC AS western_score,
    'Unscored'::TEXT AS indian_recommendation,
    'Unscored'::TEXT AS western_report,
    -- distance_km: precise-ish numeric for sorting/UI logic (still no coordinates leaked)
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      ELSE ROUND((ST_Distance(cand_loc.geog, v_viewer_geog) / 1000.0)::NUMERIC, 1)
    END AS distance_km,
    -- distance_label: fuzzed, rounded-to-km string shown to the user
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      WHEN ST_Distance(cand_loc.geog, v_viewer_geog) < 1000 THEN 'Less than 1 km away'
      ELSE ROUND(ST_Distance(cand_loc.geog, v_viewer_geog) / 1000.0)::TEXT || ' km away'
    END AS distance_label,
    ad.western_sign AS western_sign
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  LEFT JOIN public.user_preferences cand_pref ON cand_pref.user_id = up.user_id
  LEFT JOIN public.section1_qns cand_sec1 ON cand_sec1.user_id = up.user_id
  LEFT JOIN public.user_locations cand_loc ON cand_loc.user_id = up.user_id AND cand_loc.consent
  WHERE up.user_id <> input_user_id
    AND up.user_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocked_id FROM public.block_users WHERE blocker_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocker_id FROM public.block_users WHERE blocked_id = input_user_id
    )
    AND (
      ad.birth_date IS NULL
      OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date)) BETWEEN v_min_age AND v_max_age
    )
    AND (
      v_gender_pref IS NULL
      OR lower(v_gender_pref) IN ('everyone', 'all', '')
      OR lower(up.gender) = lower(v_gender_pref)
    )
    AND (
      lower(COALESCE(
        cand_pref.gender_preference,
        CASE
          WHEN cand_sec1.interest IS NULL THEN 'Everyone'
          WHEN 'everyone' = ANY(cand_sec1.interest) THEN 'Everyone'
          WHEN array_length(cand_sec1.interest, 1) = 1 THEN
            CASE
              WHEN cand_sec1.interest[1] = 'women' THEN 'Female'
              WHEN cand_sec1.interest[1] = 'men' THEN 'Male'
              WHEN cand_sec1.interest[1] = 'beyond-binary' THEN 'Non-binary'
              ELSE 'Everyone'
            END
          ELSE 'Everyone'
        END
      )) IN ('everyone', 'all', '')
      OR lower(COALESCE(
        cand_pref.gender_preference,
        CASE
          WHEN cand_sec1.interest IS NULL THEN 'Everyone'
          WHEN 'everyone' = ANY(cand_sec1.interest) THEN 'Everyone'
          WHEN array_length(cand_sec1.interest, 1) = 1 THEN
            CASE
              WHEN cand_sec1.interest[1] = 'women' THEN 'Female'
              WHEN cand_sec1.interest[1] = 'men' THEN 'Male'
              WHEN cand_sec1.interest[1] = 'beyond-binary' THEN 'Non-binary'
              ELSE 'Everyone'
            END
          ELSE 'Everyone'
        END
      )) = lower(v_viewer_gender)
    )
    -- Distance filter (soft): only excludes candidates whose location IS known
    -- and is beyond the viewer's max_distance. Uses the GiST index via ST_DWithin.
    AND (
      v_viewer_geog IS NULL
      OR cand_loc.geog IS NULL
      OR ST_DWithin(cand_loc.geog, v_viewer_geog, v_max_distance * 1000)
    )
  ORDER BY
    -- Nearer first when we can compute distance; otherwise the original recency order.
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      ELSE ST_Distance(cand_loc.geog, v_viewer_geog)
    END ASC NULLS LAST,
    up.updated_at DESC
  LIMIT 50;
END;
$$;


-- ============================================================================
-- get_todays_match_nudge(input_user_id, p_sample_size)
-- ----------------------------------------------------------------------------
-- "Today's day-ruler sign" = the zodiac sign classically ruled by today's
-- day-of-week ruling planet (traditional single rulerships — pre-outer-planet
-- reassignment — same choice as the daily-insights Edge Function's day_ruler
-- helper, just carried one step further into a sign):
--   Sun->Leo, Moon->Cancer, Mars->Aries, Mercury->Gemini, Jupiter->Sagittarius,
--   Venus->Taurus, Saturn->Capricorn.
-- Among the distinct western_sign values actually present in the caller's own
-- get_fallback_feed pool, this picks whichever one western_compatibility_cache
-- scores highest against today's day-ruler sign — that's the "favored sign".
-- Pure SQL: no Astrology API call, no new Edge Function.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_todays_match_nudge(
  input_user_id UUID,
  p_sample_size INTEGER DEFAULT 3
)
RETURNS TABLE(
  day_ruler_sign TEXT,
  favored_sign TEXT,
  match_count BIGINT,
  sample_user_ids UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_ruler_sign TEXT;
  v_favored_sign   TEXT;
  v_match_count    BIGINT;
  v_sample_ids     UUID[];
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> input_user_id THEN
    RAISE EXCEPTION 'Cannot query match nudge for another user';
  END IF;

  v_day_ruler_sign := CASE EXTRACT(DOW FROM CURRENT_DATE)::INT
    WHEN 0 THEN 'Leo'          -- Sunday   -> Sun
    WHEN 1 THEN 'Cancer'       -- Monday   -> Moon
    WHEN 2 THEN 'Aries'        -- Tuesday  -> Mars
    WHEN 3 THEN 'Gemini'       -- Wednesday-> Mercury
    WHEN 4 THEN 'Sagittarius'  -- Thursday -> Jupiter
    WHEN 5 THEN 'Taurus'       -- Friday   -> Venus
    WHEN 6 THEN 'Capricorn'    -- Saturday -> Saturn
  END;

  -- SELECT INTO leaves the target variables NULL (not an error) when the
  -- join finds no matching row — e.g. an empty Discover pool, or a pool
  -- whose signs happen not to include the pair the cache has for today.
  -- That NULL/0/empty-array result is exactly the "no favored sign today"
  -- state the client renders as an empty state, not an error.
  WITH pool_signs AS (
    SELECT
      f.western_sign,
      COUNT(*) AS sign_match_count,
      (ARRAY_AGG(f.match_user_id ORDER BY f.final_match_score DESC))[1:GREATEST(p_sample_size, 0)] AS sample_ids
    FROM public.get_fallback_feed(input_user_id) f
    WHERE f.western_sign IS NOT NULL
    GROUP BY f.western_sign
  )
  SELECT ps.western_sign, ps.sign_match_count, ps.sample_ids
  INTO v_favored_sign, v_match_count, v_sample_ids
  FROM pool_signs ps
  JOIN public.western_compatibility_cache wcc
    ON wcc.sign_a = v_day_ruler_sign AND wcc.sign_b = ps.western_sign
  ORDER BY wcc.compatibility_score_45 DESC
  LIMIT 1;

  RETURN QUERY SELECT
    v_day_ruler_sign,
    v_favored_sign,
    COALESCE(v_match_count, 0::BIGINT),
    COALESCE(v_sample_ids, ARRAY[]::UUID[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_todays_match_nudge(UUID, INTEGER) TO authenticated;
