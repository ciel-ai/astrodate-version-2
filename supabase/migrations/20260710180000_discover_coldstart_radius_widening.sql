-- ============================================================================
-- Cold-start fallback, step 2 (plan Section 6): "when a tier's high quota
-- can't be filled, the deck builder gracefully (1) draws from the next-best
-- band (70-79, then 60-69), and (2) widens the geographic/age radius."
--
-- Step 1 (band-widening) was already implemented in get_discover_deck (the
-- band_step CASE that prefers 80+, falls back to 70+, then 60+). Step 2 was
-- missing entirely: get_fallback_feed's candidate pool has always been built
-- from a single fixed max_distance/age-range query, so if that underlying
-- pool itself is too thin (sparse geography, unusual age bracket, or simply
-- an early/small user base), no amount of band-widening inside
-- get_discover_deck can find high scorers that were never in the pool to
-- begin with -- the tier's high quota silently goes unfilled with no further
-- recourse, exactly the failure mode the plan calls out as critical.
--
-- Fix: get_fallback_feed gains two optional, backward-compatible parameters
-- (p_distance_multiplier, p_age_expand; both default to a no-op) so it can
-- be asked for a wider pool without duplicating its scoring/filtering logic.
-- get_discover_deck calls it a second time with a 3x radius and +10 years
-- age range -- but only when the first (normal-radius) pool didn't have
-- enough 60+ scorers to fill this tier's high quota, so a normal-sized pool
-- never pays for a query it doesn't need.
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_fallback_feed(uuid);
CREATE OR REPLACE FUNCTION public.get_fallback_feed(
  input_user_id UUID,
  p_distance_multiplier NUMERIC DEFAULT 1,
  p_age_expand INT DEFAULT 0
)
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

  v_min_age      := GREATEST(COALESCE(v_min_age, 18) - p_age_expand, 18);
  v_max_age      := COALESCE(v_max_age, 65) + p_age_expand;
  v_max_distance := COALESCE(v_max_distance, 50) * p_distance_multiplier;

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

REVOKE ALL ON FUNCTION public.get_fallback_feed(uuid, numeric, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fallback_feed(uuid, numeric, int) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- get_discover_deck: after building the normal-radius pool, check whether it
-- has enough 60+ scorers to fill this tier's high quota. If not, pull in a
-- second, wider-radius/wider-age pool and merge in whatever wasn't already
-- found -- band-widening (already implemented below via band_step) then
-- picks from this enlarged pool same as before.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_discover_deck()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_plan_slug     TEXT;
  v_features      JSONB;
  v_tier_deck_size INT;
  v_deck_size     INT;
  v_high_quota    INT;
  v_high_percent  INT;
  v_wants_top     BOOLEAN;
  v_target_high   INT;
  v_remaining_swipes INT;
  v_swipes_exhausted BOOLEAN;
  v_state         public.discover_deck_daily_state%ROWTYPE;
  v_kept_high     UUID[];
  v_new_high      UUID[];
  v_final_high    UUID[];
  v_high_count    INT;
  v_remainder     UUID[];
  v_remainder_ct  INT;
  v_final_order   UUID[] := ARRAY[]::UUID[];
  v_gap           INT;
  v_next_high_idx INT := 1;
  v_top_match_id  UUID;
  v_true_high_pool_ct   INT;
  v_true_high_shown_ct  INT;
  v_cards         JSONB;
  v_insert_pos    INT;
  v_pool_high_ct  INT;
  i               INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pc.plan_slug, pc.features INTO v_plan_slug, v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT plan_slug, features INTO v_plan_slug, v_features
    FROM public.plan_catalog WHERE plan_slug = 'free';
  END IF;

  v_tier_deck_size := COALESCE((v_features->>'deck_size')::INT, 10);
  v_deck_size    := v_tier_deck_size;
  v_high_quota   := NULLIF(v_features->>'high_match_quota', 'null')::INT;
  v_high_percent := NULLIF(v_features->>'high_match_percent', 'null')::INT;
  v_wants_top    := COALESCE((v_features->>'top_match_of_day')::BOOLEAN, false);

  v_target_high := CASE
    WHEN v_high_percent IS NOT NULL THEN CEIL(v_deck_size * v_high_percent / 100.0)::INT
    ELSE COALESCE(v_high_quota, 1)
  END;

  v_remaining_swipes := public.get_likes_remaining(v_user_id);
  IF v_remaining_swipes < v_deck_size THEN
    v_deck_size := v_remaining_swipes;
  END IF;
  v_target_high := LEAST(v_target_high, v_deck_size);

  CREATE TEMP TABLE tmp_pool ON COMMIT DROP AS
  SELECT * FROM public.get_fallback_feed(v_user_id);

  -- Cold-start fallback, step 2 (plan Section 6): band-widening alone (below)
  -- can only pick from candidates that made it into the pool in the first
  -- place. If the normal-radius/age pool doesn't even have enough 60+
  -- scorers to fill this tier's high quota, widen the net once (3x distance,
  -- +10 years each side of the age range) and merge in anything new.
  SELECT COUNT(*) INTO v_pool_high_ct FROM tmp_pool WHERE final_match_score >= 60;
  IF v_pool_high_ct < v_target_high THEN
    INSERT INTO tmp_pool
    SELECT w.* FROM public.get_fallback_feed(v_user_id, 3, 10) w
    WHERE w.match_user_id NOT IN (SELECT match_user_id FROM tmp_pool);
  END IF;

  CREATE TEMP TABLE tmp_photos ON COMMIT DROP AS
  SELECT user_id, jsonb_agg(
    jsonb_build_object(
      'url',        COALESCE(thumbnail_url, photo_url),
      'is_primary', is_primary
    )
    ORDER BY is_primary DESC, display_order ASC
  ) AS photos
  FROM public.user_photos
  WHERE user_id IN (SELECT match_user_id FROM tmp_pool)
  GROUP BY user_id;

  CREATE TEMP TABLE tmp_prompts ON COMMIT DROP AS
  SELECT user_id, jsonb_agg(
    jsonb_build_object('question', question, 'answer', answer)
    ORDER BY prompt_id
  ) AS prompts
  FROM public.user_prompts
  WHERE user_id IN (SELECT match_user_id FROM tmp_pool)
  GROUP BY user_id;

  SELECT * INTO v_state
  FROM public.discover_deck_daily_state
  WHERE user_id = v_user_id AND deck_date = CURRENT_DATE;

  IF NOT FOUND THEN
    INSERT INTO public.discover_deck_daily_state (user_id, deck_date, high_shown_ids)
    VALUES (v_user_id, CURRENT_DATE, ARRAY[]::UUID[])
    RETURNING * INTO v_state;
  END IF;

  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO v_kept_high
  FROM unnest(v_state.high_shown_ids) id
  WHERE id IN (SELECT match_user_id FROM tmp_pool);

  v_high_count := COALESCE(array_length(v_kept_high, 1), 0);

  IF v_high_count < v_target_high THEN
    SELECT ARRAY_AGG(match_user_id) INTO v_new_high
    FROM (
      SELECT match_user_id,
        CASE
          WHEN final_match_score >= 80 THEN 0
          WHEN final_match_score >= 70 THEN 1
          WHEN final_match_score >= 60 THEN 2
          ELSE 3
        END AS band_step
      FROM tmp_pool
      WHERE match_user_id <> ALL(v_kept_high)
        AND final_match_score >= 60
      ORDER BY band_step, final_match_score DESC
      LIMIT GREATEST(v_target_high - v_high_count, 0)
    ) x;
  END IF;

  v_final_high := v_kept_high || COALESCE(v_new_high, ARRAY[]::UUID[]);
  v_high_count := COALESCE(array_length(v_final_high, 1), 0);

  IF v_final_high IS DISTINCT FROM v_state.high_shown_ids THEN
    UPDATE public.discover_deck_daily_state
    SET high_shown_ids = v_final_high, updated_at = now()
    WHERE user_id = v_user_id AND deck_date = CURRENT_DATE;
  END IF;

  IF v_wants_top THEN
    SELECT picked_user_id INTO v_top_match_id
    FROM public.daily_picks
    WHERE user_id = v_user_id AND pick_date = CURRENT_DATE;
  END IF;

  SELECT COALESCE(ARRAY_AGG(match_user_id), ARRAY[]::UUID[]) INTO v_remainder
  FROM (
    SELECT match_user_id
    FROM tmp_pool
    WHERE match_user_id <> ALL(v_final_high)
      AND final_match_score < 80
    ORDER BY (final_match_score >= 50) DESC, random()
    LIMIT GREATEST(v_deck_size - v_high_count, 0)
  ) r;
  v_remainder_ct := COALESCE(array_length(v_remainder, 1), 0);

  IF v_high_count = 0 THEN
    v_final_order := v_remainder;
  ELSE
    v_gap := GREATEST((v_remainder_ct + v_high_count) / (v_high_count + 1), 2);
    FOR i IN 1..v_remainder_ct LOOP
      v_final_order := v_final_order || v_remainder[i];
      IF i % v_gap = 0 AND v_next_high_idx <= v_high_count THEN
        v_final_order := v_final_order || v_final_high[v_next_high_idx];
        v_next_high_idx := v_next_high_idx + 1;
      END IF;
    END LOOP;
    WHILE v_next_high_idx <= v_high_count LOOP
      v_final_order := v_final_order || v_final_high[v_next_high_idx];
      v_next_high_idx := v_next_high_idx + 1;
    END LOOP;
  END IF;

  IF v_wants_top
     AND v_top_match_id IS NOT NULL
     AND v_deck_size > 0
     AND v_top_match_id IN (SELECT match_user_id FROM tmp_pool)
     AND NOT (v_top_match_id = ANY(v_final_order))
  THEN
    IF array_length(v_final_order, 1) >= v_deck_size THEN
      v_final_order := v_final_order[1:array_length(v_final_order, 1) - 1];
    END IF;
    v_insert_pos := floor(random() * (COALESCE(array_length(v_final_order, 1), 0) + 1))::INT + 1;
    v_final_order := v_final_order[1:v_insert_pos - 1] || ARRAY[v_top_match_id] || v_final_order[v_insert_pos:];
  END IF;

  -- Whether finishing THIS deck (whatever size it actually ended up, which
  -- can be smaller than the swipe-based cap if the pool itself is thin) will
  -- exactly use up today's remaining swipes. Deliberately compares against
  -- the real final card count, not v_tier_deck_size or even v_deck_size --
  -- a thin pool that only fills, say, 3 of a possible 10 slots means the
  -- user still has 7 swipes left after finishing it, which is a completely
  -- different situation ("no more people right now") from actually running
  -- out of swipes, even though both end with an empty deck.
  v_swipes_exhausted := (COALESCE(array_length(v_final_order, 1), 0) = v_remaining_swipes);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'user_id',            p.match_user_id,
        'full_name',          p.full_name,
        'gender',             p.gender,
        'age',                p.age,
        'location',           p.location,
        'score',              p.final_match_score,
        'band',               CASE
                                 WHEN p.final_match_score >= 80 THEN 'high'
                                 WHEN p.final_match_score >= 50 THEN 'medium'
                                 ELSE 'low'
                               END,
        'is_top_match_of_day', (p.match_user_id = v_top_match_id),
        'western_sign',       p.western_sign,
        'distance_label',     p.distance_label,
        'fully_computed',     p.fully_computed,
        'personality_score',  CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.personality_score END,
        'indian_score',       CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.indian_score END,
        'western_score',      CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.western_score END,
        'manglik_status',     CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.manglik_status END,
        'nadi_dosha',         CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.nadi_dosha END,
        'bhakoot_dosha',      CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.bhakoot_dosha END,
        'why_you_match',      CASE WHEN v_plan_slug = 'astro_x' THEN p.why_you_match ELSE NULL END,
        'photos',             COALESCE(ph.photos, '[]'::jsonb),
        'prompts',            COALESCE(pr.prompts, '[]'::jsonb),
        'about',             ob.about_me
      )
      ORDER BY ord.ord
    ) FILTER (WHERE p.match_user_id IS NOT NULL),
    '[]'::jsonb
  ) INTO v_cards
  FROM unnest(v_final_order) WITH ORDINALITY AS ord(id, ord)
  LEFT JOIN tmp_pool p ON p.match_user_id = ord.id
  LEFT JOIN tmp_photos ph ON ph.user_id = ord.id
  LEFT JOIN tmp_prompts pr ON pr.user_id = ord.id
  LEFT JOIN public.onboarding_responses ob ON ob.user_id = ord.id;

  SELECT COUNT(*) INTO v_true_high_pool_ct FROM tmp_pool WHERE final_match_score >= 80;
  SELECT COUNT(*) INTO v_true_high_shown_ct
  FROM unnest(v_final_order) id
  JOIN tmp_pool p ON p.match_user_id = id
  WHERE p.final_match_score >= 80;

  RETURN jsonb_build_object(
    'tier', v_plan_slug,
    'cards', v_cards,
    'meta', jsonb_build_object(
      'deck_size', v_deck_size,
      'high_quota', v_high_quota,
      'high_percent', v_high_percent,
      'high_shown', v_high_count,
      'more_high_locked_count', GREATEST(v_true_high_pool_ct - v_true_high_shown_ct, 0),
      'swipes_exhausted', v_swipes_exhausted
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_discover_deck() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_discover_deck() TO authenticated;
