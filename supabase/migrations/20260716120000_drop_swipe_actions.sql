-- ============================================================================
-- DROP ORPHANED TABLE: swipe_actions
-- ============================================================================
-- This table is confirmed dead code. Nothing reads or writes it.
-- record_swipe_idempotent uses user_likes (with action_type='dislike' for passes).
-- ============================================================================

DROP TABLE IF EXISTS public.swipe_actions;
