-- ============================================================================
-- Security definer function grant remediation.
-- Generated from a live `supabase db advisors --linked` run against the
-- production project (frgckqxfkfjacrutcobg), which flagged ~140
-- anon/authenticated-executable SECURITY DEFINER functions. Every function
-- below was individually cross-referenced against actual call sites in
-- src/**/*.tsx and supabase/functions/**/*.ts to determine whether it's a
-- pre-auth flow, a genuine authenticated-client call, or has no client call
-- site at all (internal helper / worker / unwired feature).
--
-- Convention: Supabase grants EXECUTE to anon/authenticated/service_role
-- directly per-role, not through the PUBLIC pseudo-role -- a bare
-- "REVOKE ALL ... FROM PUBLIC" alone is a no-op; anon/authenticated must be
-- named explicitly (confirmed by this project's own prior
-- 20260708150000_fix_generate_daily_picks_grant.sql postmortem).
--
-- ============================================================================
-- CRITICAL: link_apple_identity_to_user / link_google_identity_to_user were
-- found LIVE-GRANTED to anon with no ownership check on p_user_id at all --
-- a complete, trivially exploitable account-takeover primitive. Any
-- unauthenticated caller (just the public anon key) can link THEIR OWN real,
-- verifiable Apple/Google "sub" to an ARBITRARY victim user_id. The next
-- time they sign in with that same real Apple/Google account through the
-- app's normal native OAuth flow, Supabase's identity lookup finds it linked
-- to the victim and logs them in as the victim -- full account takeover,
-- zero interaction from the victim required. This contradicts the
-- function's own original migration
-- (20260630120000_baseline_tables.sql:1070-1071, 1125-1126), which already
-- restricted both to service_role only -- the live grants had drifted from
-- that documented intent. This fix restores it.
--
-- CRITICAL (billing): sync_ios_subscription revoke is repeated here
-- (idempotent, already applied in 20260710150000) so this migration is a
-- complete, self-contained record of the full audit.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- BUCKET 1 -- pre-auth flows: keep anon + authenticated, no change.
--   check_auth_user_exists(text)  -- create-account.tsx / login.tsx, before session exists
--   check_phone_exists(text)      -- dead-code wrapper around the above; same exposure either way
-- No SQL needed.
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- BUCKET 2 -- app's own authenticated client calls these directly.
-- Revoke anon, keep authenticated.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_who_liked_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_who_liked_me() TO authenticated;

REVOKE ALL ON FUNCTION public.get_my_sent_likes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_sent_likes() TO authenticated;

REVOKE ALL ON FUNCTION public.spend_free_reveal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spend_free_reveal(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.like_back(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.like_back(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_likes_seen() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_likes_seen() TO authenticated;

REVOKE ALL ON FUNCTION public.upsert_my_location(double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_my_location(double precision, double precision) TO authenticated;

REVOKE ALL ON FUNCTION public.disable_my_location() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disable_my_location() TO authenticated;

REVOKE ALL ON FUNCTION public.enqueue_synastry_prewarm(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_synastry_prewarm(uuid) TO authenticated;


-- ----------------------------------------------------------------------------
-- BUCKET 3 -- no client call site (src/ or supabase/functions/): internal
-- composition helpers, worker/cron RPCs, trigger functions, or self-scoped
-- endpoints not yet wired into any screen. Revoke anon AND authenticated;
-- service_role only.
-- ----------------------------------------------------------------------------

-- confirmed edge-function / cron callers (service-role key, unaffected)
REVOKE ALL ON FUNCTION public.get_current_point_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_point_for_user(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.claim_synastry_prewarm_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_synastry_prewarm_jobs(integer) TO service_role;

REVOKE ALL ON FUNCTION public.process_synastry_prewarm_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_synastry_prewarm_job(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.refresh_synastry_prewarm_queue() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_synastry_prewarm_queue() TO service_role;

-- internal scoring/composition helpers: called only from inside other
-- SECURITY DEFINER functions (owner-level call, unaffected by this revoke).
-- Also closes a real privacy gap: none check caller ownership of either
-- user_a/user_b argument today, so anyone could otherwise read two
-- strangers' compatibility breakdown directly.
REVOKE ALL ON FUNCTION public.get_western_compatibility(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_western_compatibility(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_indian_compatibility(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_indian_compatibility(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_personality_compatibility(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_personality_compatibility(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_match_score(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_match_score(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_sign_compatibility(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_sign_compatibility(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.get_synastry_detail(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_synastry_detail(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_astro_for_ranking(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_astro_for_ranking(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_signal_score(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_signal_score(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.synastry_location_priority(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.synastry_location_priority(text, text) TO service_role;

-- no-ownership-check integrity/DoS risk if ever client-exposed as-is; needs
-- an auth.uid() guard added before any future re-grant to authenticated.
REVOKE ALL ON FUNCTION public.record_signal(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_signal(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.increment_ai_usage(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.consume_like(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_like(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.consume_super_like(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_super_like(uuid) TO service_role;

-- self-scoped (auth.uid()) or relationship-guarded, safe design, simply not
-- wired into any screen yet. Safe to re-grant EXECUTE TO authenticated the
-- moment the corresponding feature ships -- no code changes needed for these.
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_my_subscription() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_subscription() TO service_role;

REVOKE ALL ON FUNCTION public.get_blocked_user_ids() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_blocked_user_ids() TO service_role;

REVOKE ALL ON FUNCTION public.get_likes_remaining(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_likes_remaining(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_super_likes_remaining(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_super_likes_remaining(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_my_daily_pick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_daily_pick() TO service_role;

REVOKE ALL ON FUNCTION public.get_my_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_membership() TO service_role;

REVOKE ALL ON FUNCTION public.get_user_display_name(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_user_presence(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_presence(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.get_matched_user_presence(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_matched_user_presence(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.get_users_display_info(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_display_info(uuid[]) TO service_role;

-- no ownership/relationship check at all (unlike its siblings above) --
-- needs a guard before ever being re-granted to authenticated.
REVOKE ALL ON FUNCTION public.get_user_photos_batch(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_photos_batch(uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.register_push_token(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_push_token(text, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.revoke_push_token(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_push_token(text, text) TO service_role;

REVOKE ALL ON FUNCTION public.update_notification_preferences(boolean, boolean, boolean, time without time zone, time without time zone) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_notification_preferences(boolean, boolean, boolean, time without time zone, time without time zone) TO service_role;

-- unscoped maintenance/worker jobs
REVOKE ALL ON FUNCTION public.delete_old_messages() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_old_messages() TO service_role;

REVOKE ALL ON FUNCTION public.claim_notification_delivery_logs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery_logs(integer) TO service_role;

-- CRITICAL: account-takeover primitive -- see header. Restores the original
-- migration's documented service_role-only intent.
REVOKE ALL ON FUNCTION public.link_apple_identity_to_user(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_apple_identity_to_user(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.link_google_identity_to_user(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_google_identity_to_user(uuid, text, text) TO service_role;

-- pure trigger functions (RETURNS trigger): cannot be invoked via RPC
-- regardless of grants. Hygiene-only, silences the advisor.
REVOKE ALL ON FUNCTION public.mark_synastry_cache_stale_for_astro_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_synastry_cache_stale_for_astro_change() TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_match_push_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_match_push_notifications() TO service_role;

REVOKE ALL ON FUNCTION public.enqueue_message_push_notification() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_message_push_notification() TO service_role;

-- CRITICAL / billing: repeated here idempotently (see 20260710150000).
REVOKE ALL ON FUNCTION public.sync_ios_subscription(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ios_subscription(text) TO service_role;


-- ----------------------------------------------------------------------------
-- OUT OF SCOPE -- not touched by this migration:
--   public.st_estimatedextent(...)  -- PostGIS extension builtin, not
--   application code, no user data involved.
-- ----------------------------------------------------------------------------
