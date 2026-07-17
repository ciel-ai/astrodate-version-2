-- ============================================================================
-- register_push_token / revoke_push_token were locked to service_role-only
-- by 20260710160000_function_grant_lockdown.sql, six days before the actual
-- push-notification client (src/lib/push-notifications.ts, commit d33970c)
-- was written to call them directly as the signed-in user. Same
-- "lockdown migration outlives the feature that needs it" pattern already
-- found and fixed for get_my_membership/cancel_my_subscription
-- (20260713120000) and get_blocked_user_ids (20260716140000) -- this is the
-- third recurrence, and the most severe: with register_push_token
-- unreachable, no real user has ever successfully written a row to
-- user_push_tokens, so the entire push pipeline (triggers, cron jobs, the
-- send-push-notification edge function) has had nothing to actually send to.
--
-- Both functions are SECURITY DEFINER and self-scoped via auth.uid() for
-- every read/write, so granting to authenticated is safe -- same reasoning
-- as every prior re-grant in this series.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.register_push_token(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_push_token(text, text) TO authenticated;
