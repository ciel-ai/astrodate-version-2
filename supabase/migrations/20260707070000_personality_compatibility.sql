-- ============================================================================
-- Personality 10 scoring (build plan Section 5).
--
-- Six weighted factors combined into a 0-100% compatibility, then scaled to
-- the /10 point slot that feeds the overall 45/45/10 match score:
--   Shared interests & hobbies   25%  Jaccard over hobbies + date-type tags
--   Personality traits           20%  ordinal-spectrum distance (avg of 5 Qs)
--   Relationship goals           20%  lookup table on section1_qns.looking_for
--   Lifestyle compatibility      15%  ordinal-spectrum distance (avg of 5 Qs)
--   Communication style          10%  ordinal + categorical (avg of 5 Qs)
--   Values & beliefs             10%  NOT collected by this app's onboarding
--                                      today -> always absent, always dropped
--
-- Per the plan's worked example, any factor with no data for the pair
-- (Values & beliefs always, others only if a user skipped every question
-- behind it) is excluded and the remaining weights renormalized:
--   Compatibility% = Σ(factor% × weight) ÷ Σ(weight of present factors)
-- This is implemented generically in get_personality_compatibility rather
-- than special-cased, so a future "values" question slots in automatically.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- personality_ordinal_match: position-distance on a defined answer spectrum.
-- Adjacent answers score high, opposite ends score low. NULL if either value
-- is missing or not found on the spectrum (e.g. a non-ordinal wildcard like
-- 'depends_on_mood') -- callers skip NULLs and renormalize among the rest.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personality_ordinal_match(a TEXT, b TEXT, spectrum TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pos_a INT;
  pos_b INT;
  n INT := array_length(spectrum, 1);
BEGIN
  IF a IS NULL OR b IS NULL OR n IS NULL OR n < 2 THEN
    RETURN NULL;
  END IF;

  pos_a := array_position(spectrum, a);
  pos_b := array_position(spectrum, b);

  IF pos_a IS NULL OR pos_b IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN ROUND((1 - abs(pos_a - pos_b)::NUMERIC / (n - 1)) * 100, 2);
END;
$$;

-- ----------------------------------------------------------------------------
-- personality_categorical_match: for answer sets with no natural single-line
-- order (e.g. love-language-style choices). Exact match scores full; a
-- mismatch still gets partial credit since these are relational styles, not
-- strict opposites.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personality_categorical_match(a TEXT, b TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF a IS NULL OR b IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN CASE WHEN a = b THEN 100.00 ELSE 45.00 END;
END;
$$;

-- ----------------------------------------------------------------------------
-- personality_jaccard_match: shared tags ÷ total unique tags across two
-- text-array answers (hobbies, preferred date types, etc).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personality_jaccard_match(a TEXT[], b TEXT[])
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  set_a TEXT[];
  set_b TEXT[];
  inter_count INT;
  union_count INT;
BEGIN
  SELECT array_agg(DISTINCT x) INTO set_a FROM unnest(coalesce(a, '{}'::TEXT[])) x;
  SELECT array_agg(DISTINCT x) INTO set_b FROM unnest(coalesce(b, '{}'::TEXT[])) x;

  IF set_a IS NULL OR set_b IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO inter_count FROM unnest(set_a) x WHERE x = ANY(set_b);
  SELECT count(*) INTO union_count FROM (
    SELECT unnest(set_a) UNION SELECT unnest(set_b)
  ) u;

  IF union_count = 0 THEN
    RETURN NULL;
  END IF;

  RETURN ROUND((inter_count::NUMERIC / union_count) * 100, 2);
END;
$$;

-- ----------------------------------------------------------------------------
-- personality_goal_match: lookup table for section1_qns.looking_for.
-- Same goal = 100; adjacent/compatible goals score high-to-mid; clearly
-- opposed goals (casual vs long_term) score low, per the plan's spec.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.personality_goal_match(a TEXT, b TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  lo TEXT;
  hi TEXT;
BEGIN
  IF a IS NULL OR b IS NULL THEN
    RETURN NULL;
  END IF;
  IF a = b THEN
    RETURN 100.00;
  END IF;

  lo := LEAST(a, b);
  hi := GREATEST(a, b);

  RETURN CASE lo || '|' || hi
    WHEN 'casual|friends'                    THEN 50.00
    WHEN 'casual|long_open_short'            THEN 55.00
    WHEN 'casual|long_term'                  THEN 12.00
    WHEN 'casual|not_sure'                   THEN 50.00
    WHEN 'casual|short_open_long'            THEN 88.00
    WHEN 'friends|long_open_short'           THEN 45.00
    WHEN 'friends|long_term'                 THEN 40.00
    WHEN 'friends|not_sure'                  THEN 55.00
    WHEN 'friends|short_open_long'           THEN 45.00
    WHEN 'long_open_short|long_term'         THEN 88.00
    WHEN 'long_open_short|not_sure'          THEN 55.00
    WHEN 'long_open_short|short_open_long'   THEN 78.00
    WHEN 'long_term|not_sure'                THEN 50.00
    WHEN 'long_term|short_open_long'         THEN 55.00
    WHEN 'not_sure|short_open_long'          THEN 55.00
    ELSE 50.00
  END;
END;
$$;

-- ----------------------------------------------------------------------------
-- get_personality_compatibility(user_a, user_b)
-- Computes the Personality 10 score for a pair from their stored onboarding
-- answers (section1_qns + personality_qns). Pure computation, no external
-- API, so it is cheap enough to run on demand rather than cache -- unlike
-- Western/Indian/synastry which call a paid astrology API.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_personality_compatibility(p_user_a UUID, p_user_b UUID)
RETURNS TABLE (
  compatibility_percent NUMERIC,
  personality_points    NUMERIC,
  factor_breakdown      JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s1_a public.section1_qns%ROWTYPE;
  s1_b public.section1_qns%ROWTYPE;
  pq_a public.personality_qns%ROWTYPE;
  pq_b public.personality_qns%ROWTYPE;

  v_hobbies_match     NUMERIC;

  v_traits_scores     NUMERIC[] := '{}';
  v_traits_match      NUMERIC;

  v_goals_match       NUMERIC;

  v_lifestyle_scores  NUMERIC[] := '{}';
  v_lifestyle_match   NUMERIC;

  v_comm_scores       NUMERIC[] := '{}';
  v_comm_match        NUMERIC;

  v_weight_sum        NUMERIC := 0;
  v_score_sum         NUMERIC := 0;
  v_score             NUMERIC;
  v_breakdown         JSONB := '{}'::JSONB;

  FACTOR_HOBBIES_WEIGHT   CONSTANT NUMERIC := 25;
  FACTOR_TRAITS_WEIGHT    CONSTANT NUMERIC := 20;
  FACTOR_GOALS_WEIGHT     CONSTANT NUMERIC := 20;
  FACTOR_LIFESTYLE_WEIGHT CONSTANT NUMERIC := 15;
  FACTOR_COMM_WEIGHT      CONSTANT NUMERIC := 10;
BEGIN
  SELECT * INTO s1_a FROM public.section1_qns WHERE user_id = p_user_a;
  SELECT * INTO s1_b FROM public.section1_qns WHERE user_id = p_user_b;
  SELECT * INTO pq_a FROM public.personality_qns WHERE user_id = p_user_a;
  SELECT * INTO pq_b FROM public.personality_qns WHERE user_id = p_user_b;

  -- Factor 1: Shared interests & hobbies (Jaccard over hobbies + date-type tags)
  v_hobbies_match := public.personality_jaccard_match(
    coalesce(s1_a.hobbies, '{}') || coalesce(pq_a.what_type_of_date_excites_you_the_most, '{}'),
    coalesce(s1_b.hobbies, '{}') || coalesce(pq_b.what_type_of_date_excites_you_the_most, '{}')
  );
  IF v_hobbies_match IS NOT NULL THEN
    v_weight_sum := v_weight_sum + FACTOR_HOBBIES_WEIGHT;
    v_score_sum := v_score_sum + v_hobbies_match * FACTOR_HOBBIES_WEIGHT;
    v_breakdown := v_breakdown || jsonb_build_object('hobbies', v_hobbies_match);
  END IF;

  -- Factor 2: Personality traits (avg of 5 ordinal sub-items)
  v_traits_scores := array_remove(ARRAY[
    public.personality_ordinal_match(s1_a.introvert_extrovert, s1_b.introvert_extrovert,
      ARRAY['introvert', 'ambivert', 'extrovert']),
    public.personality_ordinal_match(pq_a.your_energy_level_on_dates_is_usually, pq_b.your_energy_level_on_dates_is_usually,
      ARRAY['calm', 'balanced', 'energetic', 'excitement']),
    public.personality_ordinal_match(pq_a.how_do_you_handle_emotional_ups_and_downs, pq_b.how_do_you_handle_emotional_ups_and_downs,
      ARRAY['rarely_stressed', 'handle_okay', 'emotional_sometimes', 'feel_deeply']),
    public.personality_ordinal_match(pq_a.how_often_do_you_overthink_relationships, pq_b.how_often_do_you_overthink_relationships,
      ARRAY['almost_never', 'occasionally', 'quite_often', 'all_time']),
    public.personality_ordinal_match(pq_a.you_prefer_a_partner_who_is, pq_b.you_prefer_a_partner_who_is,
      ARRAY['introverted', 'balanced', 'outgoing', 'social_lively'])
  ], NULL);
  IF array_length(v_traits_scores, 1) > 0 THEN
    SELECT avg(x) INTO v_traits_match FROM unnest(v_traits_scores) x;
    v_weight_sum := v_weight_sum + FACTOR_TRAITS_WEIGHT;
    v_score_sum := v_score_sum + v_traits_match * FACTOR_TRAITS_WEIGHT;
    v_breakdown := v_breakdown || jsonb_build_object('personality_traits', ROUND(v_traits_match, 2));
  END IF;

  -- Factor 3: Relationship goals (lookup on looking_for)
  v_goals_match := public.personality_goal_match(s1_a.looking_for, s1_b.looking_for);
  IF v_goals_match IS NOT NULL THEN
    v_weight_sum := v_weight_sum + FACTOR_GOALS_WEIGHT;
    v_score_sum := v_score_sum + v_goals_match * FACTOR_GOALS_WEIGHT;
    v_breakdown := v_breakdown || jsonb_build_object('relationship_goals', v_goals_match);
  END IF;

  -- Factor 4: Lifestyle compatibility (avg of 5 ordinal sub-items)
  v_lifestyle_scores := array_remove(ARRAY[
    public.personality_ordinal_match(pq_a.what_best_describes_your_planning_style, pq_b.what_best_describes_your_planning_style,
      ARRAY['flow', 'plan_little', 'organise', 'mini_project']),
    public.personality_ordinal_match(pq_a.how_do_you_handle_commitments_in_a_relationship, pq_b.how_do_you_handle_commitments_in_a_relationship,
      ARRAY['forget_sometimes', 'try_remember', 'responsible_steady', 'no_excuses']),
    public.personality_ordinal_match(pq_a.your_room_or_workspace_usually_looks_like, pq_b.your_room_or_workspace_usually_looks_like,
      ARRAY['disaster', 'manageable', 'clean', 'pinterest']),
    public.personality_ordinal_match(pq_a.your_ideal_way_to_spend_time_with_a_partner, pq_b.your_ideal_way_to_spend_time_with_a_partner,
      ARRAY['chill_home', 'quiet_date', 'fun_activities', 'social_friends']),
    public.personality_ordinal_match(pq_a.how_do_you_feel_about_trying_unusual_foods_or_activities, pq_b.how_do_you_feel_about_trying_unusual_foods_or_activities,
      ARRAY['stick_known', 'try_encouraged', 'open_to_it', 'suggest_crazy'])
  ], NULL);
  IF array_length(v_lifestyle_scores, 1) > 0 THEN
    SELECT avg(x) INTO v_lifestyle_match FROM unnest(v_lifestyle_scores) x;
    v_weight_sum := v_weight_sum + FACTOR_LIFESTYLE_WEIGHT;
    v_score_sum := v_score_sum + v_lifestyle_match * FACTOR_LIFESTYLE_WEIGHT;
    v_breakdown := v_breakdown || jsonb_build_object('lifestyle', ROUND(v_lifestyle_match, 2));
  END IF;

  -- Factor 5: Communication style (avg of 3 ordinal + 2 categorical sub-items)
  v_comm_scores := array_remove(ARRAY[
    public.personality_ordinal_match(pq_a.what_kind_of_conversations_do_you_enjoy_with_a_partner, pq_b.what_kind_of_conversations_do_you_enjoy_with_a_partner,
      ARRAY['everyday_talks', 'life_related', 'deep_chats', 'creative_brainstorm']),
    public.personality_ordinal_match(pq_a.during_arguments_you_usually, pq_b.during_arguments_you_usually,
      ARRAY['avoid_talking', 'calm_discuss', 'understand_view', 'solve_patience']),
    public.personality_ordinal_match(pq_a.when_your_partner_replies_late_you_feel, pq_b.when_your_partner_replies_late_you_feel,
      ARRAY['totally_fine', 'slightly_curious', 'overthinking', 'very_anxious']),
    public.personality_categorical_match(pq_a.how_do_you_show_care_in_a_relationship, pq_b.how_do_you_show_care_in_a_relationship),
    public.personality_categorical_match(pq_a.what_kind_of_partner_are_you, pq_b.what_kind_of_partner_are_you)
  ], NULL);
  IF array_length(v_comm_scores, 1) > 0 THEN
    SELECT avg(x) INTO v_comm_match FROM unnest(v_comm_scores) x;
    v_weight_sum := v_weight_sum + FACTOR_COMM_WEIGHT;
    v_score_sum := v_score_sum + v_comm_match * FACTOR_COMM_WEIGHT;
    v_breakdown := v_breakdown || jsonb_build_object('communication', ROUND(v_comm_match, 2));
  END IF;

  -- Factor 6: Values & beliefs -- no such question exists in this app's
  -- onboarding today, so it is always absent and its weight always drops out
  -- of v_weight_sum, exactly like the plan's worked example.

  IF v_weight_sum = 0 THEN
    RETURN QUERY SELECT NULL::NUMERIC, NULL::NUMERIC, v_breakdown;
    RETURN;
  END IF;

  v_score := ROUND(v_score_sum / v_weight_sum, 2);

  RETURN QUERY SELECT v_score, ROUND(v_score * 0.10, 2), v_breakdown;
END;
$$;

COMMENT ON FUNCTION public.get_personality_compatibility(UUID, UUID) IS
  'Personality 10 score (build plan Section 5): 6 weighted factors from section1_qns + personality_qns, renormalized over present factors, scaled to /10.';
