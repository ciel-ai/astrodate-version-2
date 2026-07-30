-- ============================================================================
-- astro-geo cost efficiency: cache place-name search results
-- ============================================================================
-- astro-geo's 'search' mode (place-of-birth autocomplete) hit the paid
-- Astrology API's geo_details endpoint on every debounced keystroke with zero
-- caching. Place names repeat heavily across a user base (many people typing
-- "Mumbai", "New York", "London", ...), so a shared cache keyed on the
-- normalized query string eliminates the large majority of those calls after
-- the first person ever searches a given place. Results are static (a place's
-- geonames coordinates don't change), so no TTL/expiry is needed.
--
-- No RLS-with-client-access needed -- only the astro-geo edge function
-- (service role) ever reads/writes this, same shape as ai_usage_tracking.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.place_search_cache (
  query_key TEXT PRIMARY KEY,
  results JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.place_search_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.place_search_cache;
CREATE POLICY "Service role only"
  ON public.place_search_cache
  FOR ALL
  USING (auth.role() = 'service_role');

REVOKE ALL ON TABLE public.place_search_cache FROM anon, authenticated;
GRANT ALL ON TABLE public.place_search_cache TO service_role;
