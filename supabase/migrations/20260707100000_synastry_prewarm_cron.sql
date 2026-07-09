-- ============================================================================
-- Automatic Indian 45 prewarm (build plan Section 7C: "call
-- match_making_detailed_report lazily on first comparison... store the pair
-- score"). Closes two gaps found while wiring up get_match_score:
--
--   1. src/app/cosmic-identity.tsx already calls an edge function named
--      "process-synastry-prewarm" after onboarding, fire-and-forget -- but
--      that function never existed anywhere in this codebase. Jobs were
--      being enqueued into synastry_prewarm_jobs and nothing ever drained
--      them. Added: supabase/functions/process-synastry-prewarm.
--   2. Even when drained, process_synastry_prewarm_job only ever computed
--      the SQL-only planet-level scores -- never the Ashtakoota score itself
--      (that needs the external astrology API, via compute-synastry). The
--      new edge function calls both.
--
-- This migration adds the automation on top: a function to keep the queue
-- topped up for every onboarded user (not just at their own onboarding
-- moment), and two pg_cron jobs -- one to keep enqueueing, one to keep
-- draining -- so Indian 45 gets computed for candidate pairs shortly after
-- they first appear, without any user needing to open a synastry detail
-- screen manually. This is what makes get_match_score's fully_computed=true
-- the common case instead of the exception.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- refresh_synastry_prewarm_queue()
-- Tops up every onboarded user's prewarm queue using the existing
-- enqueue_synastry_prewarm ranking/candidate-selection logic (up to 25
-- candidates per user, deduplicated by the unique (pair_a_id, pair_b_id)
-- index on synastry_prewarm_jobs -- re-running this is always safe/cheap).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_synastry_prewarm_queue()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_result RECORD;
  v_total INTEGER := 0;
BEGIN
  FOR v_user IN
    SELECT up.user_id
    FROM public.user_profiles up
    JOIN public.astro_details ad ON ad.user_id = up.user_id
  LOOP
    SELECT * INTO v_result FROM public.enqueue_synastry_prewarm(v_user.user_id);
    v_total := v_total + COALESCE(v_result.enqueued_count, 0);
  END LOOP;

  RETURN v_total;
END;
$$;

COMMENT ON FUNCTION public.refresh_synastry_prewarm_queue() IS
  'Tops up the synastry prewarm queue for every onboarded user. Scheduled by the refresh-synastry-prewarm-queue cron job.';

-- ─── refresh-synastry-prewarm-queue  (every 30 min — keeps enqueueing) ───────
SELECT cron.unschedule('refresh-synastry-prewarm-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-synastry-prewarm-queue'
);

SELECT cron.schedule(
  'refresh-synastry-prewarm-queue',
  '*/30 * * * *',
  $$ SELECT public.refresh_synastry_prewarm_queue(); $$
);

-- ─── drain-synastry-prewarm-queue  (every 1 min — keeps draining) ───────────
-- IMPORTANT: before this job can authenticate successfully, store a scoped
-- worker secret in Vault once via the Supabase SQL editor (matching the
-- PREWARM_FUNCTION_SECRET value set on the process-synastry-prewarm edge
-- function's own secrets -- same pattern as this project's other cron jobs,
-- e.g. push_worker_secret):
--   SELECT vault.create_secret(
--     'YOUR_PREWARM_FUNCTION_SECRET_VALUE',
--     'prewarm_function_secret',
--     'Auth secret for process-synastry-prewarm edge function cron drain'
--   );
SELECT cron.unschedule('drain-synastry-prewarm-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-synastry-prewarm-queue'
);

SELECT cron.schedule(
  'drain-synastry-prewarm-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://frgckqxfkfjacrutcobg.supabase.co/functions/v1/process-synastry-prewarm',
    headers := jsonb_build_object(
      'Content-Type',    'application/json',
      'x-prewarm-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'prewarm_function_secret'
        LIMIT 1
      )
    ),
    body    := '{"batch_size": 10}'::jsonb
  );
  $$
);
