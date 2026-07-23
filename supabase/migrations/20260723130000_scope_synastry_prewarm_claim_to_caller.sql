-- ============================================================================
-- Scope synastry prewarm job claiming to the calling user
-- ============================================================================
-- process-synastry-prewarm accepts two callers: the pg_cron drain job (proves
-- itself via a scoped secret, no user_id restriction -- it's meant to drain
-- the whole queue) and a real signed-in user's JWT (the onboarding
-- fire-and-forget call in cosmic-identity.tsx, which only ever needs to warm
-- its OWN candidate pairs). claim_synastry_prewarm_jobs previously had no way
-- to express that distinction -- it always claimed the oldest jobs queue-wide
-- regardless of caller, so any authenticated user calling the edge function
-- directly could drain and trigger paid-API processing of other users' queued
-- pairs (cost-abuse, no data returned to the caller beyond a status list).
--
-- Adds an optional p_user_id filter, defaulting to NULL (preserves the cron
-- path's existing whole-queue behavior exactly). The edge function now passes
-- its own auth.uid() when called with a user JWT.
-- ============================================================================

-- Adding a parameter changes the function's signature/identity -- CREATE OR
-- REPLACE would leave the old 1-arg overload behind as a separate, still
-- service_role-granted function rather than actually replacing it (the exact
-- "arity change silently drops the intended REVOKE/behavior" trap this
-- project's RUNBOOK.md calls out). Drop it explicitly.
DROP FUNCTION IF EXISTS public.claim_synastry_prewarm_jobs(integer);

CREATE OR REPLACE FUNCTION public.claim_synastry_prewarm_jobs(p_limit INTEGER DEFAULT 10, p_user_id UUID DEFAULT NULL)
RETURNS TABLE(id UUID, user_id UUID, candidate_user_id UUID, retry_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.synastry_prewarm_jobs j
    WHERE (j.status = 'pending'
       OR (j.status = 'failed' AND j.retry_count < 3))
      AND (p_user_id IS NULL OR j.user_id = p_user_id)
    ORDER BY j.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 10)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.synastry_prewarm_jobs j
  SET status = 'processing',
      last_error = NULL
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.id, j.user_id, j.candidate_user_id, j.retry_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_synastry_prewarm_jobs(integer, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_synastry_prewarm_jobs(integer, uuid) TO service_role;
