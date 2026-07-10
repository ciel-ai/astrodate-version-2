-- ============================================================================
-- Supabase's built-in security advisor (`supabase db advisors --linked`)
-- flagged this as an ERROR (the only real app-table one, alongside the
-- harmless PostGIS `spatial_ref_sys`): RLS was never enabled on
-- ai_usage_tracking, and it was grant-open to anon and authenticated
-- ("GRANT ALL ... TO anon/authenticated" in the live schema dump). Since
-- there's no RLS, that grant is fully live -- any request carrying just the
-- public anon key, no login at all, could SELECT/INSERT/UPDATE/DELETE any
-- row: read every user's AI usage history, or reset/corrupt their rate-limit
-- counters directly via PostgREST.
--
-- The only legitimate writer is increment_ai_usage(), a SECURITY DEFINER
-- function which bypasses RLS entirely when invoked (Postgres semantics), so
-- it keeps working unaffected. There's no legitimate reason for any client
-- (anon or authenticated) to touch this table directly -- lock it down to
-- service_role only, same as compute-synastry's write path on
-- synastry_cache_details.
-- ============================================================================
ALTER TABLE public.ai_usage_tracking ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_usage_tracking FROM anon, authenticated;

DROP POLICY IF EXISTS "Service role only" ON public.ai_usage_tracking;
CREATE POLICY "Service role only"
  ON public.ai_usage_tracking
  FOR ALL
  USING (auth.role() = 'service_role');
