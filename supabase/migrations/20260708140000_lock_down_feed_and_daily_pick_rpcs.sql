-- ============================================================================
-- Two gaps found while auditing for duplicate/drifted Discover-feed logic
-- ahead of building the tiered deck composer on top of get_fallback_feed:
--
--   1. generate_daily_picks_now() takes no user-scoping argument and
--      recomputes Top-Match-of-the-Day picks for every user in the system,
--      yet had no GRANT/REVOKE anywhere -- Postgres's default (EXECUTE
--      granted to PUBLIC on function creation) left it callable by any
--      authenticated (and possibly anon) API client, who could force a full
--      batch recompute on demand. Restricted to service_role, matching how
--      this project already gates its other admin/cron-only RPCs
--      (sync_ios_subscription).
--
--   2. get_fallback_feed(input_user_id) never checked that the caller WAS
--      input_user_id -- unlike get_todays_match_nudge, which already guards
--      this exact case ("Cannot query match nudge for another user"). Any
--      client could pass another user's UUID and read that user's entire
--      scored candidate pool. Adding the same guard here: reject an
--      authenticated caller asking for someone else's feed, but still allow
--      auth.uid() IS NULL (service-role / internal SECURITY DEFINER callers
--      such as get_my_daily_pick's cold-start fallback, which always passes
--      its own auth.uid() anyway and is unaffected by this change).
--
-- Function body below is byte-for-byte the final version from
-- 20260707090000_match_score_aggregator.sql other than the added guard --
-- same additive-change convention used by every prior redefinition of this
-- function.
-- ============================================================================

REVOKE ALL ON FUNCTION public.generate_daily_picks_now() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_daily_picks_now() TO service_role;

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
  western_sign TEXT,
  fully_computed BOOLEAN
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
  IF auth.uid() IS NOT NULL AND auth.uid() <> input_user_id THEN
    RAISE EXCEPTION 'Cannot query discover feed for another user';
  END IF;

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
    COALESCE(
      ms.total_score,
      ROUND(GREATEST(10.0 - (ROW_NUMBER() OVER (ORDER BY up.updated_at DESC) * 0.2), 1.0)::NUMERIC, 2)
    ) AS final_match_score,
    ms.personality_points AS personality_score,
    ms.indian_points AS indian_score,
    ms.western_points AS western_score,
    CASE WHEN ms.indian_points IS NOT NULL THEN 'Scored' ELSE 'Unscored' END AS indian_recommendation,
    CASE WHEN ms.western_points IS NOT NULL THEN 'Scored' ELSE 'Unscored' END AS western_report,
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
    ad.western_sign AS western_sign,
    COALESCE(ms.fully_computed, false) AS fully_computed
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  LEFT JOIN public.user_preferences cand_pref ON cand_pref.user_id = up.user_id
  LEFT JOIN public.section1_qns cand_sec1 ON cand_sec1.user_id = up.user_id
  LEFT JOIN public.user_locations cand_loc ON cand_loc.user_id = up.user_id AND cand_loc.consent
  CROSS JOIN LATERAL public.get_match_score(input_user_id, up.user_id) AS ms
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
