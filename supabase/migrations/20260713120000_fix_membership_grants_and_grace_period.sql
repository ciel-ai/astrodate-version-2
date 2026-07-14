-- ============================================================================
-- Fixes two bugs found while load-testing the new RevenueCat billing flow
-- (supabase/functions/revenuecat-webhook, supabase/functions/confirm-purchase,
-- src/app/subscription.tsx) against a throwaway Postgres instance simulating
-- the real anon/authenticated/service_role grant model.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1 (critical): get_my_membership() / cancel_my_subscription() were
-- locked to service_role-only by 20260710160000_function_grant_lockdown.sql,
-- at a time when nothing in src/ called them yet (that migration's own
-- comment says so explicitly and flags them as "safe to re-grant ... the
-- moment the corresponding feature ships — no code changes needed"). The
-- subscription screen built on 2026-07-13 is that feature. Without this,
-- every client call to supabase.rpc('get_my_membership') throws
-- "permission denied", silently caught by getMembershipOrFree()'s fallback
-- — every user, including ones who paid successfully, would see themselves
-- as Free forever in the app's own UI. Verified live with a non-superuser
-- Postgres role standing in for the `authenticated` client role.
--
-- Both functions are self-scoped via auth.uid() internally (never take a
-- client-supplied user id), so re-granting requires no code changes.
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.get_my_membership() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_subscription() TO authenticated;

-- ----------------------------------------------------------------------------
-- FIX 2: every feature-gating RPC required status = 'active' exactly, so a
-- user who canceled (turned off auto-renew) or hit a billing retry
-- (past_due) lost paid features INSTANTLY — even with weeks still left on
-- a period they already paid for. This contradicts standard subscription
-- semantics (you keep what you paid for until the period ends) and was
-- verified live: a subscription canceled with 29 days remaining dropped
-- from unlimited AstroX likes to Free's 10/day immediately.
--
-- Access should be gated purely by current_period_end (already correctly
-- self-enforced by every one of these functions — verified separately that
-- an 'active' row past its current_period_end already correctly falls back
-- to Free with no cron involved). Status should only ever hard-block access
-- once it's 'expired' (or the row doesn't exist / was never completed).
-- Broadening 'active' to 'active' | 'past_due' | 'canceled' in the
-- selection WHERE clause fixes this consistently across every gate.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_my_membership()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result json;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'user_id',              v_user_id,
    'plan_id',              pc.id,
    'plan_slug',            pc.plan_slug,
    'plan_name',            pc.plan_name,
    'plan_badge',           pc.plan_badge,
    'features',             pc.features,
    'status',               us.status,
    'current_period_end',   us.current_period_end,
    'is_active',            (
      us.status IN ('active', 'past_due', 'canceled') AND (
        us.current_period_end IS NULL OR
        us.current_period_end > now()
      )
    )
  )
  INTO v_result
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_result IS NULL THEN
    SELECT json_build_object(
      'user_id',              v_user_id,
      'plan_id',              id,
      'plan_slug',            plan_slug,
      'plan_name',            plan_name,
      'plan_badge',           plan_badge,
      'features',             features,
      'status',               null,
      'current_period_end',   null,
      'is_active',            false
    )
    INTO v_result
    FROM public.plan_catalog
    WHERE plan_slug = 'free'
    LIMIT 1;
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_like(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features  JSONB;
  v_limit     INT;
  v_used      INT;
BEGIN
  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM public.plan_catalog
    WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'daily_likes')::INT, 10);
  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN TRUE;
  END IF;

  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.daily_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.daily_like_quota (user_id, quota_date, used_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN daily_like_quota.quota_date = CURRENT_DATE
          THEN daily_like_quota.used_count + 1
          ELSE 1
        END,
        quota_date  = CURRENT_DATE,
        updated_at  = now();

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_likes_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features  JSONB;
  v_limit     INT;
  v_used      INT;
BEGIN
  -- Ownership guard restored: this rewrite (broadening the status filter
  -- below) was copied from the pre-20260710130000 function body and briefly
  -- dropped the auth.uid() = p_user_id check that migration had added.
  -- Without it, re-granting this to `authenticated` in the future would let
  -- any signed-in user query a stranger's like quota. auth.uid() IS NULL
  -- (service_role/edge-function callers) is intentionally exempt.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot query like quota for another user';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM public.plan_catalog
    WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'daily_likes')::INT, 10);
  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;

  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.daily_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_super_like(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features      JSONB;
  v_limit         INT;
  v_used          INT;
  v_period_start  DATE;
BEGIN
  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM public.plan_catalog
    WHERE plan_slug = 'free';
  END IF;

  IF (v_features->>'weekly_super_likes') IS NOT NULL THEN
    v_limit        := (v_features->>'weekly_super_likes')::INT;
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
  ELSE
    v_limit        := COALESCE((v_features->>'daily_super_likes')::INT, 1);
    v_period_start := CURRENT_DATE;
  END IF;

  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN TRUE;
  END IF;

  SELECT CASE
    WHEN quota_date = v_period_start THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.super_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.super_like_quota (user_id, quota_date, used_count)
  VALUES (p_user_id, v_period_start, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN super_like_quota.quota_date = v_period_start
          THEN super_like_quota.used_count + 1
          ELSE 1
        END,
        quota_date = v_period_start,
        updated_at = now();

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_super_likes_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features      JSONB;
  v_limit         INT;
  v_used          INT;
  v_period_start  DATE;
BEGIN
  -- Ownership guard restored -- see get_likes_remaining above for why.
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot query super-like quota for another user';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features
    FROM public.plan_catalog
    WHERE plan_slug = 'free';
  END IF;

  IF (v_features->>'weekly_super_likes') IS NOT NULL THEN
    v_limit        := (v_features->>'weekly_super_likes')::INT;
    v_period_start := date_trunc('week', CURRENT_DATE)::date;
  ELSE
    v_limit        := COALESCE((v_features->>'daily_super_likes')::INT, 1);
    v_period_start := CURRENT_DATE;
  END IF;

  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;

  SELECT CASE
    WHEN quota_date = v_period_start THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.super_like_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_who_liked_me()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID := auth.uid();
  v_plan_slug TEXT;
  v_is_paid   BOOLEAN;
  v_count     INT;
  v_likers    JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pc.plan_slug INTO v_plan_slug
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');
  v_is_paid := (v_plan_slug <> 'free');

  SELECT COUNT(*) INTO v_count
  FROM public.user_likes
  WHERE liked_user_id = v_user_id
    AND action_type IN ('like', 'super_like');

  IF NOT v_is_paid THEN
    RETURN jsonb_build_object('tier', 'basic', 'count', v_count);
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'user_id',      ul.user_id,
      'full_name',    up.full_name,
      'action_type',  ul.action_type,
      'note',         ul.note,
      'created_at',   ul.created_at
    ) ORDER BY ul.created_at DESC
  ) INTO v_likers
  FROM public.user_likes ul
  JOIN public.user_profiles up ON up.user_id = ul.user_id
  WHERE ul.liked_user_id = v_user_id
    AND ul.action_type IN ('like', 'super_like');

  RETURN jsonb_build_object(
    'tier',  'full',
    'count', v_count,
    'likes', COALESCE(v_likers, '[]'::JSONB)
  );
END;
$$;
