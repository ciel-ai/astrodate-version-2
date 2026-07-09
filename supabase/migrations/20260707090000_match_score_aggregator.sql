-- ============================================================================
-- Match score aggregator (build plan Section 4): Western 45 + Indian 45 +
-- Personality 10 = /100, replacing the hardcoded personality_score=0 /
-- indian_score=0 / western_score=0 in get_fallback_feed.
--
-- Like get_personality_compatibility and get_indian_compatibility, any
-- component that isn't available for a given pair is dropped and the
-- remaining weights renormalized (same pattern, applied one level up):
--   total_score = Σ(component points) ÷ Σ(weight of present components) × 100
-- When all three are present this reduces to a plain sum out of 100, since
-- 45+45+10 = 100. fully_computed=false signals "partial score, not final" so
-- callers don't mistake a renormalized estimate for the real /100.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- get_western_compatibility(user_a, user_b)
-- Reads the pre-seeded 144-row western_compatibility_cache (scripts/seed-
-- zodiac-compatibility.ts) keyed on each user's astro_details.western_sign.
-- No external API call -- this table is static and, per its own table
-- comment, meant to be read-only at request time.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_western_compatibility(p_user_a UUID, p_user_b UUID)
RETURNS TABLE (
  computed         BOOLEAN,
  western_percent  NUMERIC,
  western_points   NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sign_a TEXT;
  v_sign_b TEXT;
  v_cached public.western_compatibility_cache%ROWTYPE;
BEGIN
  SELECT western_sign INTO v_sign_a FROM public.astro_details WHERE user_id = p_user_a;
  SELECT western_sign INTO v_sign_b FROM public.astro_details WHERE user_id = p_user_b;

  IF v_sign_a IS NULL OR v_sign_b IS NULL THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  SELECT * INTO v_cached
  FROM public.western_compatibility_cache
  WHERE sign_a = v_sign_a AND sign_b = v_sign_b;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_cached.compatibility_percentage, v_cached.compatibility_score_45;
END;
$$;

COMMENT ON FUNCTION public.get_western_compatibility(UUID, UUID) IS
  'Western 45 score (build plan Section 4): looks up the precomputed sign-pair score from western_compatibility_cache. computed=false means either user has no western_sign yet, or the cache is unseeded for that pair.';

-- ----------------------------------------------------------------------------
-- get_match_score(user_a, user_b)
-- The 45/45/10 aggregator. See header comment for the renormalization rule.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_match_score(p_user_a UUID, p_user_b UUID)
RETURNS TABLE (
  total_score        NUMERIC,
  fully_computed     BOOLEAN,
  western_points     NUMERIC,
  indian_points      NUMERIC,
  personality_points NUMERIC,
  breakdown          JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_western     RECORD;
  v_indian      RECORD;
  v_personality RECORD;
  v_weight_sum  NUMERIC := 0;
  v_score_sum   NUMERIC := 0;
  v_breakdown   JSONB := '{}'::JSONB;

  WEIGHT_WESTERN     CONSTANT NUMERIC := 45;
  WEIGHT_INDIAN      CONSTANT NUMERIC := 45;
  WEIGHT_PERSONALITY CONSTANT NUMERIC := 10;
BEGIN
  SELECT * INTO v_western FROM public.get_western_compatibility(p_user_a, p_user_b);
  SELECT * INTO v_indian FROM public.get_indian_compatibility(p_user_a, p_user_b);
  SELECT * INTO v_personality FROM public.get_personality_compatibility(p_user_a, p_user_b);

  IF v_western.computed THEN
    v_weight_sum := v_weight_sum + WEIGHT_WESTERN;
    v_score_sum := v_score_sum + v_western.western_points;
    v_breakdown := v_breakdown || jsonb_build_object('western', v_western.western_points);
  END IF;

  IF v_indian.computed THEN
    v_weight_sum := v_weight_sum + WEIGHT_INDIAN;
    v_score_sum := v_score_sum + v_indian.indian_points;
    v_breakdown := v_breakdown || jsonb_build_object(
      'indian', v_indian.indian_points,
      'manglik_status', v_indian.manglik_status,
      'nadi_dosha', v_indian.nadi_dosha,
      'bhakoot_dosha', v_indian.bhakoot_dosha
    );
  END IF;

  IF v_personality.personality_points IS NOT NULL THEN
    v_weight_sum := v_weight_sum + WEIGHT_PERSONALITY;
    v_score_sum := v_score_sum + v_personality.personality_points;
    v_breakdown := v_breakdown || jsonb_build_object(
      'personality', v_personality.personality_points,
      'personality_factors', v_personality.factor_breakdown
    );
  END IF;

  IF v_weight_sum = 0 THEN
    RETURN QUERY SELECT NULL::NUMERIC, false, v_western.western_points, v_indian.indian_points, v_personality.personality_points, v_breakdown;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    ROUND(v_score_sum / v_weight_sum * 100, 2),
    (v_western.computed AND v_indian.computed AND v_personality.personality_points IS NOT NULL),
    v_western.western_points,
    v_indian.indian_points,
    v_personality.personality_points,
    v_breakdown;
END;
$$;

COMMENT ON FUNCTION public.get_match_score(UUID, UUID) IS
  'Total /100 match score (build plan Section 4): Western 45 + Indian 45 + Personality 10, renormalized over whichever components are actually available for the pair. fully_computed=false means the total is a partial-data estimate.';

-- ============================================================================
-- get_fallback_feed — wire the real aggregator in place of the hardcoded
-- personality_score=0 / indian_score=0 / western_score=0 placeholders, and
-- use the real total as final_match_score instead of a recency proxy.
-- Everything else (candidate pool, filters, distance, ordering, LIMIT) is
-- byte-for-byte unchanged from the prior definition (20260707010000) other
-- than the LATERAL join and the score expressions themselves, plus one new
-- trailing fully_computed column -- same additive-column convention used by
-- every prior redefinition of this function.
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
