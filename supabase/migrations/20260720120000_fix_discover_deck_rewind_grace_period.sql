-- ============================================================================
-- Grace-period parity fix for get_discover_deck / rewind_last_swipe /
-- get_rewinds_remaining.
--
-- 20260713120000_fix_membership_grants_and_grace_period.sql broadened
-- get_my_membership / consume_like / get_likes_remaining / consume_super_like
-- / get_super_likes_remaining / get_who_liked_me from `status = 'active'` to
-- `status IN ('active','past_due','canceled')` (paired with the existing
-- current_period_end check) so a subscriber who cancels auto-renew, or hits a
-- past_due billing hiccup, keeps access until their paid period actually
-- ends instead of losing it the instant the status flips.
--
-- get_discover_deck (redefined most recently in
-- 20260717150000_redefine_discover_deck.sql) and rewind_last_swipe /
-- get_rewinds_remaining (20260709140000_discover_rewind.sql) were never part
-- of that fix -- both predate and postdate it while still checking bare
-- `status = 'active'`. Net effect: the same grace-period user kept full
-- likes/super-likes/who-liked-me access but was silently dropped to the Free
-- tier's deck_size, lost the high-match-quota boost, top_match_of_day,
-- why_you_match, and rewind capability. This migration only changes the
-- status filter in all three functions (copied verbatim from their current
-- live bodies otherwise) to match the six already-fixed RPCs -- no other
-- logic touched.
-- ============================================================================

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
    AND us.status IN ('active', 'past_due', 'canceled')
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
        'about',              ob.about_me,
        'vedic_sign',         p.vedic_sign,
        'nakshatra',          p.nakshatra,
        'height_cm',          p.height_cm,
        'looking_for',        p.looking_for,
        'education',          ob.education,
        'drinking',           ob.drinking,
        'smoking',            ob.smoking,
        'weed',               ob.weed,
        'religion',           ob.religion,
        'sexual_orientation', up.sexual_orientation,
        'have_children',      ob.have_children,
        'want_children',      ob.want_children,
        'relationship_style', ob.relationship_style,
        'workout',            ob.workout,
        'diet',               ob.diet,
        'pets',               ob.pets,
        'languages',          COALESCE(to_jsonb(ob.languages), '[]'::jsonb),
        'travel',             ob.travel,
        'relationship_status', s1.relationship_status,
        'interest',           COALESCE(to_jsonb(s1.interest), '[]'::jsonb),
        'hobbies',            COALESCE(to_jsonb(s1.hobbies), '[]'::jsonb),
        'introvert_extrovert', s1.introvert_extrovert
      )
      ORDER BY ord.ord
    ) FILTER (WHERE p.match_user_id IS NOT NULL),
    '[]'::jsonb
  ) INTO v_cards
  FROM unnest(v_final_order) WITH ORDINALITY AS ord(id, ord)
  LEFT JOIN tmp_pool p ON p.match_user_id = ord.id
  LEFT JOIN tmp_photos ph ON ph.user_id = ord.id
  LEFT JOIN tmp_prompts pr ON pr.user_id = ord.id
  LEFT JOIN public.onboarding_responses ob ON ob.user_id = ord.id
  LEFT JOIN public.user_profiles up ON up.user_id = ord.id
  LEFT JOIN public.section1_qns s1 ON s1.user_id = ord.id;

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


CREATE OR REPLACE FUNCTION public.rewind_last_swipe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_features    JSONB;
  v_limit       INT;
  v_used        INT;
  v_last        public.user_likes%ROWTYPE;
  v_is_matched  BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features FROM public.plan_catalog WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'daily_rewinds')::INT, 0);

  IF v_limit = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rewind_not_available');
  END IF;

  -- -1 (or any 999+) means unlimited (AstroX) -- skip the usage check
  -- entirely; anything else is a finite daily cap (Astro+ = 1).
  IF v_limit > 0 AND v_limit < 999 THEN
    SELECT CASE WHEN quota_date = CURRENT_DATE THEN used_count ELSE 0 END
    INTO v_used
    FROM public.daily_rewind_quota
    WHERE user_id = v_user_id;
    v_used := COALESCE(v_used, 0);

    IF v_used >= v_limit THEN
      RETURN jsonb_build_object('success', false, 'reason', 'rewind_limit_reached');
    END IF;
  END IF;

  SELECT * INTO v_last
  FROM public.user_likes
  WHERE user_id = v_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'nothing_to_rewind');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_matches
    WHERE user1_id = LEAST(v_user_id, v_last.liked_user_id)
      AND user2_id = GREATEST(v_user_id, v_last.liked_user_id)
  ) INTO v_is_matched;

  IF v_is_matched THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_matched');
  END IF;

  DELETE FROM public.user_likes WHERE id = v_last.id;

  -- Refund the swipe quota it spent (every swipe, including a pass, spends
  -- from daily_likes -- see record_swipe's own comment on that convention).
  UPDATE public.daily_like_quota
  SET used_count = GREATEST(used_count - 1, 0)
  WHERE user_id = v_user_id AND quota_date = CURRENT_DATE;

  IF v_last.action_type = 'super_like' THEN
    UPDATE public.super_like_quota
    SET used_count = GREATEST(used_count - 1, 0)
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO public.daily_rewind_quota (user_id, quota_date, used_count)
  VALUES (v_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN daily_rewind_quota.quota_date = CURRENT_DATE
          THEN daily_rewind_quota.used_count + 1
          ELSE 1
        END,
        quota_date = CURRENT_DATE,
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'restored_user_id', v_last.liked_user_id,
    'restored_action', v_last.action_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rewind_last_swipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewind_last_swipe() TO authenticated;


CREATE OR REPLACE FUNCTION public.get_rewinds_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features JSONB;
  v_limit    INT;
  v_used     INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot query rewind quota for another user';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features FROM public.plan_catalog WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'daily_rewinds')::INT, 0);

  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;
  IF v_limit = 0 THEN
    RETURN 0;
  END IF;

  SELECT CASE WHEN quota_date = CURRENT_DATE THEN used_count ELSE 0 END
  INTO v_used
  FROM public.daily_rewind_quota
  WHERE user_id = p_user_id;
  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

REVOKE ALL ON FUNCTION public.get_rewinds_remaining(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rewinds_remaining(UUID) TO authenticated;
