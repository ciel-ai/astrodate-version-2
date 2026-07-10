-- ============================================================================
-- "Who are you interested in seeing?" (onboarding-ques-01.tsx) has never
-- actually filtered Discover. Three independent value vocabularies exist in
-- this codebase for gender, and none of them agree:
--   user_profiles.gender (onboarding.tsx)      -> 'male' | 'female' | 'nonBinary'
--   section1_qns.interest (onboarding-ques-01) -> 'male' | 'female' | 'non-binary' | 'everyone'
--   get_fallback_feed's old CASE logic         -> checked for 'men' | 'women' | 'beyond-binary'
--
-- The old logic's literal string comparisons never matched anything real, so
-- v_gender_pref always fell through to its ELSE 'Everyone' branch --
-- confirmed by grepping the whole client: user_preferences.gender_preference
-- (checked FIRST, before this fallback) is never written anywhere either.
-- Every user, regardless of selection, saw every gender in Discover.
--
-- It was also structurally unable to support the real UI, which lets users
-- select MULTIPLE genders (not just one) -- the old CASE only handled
-- "exactly one selected" or "everyone", collapsing any 2-of-3 combination
-- (e.g. Men + Women but not Beyond Binary) to 'Everyone' too.
--
-- Fix: gender_matches_interest() does real, normalized (punctuation/case
-- stripped) set-membership -- a candidate's gender is shown if it appears
-- anywhere in the viewer's interest array, the array contains "everyone" in
-- any spelling, or no preference has been recorded at all (open by default,
-- same as before for users who haven't reached that onboarding step yet).
-- Reused for both directions (viewer's interest in candidate, and
-- candidate's interest in viewer) instead of duplicating the same logic
-- inline twice, which is how the old version's copy-pasted CASE blocks
-- existed in the first place.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.gender_matches_interest(p_person_gender TEXT, p_interest TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    p_interest IS NULL
    OR array_length(p_interest, 1) IS NULL
    OR EXISTS (
      SELECT 1 FROM unnest(p_interest) x
      WHERE regexp_replace(lower(x), '[^a-z]', '', 'g') = 'everyone'
    )
    OR EXISTS (
      SELECT 1 FROM unnest(p_interest) x
      WHERE regexp_replace(lower(x), '[^a-z]', '', 'g')
          = regexp_replace(lower(COALESCE(p_person_gender, '')), '[^a-z]', '', 'g')
    );
$$;

COMMENT ON FUNCTION public.gender_matches_interest(TEXT, TEXT[]) IS
  'Normalized (case/punctuation-insensitive) set-membership check for gender preference matching. NULL/empty interest or an "everyone" entry always matches. Fixes the value-vocabulary mismatch between user_profiles.gender (nonBinary), section1_qns.interest (non-binary), and Discover''s old literal-string comparisons (men/women/beyond-binary, which never matched anything real).';

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
  fully_computed BOOLEAN,
  manglik_status BOOLEAN,
  nadi_dosha BOOLEAN,
  bhakoot_dosha BOOLEAN,
  why_you_match TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_min_age           INT;
  v_max_age           INT;
  v_viewer_gender_pref TEXT;
  v_viewer_interest   TEXT[];
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
  INTO v_min_age, v_max_age, v_viewer_gender_pref, v_viewer_gender, v_location, v_max_distance
  FROM public.user_profiles prof
  LEFT JOIN public.user_preferences up ON up.user_id = prof.user_id
  WHERE prof.user_id = input_user_id;

  v_min_age      := COALESCE(v_min_age, 18);
  v_max_age      := COALESCE(v_max_age, 65);
  v_max_distance := COALESCE(v_max_distance, 50);

  SELECT ul.geog INTO v_viewer_geog
  FROM public.user_locations ul
  WHERE ul.user_id = input_user_id AND ul.consent;

  -- user_preferences.gender_preference takes priority if ever set (single
  -- value -- wrapped as a 1-element array for gender_matches_interest);
  -- section1_qns.interest (the real onboarding answer today) otherwise.
  IF v_viewer_gender_pref IS NOT NULL THEN
    v_viewer_interest := ARRAY[v_viewer_gender_pref];
  ELSE
    SELECT s1.interest INTO v_viewer_interest
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
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      ELSE ROUND((ST_Distance(cand_loc.geog, v_viewer_geog) / 1000.0)::NUMERIC, 1)
    END AS distance_km,
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      WHEN ST_Distance(cand_loc.geog, v_viewer_geog) < 1000 THEN 'Less than 1 km away'
      ELSE ROUND(ST_Distance(cand_loc.geog, v_viewer_geog) / 1000.0)::TEXT || ' km away'
    END AS distance_label,
    ad.western_sign AS western_sign,
    COALESCE(ms.fully_computed, false) AS fully_computed,
    (ms.breakdown->>'manglik_status')::BOOLEAN AS manglik_status,
    (ms.breakdown->>'nadi_dosha')::BOOLEAN AS nadi_dosha,
    (ms.breakdown->>'bhakoot_dosha')::BOOLEAN AS bhakoot_dosha,
    scd.compatibility_summary AS why_you_match
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  LEFT JOIN public.user_preferences cand_pref ON cand_pref.user_id = up.user_id
  LEFT JOIN public.section1_qns cand_sec1 ON cand_sec1.user_id = up.user_id
  LEFT JOIN public.user_locations cand_loc ON cand_loc.user_id = up.user_id AND cand_loc.consent
  LEFT JOIN public.synastry_cache_details scd
    ON scd.user_a_id = LEAST(input_user_id, up.user_id) AND scd.user_b_id = GREATEST(input_user_id, up.user_id)
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
    -- Does the viewer want to see this candidate's gender?
    AND public.gender_matches_interest(up.gender, v_viewer_interest)
    -- Does the candidate want to see the viewer's gender? (bidirectional)
    AND public.gender_matches_interest(
      v_viewer_gender,
      CASE WHEN cand_pref.gender_preference IS NOT NULL
           THEN ARRAY[cand_pref.gender_preference]
           ELSE cand_sec1.interest
      END
    )
    AND (
      v_viewer_geog IS NULL
      OR cand_loc.geog IS NULL
      OR ST_DWithin(cand_loc.geog, v_viewer_geog, v_max_distance * 1000)
    )
  ORDER BY
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      ELSE ST_Distance(cand_loc.geog, v_viewer_geog)
    END ASC NULLS LAST,
    up.updated_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.get_fallback_feed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fallback_feed(uuid) TO authenticated;
