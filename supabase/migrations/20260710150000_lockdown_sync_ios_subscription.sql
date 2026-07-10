-- ============================================================================
-- sync_ios_subscription(entitlement_id text) takes a client-supplied string
-- and, with no receipt/signature verification of any kind, activates a real
-- paid subscription for auth.uid() -- confirmed live and GRANTed to
-- `authenticated` (and even `anon`, though anon fails the auth.uid() IS NULL
-- check). Any signed-up user can call
-- supabase.rpc('sync_ios_subscription', {entitlement_id: 'astro_x'}) directly
-- right now and get free AstroX access (unlimited swipes, 50%+ high matches,
-- full compatibility breakdown) with no purchase. Nothing in src/ currently
-- calls this RPC (the real RevenueCat webhook + purchase flow, plan Day 14/17,
-- hasn't been built yet), so it isn't reachable through the app's own UI --
-- but it IS reachable directly by anyone with a valid session today, so this
-- can't wait for the full webhook to be built. Lock it to service_role only
-- until a real server-side RevenueCat webhook (verifying the purchase before
-- calling this, or an equivalent) replaces the client-trust path.
-- ============================================================================
REVOKE ALL ON FUNCTION public.sync_ios_subscription(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ios_subscription(TEXT) TO service_role;
