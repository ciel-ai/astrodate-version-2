-- ============================================================================
-- Fix: 20260714120000_notification_engagement_tiers.sql's
-- update_notification_preferences() CREATE OR REPLACE added
-- p_engagement_enabled/p_timezone, but Postgres identifies a function by
-- name + argument list -- adding two params changed the arity, so
-- CREATE OR REPLACE created a SECOND overload instead of replacing the
-- original 5-arg one. Both have coexisted on the live database since that
-- migration: caught only now, while wiring the Settings screen to this RPC,
-- via `supabase gen types` emitting a union of two Args shapes instead of
-- one. Any call with a subset of params where every present key exists on
-- both overloads is ambiguous to PostgREST (PGRST203, "could not choose the
-- best candidate function").
--
-- Fix: drop the original 5-arg signature explicitly, by its exact original
-- argument types, leaving only the current 7-arg version.
-- ============================================================================
DROP FUNCTION IF EXISTS public.update_notification_preferences(
  BOOLEAN, BOOLEAN, BOOLEAN, TIME, TIME
);
