-- ============================================================================
-- get_my_membership()'s row-selection WHERE clause checked
-- status IN ('active','past_due','canceled') but, unlike every sibling
-- gating RPC (consume_like, get_who_liked_me, get_discover_deck, etc.),
-- never also required current_period_end > now() in that same WHERE. The
-- expiry check only happened inside the computed is_active field.
--
-- Net effect: a subscription whose status row hasn't caught up yet (still
-- 'active' in the DB, but current_period_end already in the past --
-- e.g. a webhook that hasn't fired) returned the stale paid plan's
-- plan_slug/features/plan_badge with only is_active:false tacked on,
-- instead of falling through to the free-tier fallback every other gate
-- correctly uses. Fix: add the same expiry condition to the WHERE clause,
-- matching every sibling RPC -- an expired row simply won't be selected,
-- so v_result stays NULL and the existing free-tier fallback branch below
-- takes over exactly as it does for a user with no subscription row at all.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_membership()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
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

GRANT EXECUTE ON FUNCTION public.get_my_membership() TO authenticated;
