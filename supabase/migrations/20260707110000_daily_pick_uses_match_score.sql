-- ============================================================================
-- Daily Pick / "Top Match of the Day" was silently broken: process_synastry_
-- prewarm_job called public.compute_astro_score(), a legacy function that
-- was deliberately excluded from this project's schema squash and never
-- recreated (every call threw, caught by this function's own EXCEPTION
-- handler, so jobs just retried forever without ever populating
-- synastry_cache.astro_score -> daily_picks never got generated ->
-- get_my_daily_pick() always returned NULL).
--
-- synastry_cache already carries western_score/indian_score/personality_score
-- columns with a comment stating they exist for exactly this purpose ("added
-- so the upcoming 45/45/10 scoring rewrite has somewhere to cache the
-- per-component split... no scoring logic populates them yet" --
-- 20260630120300_realtime_cron.sql). Rather than recreating the old 0-1-scale
-- Sun/Venus/Mars/Nakshatra formula, this replaces the compute_astro_score
-- call with public.get_match_score (see match_score_aggregator migration),
-- finally wiring those reserved columns to the real 45/45/10 total.
--
-- astro_score is now on the 0-100 scale (matching get_match_score/
-- get_fallback_feed) rather than the legacy 0-1 scale -- nothing in src/
-- reads astro_score or daily_picks yet (this feature has no frontend wired
-- up), so there is no existing consumer to stay backward-compatible with.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_synastry_prewarm_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.synastry_prewarm_jobs%ROWTYPE;
  v_a UUID;
  v_b UUID;
  v_existing public.synastry_cache%ROWTYPE;
  v_match RECORD;
BEGIN
  SELECT * INTO v_job
  FROM public.synastry_prewarm_jobs
  WHERE id = p_job_id
    AND status = 'processing';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'job_not_processing');
  END IF;

  v_a := LEAST(v_job.user_id, v_job.candidate_user_id);
  v_b := GREATEST(v_job.user_id, v_job.candidate_user_id);

  SELECT * INTO v_existing
  FROM public.synastry_cache
  WHERE user_a_id = v_a
    AND user_b_id = v_b
    AND is_stale = false
    AND computed_at >= now() - INTERVAL '7 days';

  IF FOUND THEN
    UPDATE public.synastry_prewarm_jobs
    SET status = 'processed',
        processed_at = now()
    WHERE id = p_job_id;

    RETURN jsonb_build_object('status', 'cache_fresh', 'astro_score', v_existing.astro_score);
  END IF;

  SELECT * INTO v_match FROM public.get_match_score(v_job.user_id, v_job.candidate_user_id);

  IF v_match.total_score IS NULL THEN
    -- Neither user has enough data for even a partial score yet (synastry_cache.
    -- astro_score is NOT NULL) -- mark processed rather than retrying forever;
    -- get_match_score will naturally start returning a real value once
    -- onboarding data exists, and this job's own pair only needs computing once.
    UPDATE public.synastry_prewarm_jobs
    SET status = 'processed',
        processed_at = now()
    WHERE id = p_job_id;

    RETURN jsonb_build_object('status', 'no_score_yet');
  END IF;

  INSERT INTO public.synastry_cache (
    user_a_id,
    user_b_id,
    astro_score,
    western_score,
    indian_score,
    personality_score,
    signal_score,
    computed_at,
    is_stale
  )
  VALUES (
    v_a,
    v_b,
    v_match.total_score,
    v_match.western_points,
    v_match.indian_points,
    v_match.personality_points,
    public.get_signal_score(v_job.user_id, v_job.candidate_user_id),
    now(),
    false
  )
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
    astro_score = EXCLUDED.astro_score,
    western_score = EXCLUDED.western_score,
    indian_score = EXCLUDED.indian_score,
    personality_score = EXCLUDED.personality_score,
    signal_score = GREATEST(
      COALESCE(public.synastry_cache.signal_score, 0),
      COALESCE(EXCLUDED.signal_score, 0)
    ),
    computed_at = now(),
    is_stale = false;

  PERFORM *
  FROM public.get_synastry_detail(v_job.user_id, v_job.candidate_user_id);

  UPDATE public.synastry_cache_details
  SET is_stale = false,
      computed_at = now()
  WHERE user_a_id = v_a
    AND user_b_id = v_b;

  UPDATE public.synastry_prewarm_jobs
  SET status = 'processed',
      processed_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('status', 'processed', 'astro_score', v_match.total_score);
EXCEPTION WHEN OTHERS THEN
  UPDATE public.synastry_prewarm_jobs
  SET status = CASE WHEN retry_count + 1 >= 3 THEN 'failed' ELSE 'pending' END,
      retry_count = retry_count + 1,
      last_error = left(SQLERRM, 1000),
      processed_at = CASE WHEN retry_count + 1 >= 3 THEN now() ELSE processed_at END
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'status', 'retry_scheduled',
    'error', SQLERRM
  );
END;
$$;
