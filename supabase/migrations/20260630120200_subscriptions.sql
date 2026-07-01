-- ============================================================================
-- AstroDate — Subscriptions, Quotas, Plan Catalog (squashed from legacy 001-103)
-- ============================================================================
-- Covers: plan_catalog + seed data (039 create, 074 reseed Astro+/AstroX/Stardust,
-- 081/097 deactivate legacy tiers), quotas (071/083/085/086/091/092/094 daily
-- and weekly like/super-like enforcement), RevenueCat/iOS sync (076), and
-- daily_picks (041-043).
--
-- EXCLUDED (Razorpay — DROP per migration plan):
--   - user_subscriptions.razorpay_payment_link_id / razorpay_payment_id columns
--   - processed_razorpay_webhooks table (052)
--   - process_razorpay_payment_link_paid() RPC (052, redefined in 081)
--   - Razorpay-specific indexes (052, 097) and service-role INSERT/UPDATE
--     policies that existed solely to support the Razorpay webhook (065)
-- See migration-squash-report.md for full detail on what was excluded and why.
-- ============================================================================


-- ============================================================================
-- TABLE: plan_catalog
-- (039 create; 074 reseed with Stardust/Astro+/AstroX; 081 deactivate old
--  stellar-monthly/cosmic-annual/galaxy-lifetime tiers; 097 also deactivates 'free'
--  slug specifically — see note below)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.plan_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_slug TEXT UNIQUE NOT NULL,
  plan_name TEXT NOT NULL,
  plan_badge TEXT NOT NULL,
  amount_paise INT NOT NULL DEFAULT 0,
  interval TEXT, -- 'monthly' | 'annual' | 'lifetime' | null for free
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.plan_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read plan catalog" ON public.plan_catalog;
CREATE POLICY "Anyone can read plan catalog" ON public.plan_catalog
  FOR SELECT USING (true);

-- ─── Seed: final-state plans (Stardust/Free, Astro+, AstroX) ─────────────────
-- NOTE on ambiguous final state: migration 097 deactivates plan_slug = 'free'
-- alongside the legacy tiers ("Deactivate old seed plans that no longer exist
-- in the app UI ... Prevents plan lookup ambiguity"), implying the app moved to
-- a paywall-only model with no selectable free tier in the UI at that point.
-- However, every quota RPC (consume_like, consume_super_like, etc.) still
-- COALESCEs to plan_slug = 'free' as the fallback for users with no active
-- subscription, and that lookup does NOT filter on is_active. Functionally,
-- de-activating 'free' only affects whether it shows in plan-listing UIs, not
-- whether the fallback quota logic works. We seed it as is_active = true here
-- (matching 074's original intent) and flag this in the report as a judgment
-- call — a human should confirm whether "Free" should be purchasable/listed in
-- the new app or stays as a hidden fallback-only tier.
INSERT INTO public.plan_catalog (plan_slug, plan_name, plan_badge, amount_paise, interval, is_active, features)
VALUES (
  'free',
  'Stardust',
  'Free',
  0,
  NULL,
  true,
  '{
    "daily_likes": 10,
    "see_who_likes_you": 1,
    "advanced_filters": false,
    "dealbreakers": false,
    "incognito_mode": false,
    "weekly_super_likes": 1,
    "basic_compatibility": true,
    "full_synastry_report": false,
    "deep_synastry": false,
    "daily_cosmic_insights": true,
    "ai_match_reading": false,
    "weekly_boost": false,
    "priority_likes": false,
    "skip_the_line": false,
    "astrologer_chat": true,
    "reading_packages": true
  }'::jsonb
)
ON CONFLICT (plan_slug) DO UPDATE SET
  plan_name    = EXCLUDED.plan_name,
  plan_badge   = EXCLUDED.plan_badge,
  amount_paise = EXCLUDED.amount_paise,
  is_active    = EXCLUDED.is_active,
  features     = EXCLUDED.features;

INSERT INTO public.plan_catalog (plan_slug, plan_name, plan_badge, amount_paise, interval, is_active, features)
VALUES (
  'astro_plus',
  'Astro+',
  'Astro+',
  29900,
  'monthly',
  true,
  '{
    "daily_likes": 30,
    "see_who_likes_you": 5,
    "advanced_filters": true,
    "dealbreakers": true,
    "incognito_mode": false,
    "weekly_super_likes": 3,
    "basic_compatibility": true,
    "full_synastry_report": false,
    "deep_synastry": false,
    "daily_cosmic_insights": true,
    "ai_match_reading": false,
    "weekly_boost": false,
    "priority_likes": false,
    "skip_the_line": false,
    "astrologer_chat": true,
    "reading_packages": true
  }'::jsonb
)
ON CONFLICT (plan_slug) DO UPDATE SET
  plan_name    = EXCLUDED.plan_name,
  plan_badge   = EXCLUDED.plan_badge,
  amount_paise = EXCLUDED.amount_paise,
  interval     = EXCLUDED.interval,
  is_active    = EXCLUDED.is_active,
  features     = EXCLUDED.features;

INSERT INTO public.plan_catalog (plan_slug, plan_name, plan_badge, amount_paise, interval, is_active, features)
VALUES (
  'astro_x',
  'AstroX',
  'AstroX',
  59900,
  'monthly',
  true,
  '{
    "daily_likes": -1,
    "see_who_likes_you": -1,
    "advanced_filters": true,
    "dealbreakers": true,
    "incognito_mode": false,
    "weekly_super_likes": 5,
    "basic_compatibility": true,
    "full_synastry_report": true,
    "deep_synastry": true,
    "daily_cosmic_insights": true,
    "ai_match_reading": true,
    "weekly_boost": true,
    "priority_likes": true,
    "skip_the_line": false,
    "astrologer_chat": true,
    "reading_packages": true
  }'::jsonb
)
ON CONFLICT (plan_slug) DO UPDATE SET
  plan_name    = EXCLUDED.plan_name,
  plan_badge   = EXCLUDED.plan_badge,
  amount_paise = EXCLUDED.amount_paise,
  interval     = EXCLUDED.interval,
  is_active    = EXCLUDED.is_active,
  features     = EXCLUDED.features;


-- ============================================================================
-- TABLE: user_subscriptions
-- (039 create WITH razorpay columns — EXCLUDED here; 066 retarget plan_id FK to
--  plan_catalog instead of legacy "plans" table; RAZORPAY-ONLY policies/indexes
--  from 052/065/097 EXCLUDED)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plan_catalog(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'incomplete', -- incomplete | active | past_due | canceled | expired
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,   -- NULL for lifetime
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Service role retains the ability to create/activate subscriptions (now via
-- the iOS/RevenueCat sync RPC and any future payment-provider webhook, not Razorpay).
DROP POLICY IF EXISTS "Service role can insert subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role can insert subscriptions"
  ON public.user_subscriptions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update subscriptions" ON public.user_subscriptions;
CREATE POLICY "Service role can update subscriptions"
  ON public.user_subscriptions
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status ON public.user_subscriptions(user_id, status);

-- Realtime: lets the app receive a push the instant a webhook/sync RPC flips
-- status -> 'active', instead of relying solely on client polling (055).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_subscriptions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_subscriptions;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;


-- ============================================================================
-- iOS / RevenueCat subscription sync RPC  (076 create)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_ios_subscription(entitlement_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_plan_id uuid;
  v_sub_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The active RevenueCat entitlement passed should match plan_slug
  -- (e.g. 'astro_plus' or 'astro_x'), with legacy product-id aliases mapped.
  SELECT id INTO v_plan_id
  FROM public.plan_catalog
  WHERE plan_slug = entitlement_id
     OR plan_slug = CASE
        WHEN entitlement_id = 'astrodate_astroplus_monthly' THEN 'astro_plus'
        WHEN entitlement_id = 'astrodate_astrox_monthly' THEN 'astro_x'
        ELSE entitlement_id
     END;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plan not found for entitlement: %', entitlement_id;
  END IF;

  SELECT id INTO v_sub_id
  FROM public.user_subscriptions
  WHERE user_id = v_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    UPDATE public.user_subscriptions
    SET plan_id = v_plan_id,
        status = 'active',
        current_period_start = now(),
        current_period_end = now() + interval '1 month',
        updated_at = now()
    WHERE id = v_sub_id;
  ELSE
    INSERT INTO public.user_subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    )
    VALUES (
      v_user_id,
      v_plan_id,
      'active',
      now(),
      now() + interval '1 month'
    );
  END IF;

  UPDATE public.user_profiles
  SET plan_type = CASE
    WHEN entitlement_id = 'astro_x' OR entitlement_id = 'astrodate_astrox_monthly' THEN 'AstroX'
    ELSE 'Astro+'
  END
  WHERE user_id = v_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_ios_subscription(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_ios_subscription(text) TO authenticated;


-- ============================================================================
-- get_my_membership()  (040 create — unchanged thereafter)
-- ============================================================================
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
      us.status = 'active' AND (
        us.current_period_end IS NULL OR
        us.current_period_end > now()
      )
    )
  )
  INTO v_result
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due')
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


-- ============================================================================
-- cancel_my_subscription()  (072 create — unchanged thereafter)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cancel_my_subscription()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_subscriptions
  SET
    status = 'canceled',
    updated_at = now()
  WHERE
    user_id = v_user_id
    AND status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_my_subscription() TO authenticated;


-- ============================================================================
-- TABLE: super_like_quota  (039 create)
-- FINAL quota semantics: weekly for ALL plans as of 091 (free) + 092 (paid),
-- keyed by features->>'weekly_super_likes'. quota_date stores the period start
-- (week start for weekly plans). The legacy 'daily_super_likes' code path is
-- retained in consume_super_like/get_super_likes_remaining as a fallback for
-- any plan row that does not carry 'weekly_super_likes' (defensive only — both
-- seeded plans above use weekly_super_likes).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.super_like_quota (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.super_like_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own quota" ON public.super_like_quota;
CREATE POLICY "Users manage own quota" ON public.super_like_quota
  FOR ALL USING (auth.uid() = user_id);

-- consume_super_like — final state per migration 091 (weekly window for plans
-- carrying weekly_super_likes; falls back to daily_super_likes for any plan
-- that doesn't). Atomic check + increment.
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
    AND us.status = 'active'
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

GRANT EXECUTE ON FUNCTION public.consume_super_like(UUID) TO authenticated;

-- get_super_likes_remaining — final state per migration 091
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
  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
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

GRANT EXECUTE ON FUNCTION public.get_super_likes_remaining(UUID) TO authenticated;

-- NOTE: get_super_like_quota_status() and the no-arg check_super_like_quota()
-- (both from migration 040) were explicitly DROPped as orphaned in migration
-- 096 — intentionally NOT recreated here. The one-arg check_super_like_quota(UUID)
-- from migration 071 was also DROPped in migration 083 (replaced by
-- consume_super_like). Neither is part of final state.


-- ============================================================================
-- TABLE: daily_like_quota  (085/086 create — final content identical, 086 adds
-- a defensive DROP POLICY IF EXISTS before CREATE POLICY)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_like_quota (
  user_id    UUID  PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date DATE  NOT NULL DEFAULT CURRENT_DATE,
  used_count INT   NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_like_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own like quota" ON public.daily_like_quota;
CREATE POLICY "Users manage own like quota" ON public.daily_like_quota
  FOR ALL USING (auth.uid() = user_id);

-- consume_like — atomic check + increment. -1/999+ in features.daily_likes = unlimited.
-- Free tier default fallback is 10 if the key is missing entirely.
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
    AND us.status = 'active'
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

GRANT EXECUTE ON FUNCTION public.consume_like(UUID) TO authenticated;

-- get_likes_remaining — for displaying counter in UI. Astro+ daily_likes is 30
-- (set explicitly in migration 094, already reflected in the seed above).
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
  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
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

GRANT EXECUTE ON FUNCTION public.get_likes_remaining(UUID) TO authenticated;


-- ============================================================================
-- get_who_liked_me()  (NEW — not in legacy source)
-- ----------------------------------------------------------------------------
-- Replaces the legacy blanket "Users can view who liked them" RLS policy on
-- user_likes (dropped in rls.sql) with a tier-aware read. Matches Section 3:
-- Free = "Count only (blurred)"; Astro+/AstroX = "Full".
-- ============================================================================
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
    AND us.status = 'active'
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

GRANT EXECUTE ON FUNCTION public.get_who_liked_me() TO authenticated;


-- ============================================================================
-- TABLE: daily_picks  (041 create — unchanged thereafter)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  picked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  astro_score NUMERIC,
  pick_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(user_id, pick_date)
);

ALTER TABLE public.daily_picks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own daily picks" ON public.daily_picks;
CREATE POLICY "Users read own daily picks"
  ON public.daily_picks FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_picks_user_date ON public.daily_picks(user_id, pick_date DESC);

-- get_my_daily_pick()  (043 create — unchanged thereafter)
CREATE OR REPLACE FUNCTION public.get_my_daily_pick()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result json;
BEGIN
  IF v_user_id IS NULL THEN RETURN NULL; END IF;

  SELECT json_build_object(
    'picked_user_id',   dp.picked_user_id,
    'astro_score',      dp.astro_score,
    'pick_date',        dp.pick_date,
    'full_name',        up.full_name,
    'gender',           up.gender,
    'location',         up.location,
    'western_sign',     ad.western_sign,
    'indian_sign',      ad.indian_sign,
    'dominant_element', ad.dominant_element
  )
  INTO v_result
  FROM public.daily_picks dp
  JOIN public.user_profiles up ON up.user_id = dp.picked_user_id
  LEFT JOIN public.astro_details ad ON ad.user_id = dp.picked_user_id
  WHERE dp.user_id = v_user_id
    AND dp.pick_date = CURRENT_DATE
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- generate_daily_picks_now()  (042 create — manual trigger for the cron job
-- defined in the realtime_cron migration file)
CREATE OR REPLACE FUNCTION public.generate_daily_picks_now()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE inserted INT := 0;
BEGIN
  INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
  SELECT DISTINCT ON (sc.user_a_id)
    sc.user_a_id, sc.user_b_id, sc.astro_score, CURRENT_DATE
  FROM public.synastry_cache sc
  JOIN public.user_profiles up ON up.user_id = sc.user_b_id
  WHERE up.updated_at > now() - INTERVAL '7 days'
    AND sc.astro_score IS NOT NULL
  ORDER BY sc.user_a_id, sc.astro_score DESC
  ON CONFLICT (user_id, pick_date) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;
