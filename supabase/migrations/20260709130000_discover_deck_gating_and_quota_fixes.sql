-- ============================================================================
-- Two bugs found during a plan-alignment review of the Discover deck
-- (get_discover_deck, last redefined in 20260709120000 to add photos/
-- prompts/about):
--
--   1. [Data leak] personality_score/indian_score/western_score were
--      returned to EVERY tier. Build plan Section 3's "Compatibility
--      breakdown" row is explicit: Free = "Total score only", Astro+/AstroX
--      = "Full 45/45/10 + doshas". A Free client was receiving the exact
--      same breakdown payload as a paying one -- exactly the "classic
--      Supabase mistake that leaks paid data to free users" Section 8 warns
--      about. Now nulled out for plan_slug = 'free'; total `score`/`band`
--      are unaffected (those are the one thing Free is supposed to see).
--
--   2. [Broken floor guarantee] The deck was always composed at the tier's
--      full deck_size (10/40/100) regardless of how many swipes the user
--      had left today, and the guaranteed high-band card is deliberately
--      placed away from position 1 (see the "never lead with it" comment
--      below). A user with, say, 2 swipes left could be served a fresh
--      10-card deck with their one guaranteed match sitting at position 4-5
--      -- reachable only with swipes they no longer have. Now the deck is
--      capped to min(deck_size, get_likes_remaining()) before composition,
--      so the guaranteed match always lands within the swipes actually
--      available.
--
-- Byte-for-byte the same body as 20260709120000 otherwise.
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
  v_deck_size     INT;
  v_high_quota    INT;
  v_high_percent  INT;
  v_wants_top     BOOLEAN;
  v_target_high   INT;
  v_remaining_swipes INT;
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

  v_deck_size    := COALESCE((v_features->>'deck_size')::INT, 10);
  v_high_quota   := NULLIF(v_features->>'high_match_quota', 'null')::INT;
  v_high_percent := NULLIF(v_features->>'high_match_percent', 'null')::INT;
  v_wants_top    := COALESCE((v_features->>'top_match_of_day')::BOOLEAN, false);

  v_target_high := CASE
    WHEN v_high_percent IS NOT NULL THEN CEIL(v_deck_size * v_high_percent / 100.0)::INT
    ELSE COALESCE(v_high_quota, 1)
  END;

  -- Cap the deck to the swipes actually left today -- otherwise the
  -- guaranteed high-band card (placed away from position 1 further down)
  -- could sit beyond however many swipes remain, breaking the floor
  -- guarantee for anyone who already used most of today's budget.
  v_remaining_swipes := public.get_likes_remaining(v_user_id);
  IF v_remaining_swipes < v_deck_size THEN
    v_deck_size := v_remaining_swipes;
  END IF;
  v_target_high := LEAST(v_target_high, v_deck_size);

  -- Materialize today's scored pool once; get_fallback_feed already excludes
  -- swiped/blocked users and applies age/gender/distance filters.
  CREATE TEMP TABLE tmp_pool ON COMMIT DROP AS
  SELECT * FROM public.get_fallback_feed(v_user_id);

  -- One photos/prompts aggregation pass over the whole pool rather than a
  -- correlated subquery per card in the final SELECT.
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

  -- Keep whichever previously-shown high candidates are still in today's
  -- pool (not yet swiped away) -- refreshing must not grant MORE highs than
  -- the tier's daily quota.
  SELECT COALESCE(ARRAY_AGG(id), ARRAY[]::UUID[]) INTO v_kept_high
  FROM unnest(v_state.high_shown_ids) id
  WHERE id IN (SELECT match_user_id FROM tmp_pool);

  v_high_count := COALESCE(array_length(v_kept_high, 1), 0);

  -- Cold-start band fallback: 80-100 first, then widen to 70-79, then 60-69,
  -- before ever giving up and leaving the quota unfilled.
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

  -- AstroX "Top Match of the Day": reuse whatever get_my_daily_pick already
  -- pinned for today rather than recomputing a possibly-different top
  -- candidate here -- one source of truth shared with Daily Insights.
  IF v_wants_top THEN
    SELECT picked_user_id INTO v_top_match_id
    FROM public.daily_picks
    WHERE user_id = v_user_id AND pick_date = CURRENT_DATE;
  END IF;

  -- Remainder: everyone not already claimed by the high slots, Medium
  -- preferred over Low, shuffled within preference so the deck doesn't feel
  -- mechanically sorted.
  -- Excludes final_match_score >= 80 outright (not just v_final_high) --
  -- otherwise an excess true-high candidate beyond the tier's quota leaks
  -- into the deck through the ordinary remainder fill (it scores >= 50, so
  -- the preference ordering below would happily place it) and shows up
  -- labeled band='high' anyway, silently defeating the whole quota.
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

  -- Spread high-band cards through the stack instead of leading with them --
  -- never position 1, so the tier's guaranteed match lands with more impact
  -- than it would opening the deck.
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
        -- Section 3: Free = total score only. Sub-scores are the paid
        -- "Compatibility breakdown" feature -- null them out rather than
        -- ship the full 45/45/10 split to a client that isn't paying for it.
        'personality_score',  CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.personality_score END,
        'indian_score',       CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.indian_score END,
        'western_score',      CASE WHEN v_plan_slug = 'free' THEN NULL ELSE p.western_score END,
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

  -- Upsell count is deliberately restricted to GENUINE 80-100 candidates,
  -- excluding any 60-79 band-widened stand-ins used to fill the quota --
  -- the locked-slot copy ("N more excellent matches today") must stay
  -- factually true, never count a cold-start consolation pick as "excellent".
  SELECT COUNT(*) INTO v_true_high_pool_ct FROM tmp_pool WHERE final_match_score >= 80;
  SELECT COUNT(*) INTO v_true_high_shown_ct
  FROM unnest(v_final_high) id
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
      'more_high_locked_count', GREATEST(v_true_high_pool_ct - v_true_high_shown_ct, 0)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_discover_deck() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_discover_deck() TO authenticated;
