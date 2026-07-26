-- get_super_likes_remaining lost its `authenticated` grant in the blanket
-- service_role-only lockdown (20260710160000_function_grant_lockdown.sql)
-- and no later migration restored it, even though 20260713120000 re-defined
-- the function body. record_swipe/rewind_last_swipe still work because they
-- call it as a plain SQL function call inside their own SECURITY DEFINER
-- body, which bypasses PostgREST grants entirely -- but that also means the
-- client was never able to call this RPC directly to pre-check quota before
-- showing the Super Like button as locked, the same way get_rewinds_remaining
-- already does for Rewind.
GRANT EXECUTE ON FUNCTION public.get_super_likes_remaining(UUID) TO authenticated;
