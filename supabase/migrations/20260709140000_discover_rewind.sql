-- ============================================================================
-- Rewind (build plan Section 3: Free = "—", Astro+ = "1 rewind/day", AstroX =
-- "Unlimited + priority placement"). The Discover action bar already has a
-- rewind button (discover-action-bar.tsx) rendered as a permanent padlock
-- placeholder -- no RPC, no quota, nothing behind it. Priority placement
-- (the "boost" half of that PDF row) is a visibility-ranking feature that
-- affects OTHER users' decks, not just the swiper's own -- a materially
-- different, bigger feature, deliberately left out of this migration rather
-- than bolted on halfway.
--
-- daily_rewind_quota mirrors daily_like_quota's exact shape (upsert-by-date,
-- atomic check + increment) for the same reason every other per-day quota in
-- this codebase does: keeps a single consistent convention rather than a new
-- one per feature.
-- ============================================================================

UPDATE public.plan_catalog SET features = features || '{"daily_rewinds": 0}'::jsonb  WHERE plan_slug = 'free';
UPDATE public.plan_catalog SET features = features || '{"daily_rewinds": 1}'::jsonb  WHERE plan_slug = 'astro_plus';
UPDATE public.plan_catalog SET features = features || '{"daily_rewinds": -1}'::jsonb WHERE plan_slug = 'astro_x';

CREATE TABLE IF NOT EXISTS public.daily_rewind_quota (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  quota_date DATE NOT NULL DEFAULT CURRENT_DATE,
  used_count INT  NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_rewind_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own rewind quota" ON public.daily_rewind_quota;
CREATE POLICY "Users manage own rewind quota" ON public.daily_rewind_quota
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- rewind_last_swipe() -- undoes the caller's most recent swipe (like/pass/
-- super_like), refunding whichever quota it spent. Blocked once that swipe
-- already produced a mutual match (user_matches row) -- the other person may
-- already know, so that action isn't something a rewind should silently
-- erase.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.rewind_last_swipe()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_features    JSONB;
  v_limit       INT;
  v_used        INT;
  v_last        public.user_likes%ROWTYPE;
  v_is_matched  BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features FROM public.plan_catalog WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'daily_rewinds')::INT, 0);

  IF v_limit = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'rewind_not_available');
  END IF;

  -- -1 (or any 999+) means unlimited (AstroX) -- skip the usage check
  -- entirely; anything else is a finite daily cap (Astro+ = 1).
  IF v_limit > 0 AND v_limit < 999 THEN
    SELECT CASE WHEN quota_date = CURRENT_DATE THEN used_count ELSE 0 END
    INTO v_used
    FROM public.daily_rewind_quota
    WHERE user_id = v_user_id;
    v_used := COALESCE(v_used, 0);

    IF v_used >= v_limit THEN
      RETURN jsonb_build_object('success', false, 'reason', 'rewind_limit_reached');
    END IF;
  END IF;

  SELECT * INTO v_last
  FROM public.user_likes
  WHERE user_id = v_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'nothing_to_rewind');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_matches
    WHERE user1_id = LEAST(v_user_id, v_last.liked_user_id)
      AND user2_id = GREATEST(v_user_id, v_last.liked_user_id)
  ) INTO v_is_matched;

  IF v_is_matched THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_matched');
  END IF;

  DELETE FROM public.user_likes WHERE id = v_last.id;

  -- Refund the swipe quota it spent (every swipe, including a pass, spends
  -- from daily_likes -- see record_swipe's own comment on that convention).
  UPDATE public.daily_like_quota
  SET used_count = GREATEST(used_count - 1, 0)
  WHERE user_id = v_user_id AND quota_date = CURRENT_DATE;

  IF v_last.action_type = 'super_like' THEN
    UPDATE public.super_like_quota
    SET used_count = GREATEST(used_count - 1, 0)
    WHERE user_id = v_user_id;
  END IF;

  INSERT INTO public.daily_rewind_quota (user_id, quota_date, used_count)
  VALUES (v_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET used_count = CASE
          WHEN daily_rewind_quota.quota_date = CURRENT_DATE
          THEN daily_rewind_quota.used_count + 1
          ELSE 1
        END,
        quota_date = CURRENT_DATE,
        updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'restored_user_id', v_last.liked_user_id,
    'restored_action', v_last.action_type
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rewind_last_swipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rewind_last_swipe() TO authenticated;

-- get_rewinds_remaining() -- for the UI to show/hide the rewind button's
-- lock state, same convention as get_likes_remaining/get_super_likes_remaining
-- -- except those two never check that the caller IS p_user_id (any
-- authenticated client can already query someone else's remaining swipe/
-- super-like count today, a smaller sibling of the get_fallback_feed leak
-- fixed earlier this session; flagging that as pre-existing rather than
-- silently copying the same gap into this new function).
CREATE OR REPLACE FUNCTION public.get_rewinds_remaining(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_features JSONB;
  v_limit    INT;
  v_used     INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot query rewind quota for another user';
  END IF;

  SELECT pc.features INTO v_features
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = p_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  IF v_features IS NULL THEN
    SELECT features INTO v_features FROM public.plan_catalog WHERE plan_slug = 'free';
  END IF;

  v_limit := COALESCE((v_features->>'daily_rewinds')::INT, 0);

  IF v_limit < 0 OR v_limit >= 999 THEN
    RETURN 999;
  END IF;
  IF v_limit = 0 THEN
    RETURN 0;
  END IF;

  SELECT CASE WHEN quota_date = CURRENT_DATE THEN used_count ELSE 0 END
  INTO v_used
  FROM public.daily_rewind_quota
  WHERE user_id = p_user_id;
  v_used := COALESCE(v_used, 0);

  RETURN GREATEST(0, v_limit - v_used);
END;
$$;

REVOKE ALL ON FUNCTION public.get_rewinds_remaining(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_rewinds_remaining(UUID) TO authenticated;
