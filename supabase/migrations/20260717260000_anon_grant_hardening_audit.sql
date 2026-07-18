-- ============================================================================
-- Anon-grant hardening audit, run while verifying the migration chain after
-- the get_fallback_feed anon leak (20260717190000). A full sweep of every
-- SECURITY DEFINER function in public against has_function_privilege('anon',
-- ..., 'EXECUTE') turned up more gaps than just get_fallback_feed:
--
-- 1. [Real, currently-exploitable leak] is_deck_eligible(p_viewer_id,
--    p_candidate_id) takes explicit UUIDs with NO auth.uid() guard at all --
--    unlike every self-protected RPC in this codebase, it doesn't even
--    require the caller to be logged in, let alone be p_viewer_id. Anyone
--    with the anon key could pass any two user IDs and learn whether they'd
--    be mutually eligible to match -- a real signal leak (reveals block
--    status, rough age-bracket/gender-preference compatibility) for
--    arbitrary pairs. grep across src/ found zero client call sites, so this
--    was never even used -- it's being locked to authenticated/service_role
--    rather than removed, since deleting an unreferenced function the wrong
--    session might still depend on is a bigger risk than an extra grant.
--
-- 2. [Hygiene gap, not directly exploitable] get_my_blocked_users(),
--    unblock_user(), spend_subscription_reveal(), rewind_last_swipe(), and
--    update_notification_preferences()'s 7-arg overload were all missing the
--    explicit `REVOKE ALL ... FROM PUBLIC, anon` this codebase's every other
--    migration carries -- so they defaulted to Postgres's implicit PUBLIC
--    EXECUTE. Each one already self-guards with `IF auth.uid() IS NULL THEN
--    RAISE EXCEPTION`, so an anon caller was never able to actually do
--    anything with the grant -- but it's the exact "arity change loses the
--    lockdown" failure mode this codebase has hit before (see
--    update_notification_preferences' own history:
--    20260714120000_notification_engagement_tiers.sql changed its arg count,
--    which in Postgres creates a distinct function object the original
--    REVOKE never touched). Closing it now rather than relying solely on the
--    auth.uid() check to keep holding.
--
-- NOT touched here: check_auth_user_exists/check_phone_exists are real,
-- load-bearing pre-login RPCs (src/app/create-account.tsx,
-- src/app/login.tsx both call check_auth_user_exists before a session
-- exists), so anon access is intentional. They currently return the actual
-- auth.users.id and created_at for a phone match, though both client call
-- sites only ever check `.length > 0` -- narrowing the return shape to a
-- bare boolean is a real hardening opportunity, deliberately left for a
-- separate, carefully-tested change rather than bundled into this audit.
-- check_message_moderation_backstop/enqueue_like_push_notification are
-- trigger functions (Postgres refuses to invoke a trigger function outside
-- trigger context), so anon EXECUTE on them is inert.
-- ============================================================================

REVOKE ALL ON FUNCTION public.is_deck_eligible(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_deck_eligible(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_my_blocked_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_blocked_users() TO authenticated;

REVOKE ALL ON FUNCTION public.unblock_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.spend_subscription_reveal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_subscription_reveal(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.rewind_last_swipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewind_last_swipe() TO authenticated;

REVOKE ALL ON FUNCTION public.update_notification_preferences(
  boolean, boolean, boolean, time, time, boolean, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(
  boolean, boolean, boolean, time, time, boolean, text
) TO authenticated;
