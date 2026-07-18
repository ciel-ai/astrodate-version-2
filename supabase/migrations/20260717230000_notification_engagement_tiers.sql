-- ============================================================================
-- Notification Tiers 2 & 4 (engagement + likes-nudge conversion push)
-- ----------------------------------------------------------------------------
-- Adds:
--   1. user_notification_preferences.engagement_enabled + timezone (needed so
--      quiet hours, stored since 054 but never enforced, can finally be
--      evaluated in send-push-notification).
--   2. 'engagement' as a valid notification_delivery_logs.notification_type,
--      for Tier 2 (daily forecast ready) alongside existing
--      new_match/new_message/marketing.
--   3. enqueue_like_push_notification(): Tier 4 "someone liked you" nudge,
--      modeled on enqueue_message_push_notification() -- free-tier users
--      only (paid users already see full like details in-app), capped at
--      once/day per user via the existing dedupe_key unique index.
-- Tier 3 (deck-entry) and the rest of Tier 4 (trial-ending) are NOT covered
-- here -- both need data models (a candidate snapshot table; a reverse-trial
-- concept) that don't exist yet anywhere in this schema.
-- ============================================================================

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS engagement_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE public.notification_delivery_logs
  DROP CONSTRAINT IF EXISTS notification_delivery_logs_type_check;
ALTER TABLE public.notification_delivery_logs
  ADD CONSTRAINT notification_delivery_logs_type_check
    CHECK (notification_type IN ('new_match', 'new_message', 'marketing', 'engagement'));


-- ============================================================================
-- update_notification_preferences(): additive params, backward-compatible
-- (existing callers pass no new args and COALESCE keeps their rows unchanged).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_new_matches_enabled BOOLEAN DEFAULT NULL,
  p_new_messages_enabled BOOLEAN DEFAULT NULL,
  p_marketing_enabled BOOLEAN DEFAULT NULL,
  p_quiet_hours_start TIME DEFAULT NULL,
  p_quiet_hours_end TIME DEFAULT NULL,
  p_engagement_enabled BOOLEAN DEFAULT NULL,
  p_timezone TEXT DEFAULT NULL
)
RETURNS public.user_notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row public.user_notification_preferences%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_notification_preferences
  SET new_matches_enabled = COALESCE(p_new_matches_enabled, new_matches_enabled),
      new_messages_enabled = COALESCE(p_new_messages_enabled, new_messages_enabled),
      marketing_enabled = COALESCE(p_marketing_enabled, marketing_enabled),
      quiet_hours_start = COALESCE(p_quiet_hours_start, quiet_hours_start),
      quiet_hours_end = COALESCE(p_quiet_hours_end, quiet_hours_end),
      engagement_enabled = COALESCE(p_engagement_enabled, engagement_enabled),
      timezone = COALESCE(p_timezone, timezone),
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;


-- ============================================================================
-- Tier 4: "someone liked you" push -- free-tier users only, one enqueue per
-- user per day (dedupe_key + the existing unique index + ON CONFLICT DO
-- NOTHING already used by the match/message triggers handles the cap).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_like_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_slug TEXT;
BEGIN
  IF NEW.action_type NOT IN ('like', 'super_like') THEN
    RETURN NEW;
  END IF;

  SELECT pc.plan_slug INTO v_plan_slug
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = NEW.liked_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');

  -- Paid users already see full like details in-app -- this nudge exists to
  -- sell the reveal, not to duplicate a notification a paying user doesn't need.
  IF v_plan_slug <> 'free' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notification_delivery_logs (
    user_id, notification_type, reference_id, dedupe_key, title, body, payload
  )
  VALUES (
    NEW.liked_user_id,
    'marketing',
    NEW.user_id::TEXT,
    'like_nudge:' || NEW.liked_user_id::TEXT || ':' || CURRENT_DATE::TEXT,
    'Someone new liked you ✦',
    'Reveal them with Astro+',
    jsonb_build_object(
      'type', 'like_nudge',
      'liker_id', NEW.user_id
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_like_push_notification ON public.user_likes;
CREATE TRIGGER trg_enqueue_like_push_notification
AFTER INSERT ON public.user_likes
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_like_push_notification();


-- ============================================================================
-- Tier 2: "daily forecast ready" nudge -- pure SQL, once/day, isolated from
-- the daily-insights Edge Function and daily_insights_cache entirely (no
-- Astrology API calls, no shared state with the lazy per-request cache path
-- that 20260706130000_daily_insights.sql deliberately kept simple). This job
-- does exactly one thing: enqueue a static, always-true "your forecast is
-- ready" notification for every user whose profile is complete enough that
-- opening Insights would actually produce a real forecast (same completeness
-- gate as daily-insights/index.ts's own 422 check) -- so the notification
-- never promises something that isn't actually there yet.
--
-- Runs once/day at a fixed UTC hour; per-user quiet-hours deferral (enforced
-- in send-push-notification using the timezone/quiet_hours_* columns above)
-- is what actually pushes the send to a reasonable local time, not this job.
-- ============================================================================
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    PERFORM cron.unschedule('daily-insight-notify')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-insight-notify');

    PERFORM cron.schedule(
      'daily-insight-notify',
      '0 6 * * *',
      $cron$
        INSERT INTO public.notification_delivery_logs (
          user_id, notification_type, reference_id, dedupe_key, title, body, payload
        )
        SELECT
          up.user_id,
          'engagement',
          up.user_id::TEXT,
          'daily_insight:' || up.user_id::TEXT || ':' || CURRENT_DATE::TEXT,
          'Your cosmic weather for today is ready ✦',
          'Open AstroDate to see what the stars have for you',
          jsonb_build_object('type', 'daily_insight')
        FROM public.user_profiles up
        JOIN public.astro_details ad ON ad.user_id = up.user_id
        WHERE ad.nakshatra_name IS NOT NULL
          AND ad.birth_date IS NOT NULL
          AND ad.birth_time IS NOT NULL
          AND ad.birth_latitude IS NOT NULL
          AND ad.birth_longitude IS NOT NULL
          AND up.deleted_at IS NULL
        ON CONFLICT (dedupe_key) DO NOTHING;
      $cron$
    );

  END IF;
END
$outer$;
