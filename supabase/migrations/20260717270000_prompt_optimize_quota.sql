-- ============================================================================
-- AstroDate — Prompt Optimizer daily quota
-- ============================================================================
-- Backs the "AI Optimizer" copy on finish-ques.tsx, which previously had no
-- feature behind it at all. Mirrors daily_like_quota's shape/convention
-- exactly (see 20260630120200_subscriptions.sql) so this is consistent with
-- how every other per-user daily cap in this app works. Cap is fixed at 10/day
-- for every tier for now -- there's no plan_catalog.features key for this yet,
-- so it isn't tier-gated; revisit if this should scale with Astro+/AstroX.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prompt_optimize_quota (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.prompt_optimize_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own prompt optimize quota" ON public.prompt_optimize_quota;
CREATE POLICY "Users manage own prompt optimize quota" ON public.prompt_optimize_quota
  FOR ALL USING (auth.uid() = user_id);

-- consume_prompt_optimize -- atomic check + increment, same pattern as
-- consume_like. Returns FALSE once the daily cap is hit instead of raising,
-- so the edge function can turn that into a clean "quota_exceeded" response.
CREATE OR REPLACE FUNCTION public.consume_prompt_optimize(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT INT := 10;
  v_used  INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot consume prompt-optimize quota for another user';
  END IF;

  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.prompt_optimize_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  IF v_used >= v_limit THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.prompt_optimize_quota (user_id, quota_date, used_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN prompt_optimize_quota.quota_date = CURRENT_DATE
          THEN prompt_optimize_quota.used_count + 1
          ELSE 1
        END,
        quota_date  = CURRENT_DATE,
        updated_at  = now();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_prompt_optimize(UUID) TO authenticated;

-- get_prompt_optimize_remaining -- lets the client show/hide the optimize
-- button state without guessing; self-only, same guard as
-- get_rewinds_remaining/get_likes_remaining.
CREATE OR REPLACE FUNCTION public.get_prompt_optimize_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit CONSTANT INT := 10;
  v_used  INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot query prompt-optimize quota for another user';
  END IF;

  SELECT CASE
    WHEN quota_date = CURRENT_DATE THEN used_count
    ELSE 0
  END
  INTO v_used
  FROM public.prompt_optimize_quota
  WHERE user_id = p_user_id;

  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_prompt_optimize_remaining(UUID) TO authenticated;
