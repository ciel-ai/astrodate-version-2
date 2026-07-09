-- ============================================================================
-- Discover deck builder (build plan Day 12 / Section 6).
--
-- get_fallback_feed already returns a scored, filtered, distance-sorted
-- candidate pool -- but nothing composes that pool into a TIERED DECK per
-- Section 6: "up to N high (80-100) matches per day per tier, filling the
-- rest with next-best." Free=1/10, Astro+=12/40, AstroX=50%+pinned top match
-- (quota fields added in 20260708120000_astro_plus_pdf_quota.sql).
--
-- The one non-obvious requirement here: the quota is PER DAY, not per
-- request. A naive stateless bucket-and-fill on every call lets a user
-- pass-then-refresh repeatedly and harvest far more than their tier's daily
-- high-match allowance, since each refresh would re-run the bucketing fresh
-- against whatever's currently at the top of the (now-smaller) pool. This
-- table plus get_discover_deck's read/keep/top-up logic makes today's set of
-- "spent" high-band candidates persist across refreshes -- same upsert-by-
-- date shape as daily_like_quota/super_like_quota already in this codebase.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.discover_deck_daily_state (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  high_shown_ids UUID[] NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, deck_date)
);

ALTER TABLE public.discover_deck_daily_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own deck state" ON public.discover_deck_daily_state;
CREATE POLICY "Users manage own deck state" ON public.discover_deck_daily_state
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- get_discover_deck() -- no arguments, always the caller's own deck (learned
-- from auditing get_fallback_feed: an input_user_id parameter is one guard
-- away from a cross-user data leak; auth.uid()-only has no such surface).
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

  -- Materialize today's scored pool once; get_fallback_feed already excludes
  -- swiped/blocked users and applies age/gender/distance filters.
  CREATE TEMP TABLE tmp_pool ON COMMIT DROP AS
  SELECT * FROM public.get_fallback_feed(v_user_id);

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
        'personality_score',  p.personality_score,
        'indian_score',       p.indian_score,
        'western_score',      p.western_score
      )
      ORDER BY ord.ord
    ) FILTER (WHERE p.match_user_id IS NOT NULL),
    '[]'::jsonb
  ) INTO v_cards
  FROM unnest(v_final_order) WITH ORDINALITY AS ord(id, ord)
  LEFT JOIN tmp_pool p ON p.match_user_id = ord.id;

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


-- ============================================================================
-- record_swipe(p_target_user_id, p_action) -- Discover's like/pass/super-like
-- buttons were an unwired placeholder (see like_back_mechanic.sql's own
-- comment: "Discover's like button is still an unwired placeholder"). Reuses
-- the exact match-creation convention like_back already established
-- (LEAST/GREATEST-ordered pair, 'match_<user1>_<user2>' channel_id, ON
-- CONFLICT ON CONSTRAINT user_matches_unique) rather than a second,
-- divergent implementation of "how a match gets created."
--
-- p_action is 'like' | 'pass' | 'super_like'. Every swipe (including a pass)
-- spends from the tier's daily swipe budget (consume_like/daily_likes --
-- Section 3's "Daily swipes" row covers all swipes, not just likes);
-- super_like additionally spends from its own separate weekly quota, and is
-- pre-checked (not just consumed) so a pass/like never gets half-charged if
-- the super-like leg fails.
-- ============================================================================
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
