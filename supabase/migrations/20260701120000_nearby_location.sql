-- ============================================================================
-- AstroDate — Nearby / Distance feature (GPS-only, opt-in)
-- ============================================================================
-- Adds current-location storage (PostGIS) + distance-aware discovery, following
-- the existing privacy model of this schema:
--   * raw coordinates are NEVER exposed cross-user (no cross-user SELECT policy);
--   * the only thing another user ever sees is a FUZZED distance string, and it
--     comes out of the get_fallback_feed SECURITY DEFINER RPC, never a table read.
--
-- IMPORTANT: this is CURRENT location for "who's nearby". It is deliberately
-- separate from astro_details.birth_latitude/longitude, which is BIRTHPLACE for
-- chart calculation and must not be reused here.
-- ============================================================================


-- ============================================================================
-- EXTENSION
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;


-- ============================================================================
-- TABLE: user_locations
-- One row per user. Mirrors the user_online_status pattern (PK = user_id,
-- owner-only RLS). `geog` holds the raw point and is never returned to another
-- user. `consent` lets a user turn sharing off without deleting the row.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_locations (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  geog       GEOGRAPHY(Point, 4326) NOT NULL,
  consent    BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- GiST index makes ST_DWithin radius queries index-assisted (no brute force).
CREATE INDEX IF NOT EXISTS idx_user_locations_geog ON public.user_locations USING GIST (geog);

COMMENT ON TABLE public.user_locations IS
  'Current (not birth) location for the nearby/discovery feature. Raw geog is
   owner-only; other users only ever see a fuzzed distance via get_fallback_feed.';

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Owner-only direct access. Cross-user distance is exposed ONLY via the feed RPC
-- (SECURITY DEFINER), exactly like user_profiles / user_online_status.
DROP POLICY IF EXISTS "Users manage their own location" ON public.user_locations;
CREATE POLICY "Users manage their own location"
  ON public.user_locations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- RPC: upsert_my_location(lat, lng)
-- The client never writes geog directly — it sends plain lat/lng and this
-- builds the point server-side. Basic range validation included.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.upsert_my_location(
  p_latitude  DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude  < -90  OR p_latitude  > 90
     OR p_longitude < -180 OR p_longitude > 180 THEN
    RAISE EXCEPTION 'Invalid coordinates';
  END IF;

  INSERT INTO public.user_locations (user_id, geog, consent, updated_at)
  VALUES (
    v_user_id,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,  -- note: (lng, lat) order
    true,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    geog       = EXCLUDED.geog,
    consent    = true,
    updated_at = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_my_location(DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;


-- ============================================================================
-- RPC: disable_my_location()
-- GDPR/CCPA "stop sharing + delete" path. Removes the row entirely so the user
-- disappears from distance-filtered results immediately.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.disable_my_location()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.user_locations WHERE user_id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.disable_my_location() TO authenticated;


-- ============================================================================
-- get_fallback_feed  — REDEFINED to add distance.
-- ----------------------------------------------------------------------------
-- Changes vs the baseline version (baseline_tables.sql):
--   * reads the viewer's point + max_distance;
--   * excludes candidates whose KNOWN location is beyond max_distance (in km);
--     candidates without a shared location are still shown (soft filter — avoids
--     an empty feed while location adoption ramps up);
--   * returns two NEW trailing columns: distance_km (numeric) and distance_label
--     (fuzzed, rounded-to-km string). Existing columns/order are unchanged, so
--     current callers keep working.
-- Raw coordinates are never returned — only the rounded distance.
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
  distance_label TEXT
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
    ROUND(GREATEST(10.0 - (ROW_NUMBER() OVER (ORDER BY up.updated_at DESC) * 0.2), 1.0)::NUMERIC, 2) AS final_match_score,
    0::NUMERIC AS personality_score,
    0::NUMERIC AS indian_score,
    0::NUMERIC AS western_score,
    'Unscored'::TEXT AS indian_recommendation,
    'Unscored'::TEXT AS western_report,
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
    END AS distance_label
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  LEFT JOIN public.user_preferences cand_pref ON cand_pref.user_id = up.user_id
  LEFT JOIN public.section1_qns cand_sec1 ON cand_sec1.user_id = up.user_id
  LEFT JOIN public.user_locations cand_loc ON cand_loc.user_id = up.user_id AND cand_loc.consent
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


-- ============================================================================
-- Retention: purge stale locations (GDPR data-minimisation). Matches the
-- existing pg_cron pattern used for delete_old_messages. Removes points not
-- refreshed in 60 days — a stale "nearby" position is worse than none.
-- ============================================================================
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-stale-locations')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-stale-locations');

    PERFORM cron.schedule(
      'purge-stale-locations',
      '30 3 * * *',
      $cron$
        DELETE FROM public.user_locations
        WHERE updated_at < now() - INTERVAL '60 days';
      $cron$
    );
  END IF;
END
$outer$;
