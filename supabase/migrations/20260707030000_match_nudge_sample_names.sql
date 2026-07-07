-- ============================================================================
-- get_todays_match_nudge — add sample_names alongside sample_user_ids
-- ----------------------------------------------------------------------------
-- The frontend match-nudge banner needs a display name per sample candidate
-- for its avatar-initials placeholder (this app has no real photo-URL
-- rendering anywhere yet — every existing avatar, e.g. profile-card.tsx and
-- discover-card.tsx, is an initials placeholder, so the banner follows the
-- same convention rather than introducing a new photo/signed-URL path).
--
-- get_fallback_feed already returns full_name per candidate (it's
-- SECURITY DEFINER and bypasses RLS internally) — no relationship-scoped RPC
-- like get_users_display_info would work here, since Discover-pool candidates
-- are, by definition, not yet matched or liked. So this just carries
-- full_name through the same ARRAY_AGG/slice already used for sample_user_ids,
-- in the same order, instead of adding a second lookup.
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_todays_match_nudge(UUID, INTEGER);
CREATE OR REPLACE FUNCTION public.get_todays_match_nudge(
  input_user_id UUID,
  p_sample_size INTEGER DEFAULT 3
)
RETURNS TABLE(
  day_ruler_sign TEXT,
  favored_sign TEXT,
  match_count BIGINT,
  sample_user_ids UUID[],
  sample_names TEXT[]
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
  v_sample_names   TEXT[];
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

  WITH pool_signs AS (
    SELECT
      f.western_sign,
      COUNT(*) AS sign_match_count,
      (ARRAY_AGG(f.match_user_id ORDER BY f.final_match_score DESC))[1:GREATEST(p_sample_size, 0)] AS sample_ids,
      (ARRAY_AGG(f.full_name ORDER BY f.final_match_score DESC))[1:GREATEST(p_sample_size, 0)] AS sample_names
    FROM public.get_fallback_feed(input_user_id) f
    WHERE f.western_sign IS NOT NULL
    GROUP BY f.western_sign
  )
  SELECT ps.western_sign, ps.sign_match_count, ps.sample_ids, ps.sample_names
  INTO v_favored_sign, v_match_count, v_sample_ids, v_sample_names
  FROM pool_signs ps
  JOIN public.western_compatibility_cache wcc
    ON wcc.sign_a = v_day_ruler_sign AND wcc.sign_b = ps.western_sign
  ORDER BY wcc.compatibility_score_45 DESC
  LIMIT 1;

  RETURN QUERY SELECT
    v_day_ruler_sign,
    v_favored_sign,
    COALESCE(v_match_count, 0::BIGINT),
    COALESCE(v_sample_ids, ARRAY[]::UUID[]),
    COALESCE(v_sample_names, ARRAY[]::TEXT[]);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_todays_match_nudge(UUID, INTEGER) TO authenticated;
