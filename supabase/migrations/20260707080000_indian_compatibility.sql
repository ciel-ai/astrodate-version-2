-- ============================================================================
-- Indian 45 scoring (build plan Section 4/7A): Ashtakoota Guna Milan /36,
-- scaled to /45, plus Manglik / Nadi / Bhakoot dosha flags surfaced as
-- context (build plan Section 6).
--
-- The Ashtakoota computation itself already exists: the compute-synastry
-- Edge Function calls the astrology API's match_making_detailed_report and
-- caches ashtakoota_score/ashtakoota_detail on synastry_cache_details. This
-- migration does NOT duplicate that pipeline -- it (a) adds the one piece it
-- was missing (Manglik dosha, silently dropped today) and (b) adds a clean
-- accessor, get_indian_compatibility, for the score aggregator to call,
-- mirroring get_personality_compatibility's shape.
--
-- Note: unlike Personality 10, this factor depends on an external API call
-- that only runs when compute-synastry is invoked (today: reactively, when a
-- user opens a synastry detail screen -- there is no automatic prewarm of
-- the Edge Function itself, only of the SQL-only planet scores via
-- process_synastry_prewarm_job). So get_indian_compatibility will return
-- computed = false for most candidate pairs until that's triggered. The
-- deck builder / aggregator (next piece of work) needs to treat that as
-- "not yet available" and fall back gracefully, same as any other cold-start
-- case -- it is not something this migration can fix on its own.
-- ============================================================================

ALTER TABLE public.synastry_cache_details
  ADD COLUMN IF NOT EXISTS manglik_status BOOLEAN,
  ADD COLUMN IF NOT EXISTS manglik_male_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS manglik_female_percentage NUMERIC(5,2);

COMMENT ON COLUMN public.synastry_cache_details.manglik_status IS
  'Manglik dosha flag from match_making_detailed_report -- populated by compute-synastry alongside ashtakoota_score.';

-- ----------------------------------------------------------------------------
-- get_indian_compatibility(user_a, user_b)
-- Reads the cached Ashtakoota result (written by compute-synastry) and
-- scales it into the /45 slot. Returns computed = false (all score fields
-- NULL) when the pair hasn't been computed yet or the cache is stale --
-- callers must not treat that as a score of 0.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_indian_compatibility(p_user_a UUID, p_user_b UUID)
RETURNS TABLE (
  computed         BOOLEAN,
  guna_score       NUMERIC,
  indian_percent   NUMERIC,
  indian_points    NUMERIC,
  manglik_status   BOOLEAN,
  nadi_dosha       BOOLEAN,
  bhakoot_dosha    BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_cached public.synastry_cache_details%ROWTYPE;
  v_nadi_points NUMERIC;
  v_bhakut_points NUMERIC;
BEGIN
  IF p_user_a < p_user_b THEN
    v_a := p_user_a; v_b := p_user_b;
  ELSE
    v_a := p_user_b; v_b := p_user_a;
  END IF;

  SELECT * INTO v_cached
  FROM public.synastry_cache_details
  WHERE user_a_id = v_a AND user_b_id = v_b;

  IF NOT FOUND OR v_cached.ashtakoota_score IS NULL OR v_cached.is_stale THEN
    RETURN QUERY SELECT false, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::BOOLEAN, NULL::BOOLEAN, NULL::BOOLEAN;
    RETURN;
  END IF;

  v_nadi_points := (v_cached.ashtakoota_detail #>> '{nadi,received_points}')::NUMERIC;
  v_bhakut_points := (v_cached.ashtakoota_detail #>> '{bhakut,received_points}')::NUMERIC;

  RETURN QUERY SELECT
    true,
    v_cached.ashtakoota_score,
    ROUND(v_cached.ashtakoota_score / 36 * 100, 2),
    ROUND(v_cached.ashtakoota_score / 36 * 45, 2),
    v_cached.manglik_status,
    (v_nadi_points IS NOT NULL AND v_nadi_points = 0),
    (v_bhakut_points IS NOT NULL AND v_bhakut_points = 0);
END;
$$;

COMMENT ON FUNCTION public.get_indian_compatibility(UUID, UUID) IS
  'Indian 45 score (build plan Section 4): Ashtakoota Guna Milan /36 scaled to /45, from the synastry_cache_details row written by compute-synastry. computed=false means not yet run for this pair.';
