-- ============================================================================
-- AstroDate — Daily Insights: cache table + saved-insights journal
-- ============================================================================
-- Replaces the never-implemented daily_nakshatra_cache / get_my_daily_insight()
-- / refresh-daily-nakshatra-cache scaffold (20260630120300_realtime_cron.sql,
-- 20260630120000_baseline_tables.sql) with a simpler lazy-caching design: the
-- new daily-insights Edge Function looks up the CALLER's own already-known
-- nakshatra (astro_details.nakshatra_name, set at onboarding), checks this
-- cache for (nakshatra, today), and only calls the Astrology API's
-- daily_nakshatra_prediction endpoint on a miss. The UNIQUE constraint below
-- plus ON CONFLICT DO NOTHING in the function makes concurrent misses for the
-- same nakshatra safe without a duplicate external call. With only 27 possible
-- nakshatras, this caps the endpoint at ~27 calls/day regardless of user count
-- — the old scaffold's proactive nightly-sweep design is dropped entirely.
-- ============================================================================


-- ============================================================================
-- Remove legacy scaffold (dead: refresh-daily-nakshatra-cache's cron job has
-- always targeted a daily-insights-refresh function that was never built, so
-- it has been failing silently every run since it was scheduled).
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_my_daily_insight();
DROP TABLE IF EXISTS public.daily_nakshatra_cache;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-daily-nakshatra-cache')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-daily-nakshatra-cache');
  END IF;
END
$$;


-- ============================================================================
-- TABLE: daily_insights_cache
-- Shared cache keyed by (nakshatra, date), NOT per-user — see header note.
-- Locked down: no SELECT/INSERT policy for authenticated/anon, so a client can
-- never read this directly or bypass the cache. Only the daily-insights Edge
-- Function (service_role) touches this table.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_insights_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nakshatra       TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  moon_sign       TEXT,
  moon_nakshatra  TEXT,
  prediction      JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (nakshatra, prediction_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_insights_cache_lookup
  ON public.daily_insights_cache (nakshatra, prediction_date);

ALTER TABLE public.daily_insights_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages daily insights cache" ON public.daily_insights_cache;
CREATE POLICY "Service role manages daily insights cache"
  ON public.daily_insights_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================================
-- TABLE: saved_insights
-- "Save to Journal" — a user's own saved daily-insight snippets. Standard
-- own-row CRUD, same pattern as user_preferences (20260630120100_rls.sql).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_insights (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category        TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_insights_user_created
  ON public.saved_insights (user_id, created_at DESC);

ALTER TABLE public.saved_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own saved insights" ON public.saved_insights;
DROP POLICY IF EXISTS "Users can insert their own saved insights" ON public.saved_insights;
DROP POLICY IF EXISTS "Users can update their own saved insights" ON public.saved_insights;
DROP POLICY IF EXISTS "Users can delete their own saved insights" ON public.saved_insights;

CREATE POLICY "Users can read their own saved insights"
  ON public.saved_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved insights"
  ON public.saved_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved insights"
  ON public.saved_insights FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved insights"
  ON public.saved_insights FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- get_current_point_for_user(p_user_id)
-- Reads the CURRENT (not birth) location from user_locations
-- (20260701120000_nearby_location.sql) for the daily-insights Edge Function's
-- planetary-hour/sunrise calculation. SECURITY DEFINER so it can read past
-- user_locations' owner-only RLS; only ever called by the Edge Function's
-- service-role client (which could bypass RLS anyway) with the caller's own
-- user_id, matching the trust model already used by compute-synastry.
-- No row returned when the user hasn't shared a location or revoked consent.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_current_point_for_user(p_user_id UUID)
RETURNS TABLE(lat DOUBLE PRECISION, lon DOUBLE PRECISION)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ST_Y(geog::geometry), ST_X(geog::geometry)
  FROM public.user_locations
  WHERE user_id = p_user_id AND consent;
$$;
