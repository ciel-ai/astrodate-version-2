-- ============================================================================
-- Tier 3 notification: "a new high match entered your deck"
-- ----------------------------------------------------------------------------
-- Rides on synastry_cache (20260630120300_realtime_cron.sql), which a
-- background prewarm pipeline (process-synastry-prewarm) already keeps
-- continuously populated with the real 45/45/10 astro_score for effectively
-- every onboarded pair -- no new snapshot table needed. The real work is
-- eligibility: synastry_cache is undirected and knows nothing about either
-- side's age/gender/distance preferences or swipe history, so a high score
-- alone doesn't mean the candidate would actually appear in either side's
-- deck. is_deck_eligible() duplicates get_fallback_feed()'s own filter
-- predicate (verified against its current definition,
-- 20260710180000_discover_coldstart_radius_widening.sql) so this
-- notification never claims a match that wouldn't really show up.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_deck_eligible(p_viewer_id UUID, p_candidate_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_age              INT;
  v_max_age               INT;
  v_viewer_gender_pref     TEXT;
  v_viewer_interest        TEXT[];
  v_viewer_gender          TEXT;
  v_viewer_geog            GEOGRAPHY;
  v_max_distance           INT;
  v_candidate_gender       TEXT;
  v_candidate_age          INT;
  v_candidate_pref         TEXT;
  v_candidate_sec1_interest TEXT[];
  v_candidate_geog         GEOGRAPHY;
BEGIN
  IF p_viewer_id = p_candidate_id THEN
    RETURN false;
  END IF;

  -- Already liked, passed (stored as action_type='dislike'), or matched --
  -- record_swipe (20260709170000_record_swipe_idempotent.sql) writes every
  -- swipe outcome into user_likes, same single exclusion get_fallback_feed
  -- itself relies on.
  IF EXISTS (
    SELECT 1 FROM public.user_likes
    WHERE user_id = p_viewer_id AND liked_user_id = p_candidate_id
  ) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.block_users
    WHERE (blocker_id = p_viewer_id AND blocked_id = p_candidate_id)
       OR (blocker_id = p_candidate_id AND blocked_id = p_viewer_id)
  ) THEN
    RETURN false;
  END IF;

  SELECT
    COALESCE(up.min_age, 18),
    COALESCE(up.max_age, 65),
    up.gender_preference,
    prof.gender,
    COALESCE(up.max_distance, 50)
  INTO v_min_age, v_max_age, v_viewer_gender_pref, v_viewer_gender, v_max_distance
  FROM public.user_profiles prof
  LEFT JOIN public.user_preferences up ON up.user_id = prof.user_id
  WHERE prof.user_id = p_viewer_id;

  IF v_viewer_gender IS NULL THEN
    RETURN false; -- viewer profile doesn't exist
  END IF;

  SELECT ul.geog INTO v_viewer_geog
  FROM public.user_locations ul
  WHERE ul.user_id = p_viewer_id AND ul.consent;

  IF v_viewer_gender_pref IS NOT NULL THEN
    v_viewer_interest := ARRAY[v_viewer_gender_pref];
  ELSE
    SELECT s1.interest INTO v_viewer_interest
    FROM public.section1_qns s1
    WHERE s1.user_id = p_viewer_id;
  END IF;

  SELECT
    up.gender,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT,
    cand_pref.gender_preference,
    cand_sec1.interest,
    cand_loc.geog
  INTO v_candidate_gender, v_candidate_age, v_candidate_pref, v_candidate_sec1_interest, v_candidate_geog
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  LEFT JOIN public.user_preferences cand_pref ON cand_pref.user_id = up.user_id
  LEFT JOIN public.section1_qns cand_sec1 ON cand_sec1.user_id = up.user_id
  LEFT JOIN public.user_locations cand_loc ON cand_loc.user_id = up.user_id AND cand_loc.consent
  WHERE up.user_id = p_candidate_id;

  IF v_candidate_gender IS NULL THEN
    RETURN false; -- candidate profile doesn't exist
  END IF;

  IF v_candidate_age IS NOT NULL AND (v_candidate_age < v_min_age OR v_candidate_age > v_max_age) THEN
    RETURN false;
  END IF;

  -- Does the viewer want to see this candidate's gender?
  IF NOT public.gender_matches_interest(v_candidate_gender, v_viewer_interest) THEN
    RETURN false;
  END IF;

  -- Does the candidate want to see the viewer's gender? (bidirectional)
  IF NOT public.gender_matches_interest(
    v_viewer_gender,
    CASE WHEN v_candidate_pref IS NOT NULL THEN ARRAY[v_candidate_pref] ELSE v_candidate_sec1_interest END
  ) THEN
    RETURN false;
  END IF;

  -- Distance is a soft filter, same tolerance as get_fallback_feed: only
  -- excludes when both locations are actually known.
  IF v_viewer_geog IS NOT NULL AND v_candidate_geog IS NOT NULL
     AND NOT ST_DWithin(v_candidate_geog, v_viewer_geog, v_max_distance * 1000) THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;


-- ============================================================================
-- Daily cap, DB-enforced (not just application logic): at most one
-- 'high_match'-prefixed notification per user per day. Exists specifically
-- to close an intra-scan race -- a plain INSERT...SELECT...WHERE NOT EXISTS
-- lets multiple qualifying rows for the same user in the same statement all
-- see the same pre-insert snapshot. A real unique index makes the cap hold
-- regardless of query shape or cron overlap. Scoped to the 'high_match:'
-- prefix so it never interacts with Tier 2's unrelated 'engagement'-type
-- daily-insight rows, which share the same notification_type but not this cap.
--
-- A generated/expression index on created_at::date isn't possible --
-- timestamptz->date depends on session timezone, so Postgres rejects it as
-- not IMMUTABLE (caught by testing this migration for real, not assumed).
-- A real stored column with a DEFAULT sidesteps that entirely -- column
-- defaults have no immutability requirement, only index expressions do.
-- Explicitly UTC rather than relying on CURRENT_DATE's session-timezone
-- behavior, which also makes the "resets at UTC, not IST" limitation
-- (shared with Tier 4's like-nudge cap) self-documenting in the column name.
-- ============================================================================
ALTER TABLE public.notification_delivery_logs
  ADD COLUMN IF NOT EXISTS created_date_utc DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_logs_high_match_daily
  ON public.notification_delivery_logs (user_id, created_date_utc)
  WHERE dedupe_key LIKE 'high_match:%';


-- ============================================================================
-- notify-high-matches: periodic scan (not a trigger on synastry_cache
-- itself, to avoid adding per-row overhead to the prewarm drain job that
-- already writes that table every minute at scale). Pure SQL, no edge
-- function -- same isolation principle as daily-insight-notify.
-- ============================================================================
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    PERFORM cron.unschedule('notify-high-matches')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify-high-matches');

    PERFORM cron.schedule(
      'notify-high-matches',
      '*/15 * * * *',
      $cron$
        WITH candidates AS (
          SELECT sc.user_a_id AS viewer_id, sc.user_b_id AS candidate_id, sc.astro_score
          FROM public.synastry_cache sc
          WHERE sc.is_stale = false
            AND sc.astro_score >= 85
            AND sc.computed_at > now() - INTERVAL '20 minutes'
            AND public.is_deck_eligible(sc.user_a_id, sc.user_b_id)
          UNION ALL
          SELECT sc.user_b_id AS viewer_id, sc.user_a_id AS candidate_id, sc.astro_score
          FROM public.synastry_cache sc
          WHERE sc.is_stale = false
            AND sc.astro_score >= 85
            AND sc.computed_at > now() - INTERVAL '20 minutes'
            AND public.is_deck_eligible(sc.user_b_id, sc.user_a_id)
        ),
        -- Only the single best-scoring candidate per viewer per scan is even
        -- attempted -- belt-and-suspenders with the unique index above, and
        -- means the notification is about the strongest match, not whichever
        -- row happened to be processed first.
        best AS (
          SELECT DISTINCT ON (viewer_id) viewer_id, candidate_id, astro_score
          FROM candidates
          ORDER BY viewer_id, astro_score DESC
        )
        INSERT INTO public.notification_delivery_logs (
          user_id, notification_type, reference_id, dedupe_key, title, body, payload
        )
        SELECT
          viewer_id,
          'engagement',
          candidate_id::TEXT,
          'high_match:' || viewer_id::TEXT || ':' || candidate_id::TEXT,
          'A ' || ROUND(astro_score)::TEXT || '% match just entered your sky ✦',
          'Open AstroDate to see who it is',
          jsonb_build_object('type', 'high_match', 'candidate_id', candidate_id)
        FROM best
        -- Untargeted ON CONFLICT DO NOTHING applies to a violation of *any*
        -- unique constraint on this table -- honors both the permanent
        -- per-pair dedupe_key uniqueness and the daily-cap partial index
        -- above with one clause (a single INSERT can't have two ON CONFLICT
        -- clauses targeting two different indexes).
        ON CONFLICT DO NOTHING;
      $cron$
    );

  END IF;
END
$outer$;
