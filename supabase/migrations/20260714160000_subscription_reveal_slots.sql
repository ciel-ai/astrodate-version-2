-- ============================================================================
-- Replace the rolling-window see_who_likes_you cap (20260714150000) with a
-- persistent, per-billing-period reveal-slot model.
--
-- Why the previous fix wasn't enough: capping visibility to "the 5 most
-- recent pending likes" is a live snapshot, not a spend ledger. Liking back a
-- visible card creates an instant mutual match (like_back(), see
-- 20260707050000) and matched users are excluded from get_who_liked_me()'s
-- eligible set entirely -- so revealing + liking back your 5 visible cards
-- immediately frees 5 new slots for the next-most-recent likers to roll into.
-- Repeat enough times and an Astro+ user reveals + matches with 100% of
-- everyone who ever liked them, same lifetime outcome as AstroX, just spread
-- across sessions instead of instant. The "cap" never actually capped
-- anything long-term.
--
-- New model, decided with user:
--   1. Reveals are a PERMANENT per-row fact (reuses the existing
--      reveal_state/reveal_source columns from 20260707040000's free-reveal
--      mechanic -- 'subscription' was already a valid reveal_source value,
--      just never written anywhere until now).
--   2. Astro+ gets `see_who_likes_you` (5) reveal SLOTS that refill every
--      billing period -- consistent with how daily_likes/weekly_super_likes/
--      daily_rewinds already work, instead of a lifetime-once cap. The
--      period boundary is the caller's own subscription's
--      current_period_start (renewals push it forward, so counting
--      'subscription'-revealed rows with revealed_at >= current_period_start
--      naturally implements the refill with no cron/reset job needed).
--   3. The USER CHOOSES which locked profile to spend a slot on -- mirrors
--      spend_free_reveal(p_liker_id)'s existing UX exactly, generalized to a
--      second reveal source with a per-period limit instead of a lifetime-one
--      boolean.
--   4. AstroX keeps unconditional visibility (see_who_likes_you = -1) -- no
--      slots to spend, nothing to persist, unchanged from before this
--      migration or 20260714150000.
--
-- Known accepted edge case: since AstroX visibility is computed live and
-- never persists a 'subscription' reveal_state, a user who downgrades
-- AstroX -> Astro+ starts with a full 5 slots and zero pre-revealed profiles,
-- even if they'd seen more than 5 people while on AstroX. This matches "a
-- downgrade lowers your access" and was accepted as reasonable rather than
-- auto-persisting reveals for AstroX (which would add a write to every
-- AstroX get_who_liked_me() call for a benefit that only matters on
-- downgrade).
-- ============================================================================

ALTER TABLE public.user_likes ADD COLUMN IF NOT EXISTS revealed_at TIMESTAMPTZ;
COMMENT ON COLUMN public.user_likes.revealed_at IS 'When reveal_state became revealed (any reveal_source). Used to scope spend_subscription_reveal''s per-billing-period slot count to the caller''s current period. NULL while locked.';

-- Backfill: rows already revealed before this column existed have no way to
-- know their true reveal time. Free-reveal rows (reveal_source='free_reveal')
-- never count toward the subscription-slot query below regardless of this
-- value, so this is cosmetic hygiene, not a correctness fix.
UPDATE public.user_likes SET revealed_at = updated_at WHERE reveal_state = 'revealed' AND revealed_at IS NULL;

-- ============================================================================
-- get_who_liked_me(): is_visible is now (unlimited plan) OR (reveal_state =
-- 'revealed') -- dropping the ROW_NUMBER()-based live ranking introduced in
-- 20260714150000. Also surfaces subscription_reveals_remaining so the client
-- can show "3 of 5 reveals left" and gate the spend-a-reveal button.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_who_liked_me()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id                    UUID := auth.uid();
  v_plan_slug                   TEXT;
  v_plan_features                JSONB;
  v_period_start                 TIMESTAMPTZ;
  v_is_paid                     BOOLEAN;
  v_see_limit                    INT;
  v_reveals_remaining             INT;
  v_my_sign                     TEXT;
  v_free_reveal_used             BOOLEAN;
  v_count                        INT;
  v_unseen_count                 INT;
  v_free_reveal_available        BOOLEAN;
  v_likers                       JSONB;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pc.plan_slug, pc.features, us.current_period_start
  INTO v_plan_slug, v_plan_features, v_period_start
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');
  v_is_paid := (v_plan_slug <> 'free');
  v_see_limit := COALESCE((v_plan_features->>'see_who_likes_you')::INT, 0);

  IF v_see_limit >= 0 THEN
    SELECT COUNT(*) INTO v_reveals_remaining
    FROM public.user_likes
    WHERE liked_user_id = v_user_id
      AND reveal_source = 'subscription'
      AND revealed_at >= COALESCE(v_period_start, '-infinity'::timestamptz);
    v_reveals_remaining := GREATEST(0, v_see_limit - v_reveals_remaining);
  ELSE
    v_reveals_remaining := NULL; -- unlimited plan, nothing to spend
  END IF;

  SELECT COALESCE(up.free_reveal_used, true) INTO v_free_reveal_used
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id;

  v_free_reveal_used := COALESCE(v_free_reveal_used, true);

  SELECT ad.western_sign INTO v_my_sign
  FROM public.astro_details ad
  WHERE ad.user_id = v_user_id;

  WITH eligible_likes AS (
    SELECT
      ul.user_id,
      ul.action_type,
      ul.reveal_state,
      ul.reveal_source,
      ul.seen,
      ul.created_at,
      up.full_name,
      wcc.compatibility_percentage AS compatibility_score,
      (
        SELECT p.photo_url
        FROM public.user_photos p
        WHERE p.user_id = ul.user_id
        ORDER BY p.is_primary DESC, p.display_order ASC
        LIMIT 1
      ) AS photo_url
    FROM public.user_likes ul
    JOIN public.user_profiles up ON up.user_id = ul.user_id
    LEFT JOIN public.astro_details ad ON ad.user_id = ul.user_id
    LEFT JOIN public.western_compatibility_cache wcc
      ON wcc.sign_a = v_my_sign AND wcc.sign_b = ad.western_sign
    WHERE ul.liked_user_id = v_user_id
      AND ul.action_type IN ('like', 'super_like')
      AND up.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.block_users b
        WHERE (b.blocker_id = v_user_id AND b.blocked_id = ul.user_id)
           OR (b.blocker_id = ul.user_id AND b.blocked_id = v_user_id)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.reports r
        WHERE r.reported_user_id = ul.user_id AND r.status = 'actioned'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE um.user1_id = LEAST(v_user_id, ul.user_id)
          AND um.user2_id = GREATEST(v_user_id, ul.user_id)
      )
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT seen),
    BOOL_OR((NOT v_free_reveal_used) AND reveal_state = 'locked'),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id',             user_id,
          'action_type',         action_type,
          'reveal_state',        reveal_state,
          'is_visible',          (v_see_limit < 0 OR reveal_state = 'revealed'),
          'reveal_source',       CASE WHEN v_see_limit < 0 OR reveal_state = 'revealed' THEN reveal_source ELSE NULL END,
          'full_name',           CASE WHEN v_see_limit < 0 OR reveal_state = 'revealed' THEN full_name ELSE NULL END,
          'photo_url',           CASE WHEN v_see_limit < 0 OR reveal_state = 'revealed' THEN photo_url ELSE NULL END,
          'compatibility_score', compatibility_score,
          'seen',                seen,
          'created_at',          created_at
        ) ORDER BY created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_count, v_unseen_count, v_free_reveal_available, v_likers
  FROM eligible_likes;

  RETURN jsonb_build_object(
    'is_paid',                     v_is_paid,
    'plan_slug',                    v_plan_slug,
    'subscription_reveals_remaining', v_reveals_remaining,
    'count',                        COALESCE(v_count, 0),
    'unseen_count',                  COALESCE(v_unseen_count, 0),
    'free_reveal_used',              v_free_reveal_used,
    'free_reveal_available',         COALESCE(v_free_reveal_available, false),
    'likes',                         v_likers
  );
END;
$$;

-- ============================================================================
-- spend_subscription_reveal(): caller-chosen locked profile, atomically
-- checked against their current period's remaining slots. Mirrors
-- spend_free_reveal()'s shape/trust filters exactly; only the allowance
-- source differs (per-period plan slots vs. a lifetime free boolean).
-- Rejects free-tier callers and unlimited-plan callers (AstroX has nothing
-- to spend -- everything is already visible) with a clear reason each.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.spend_subscription_reveal(p_liker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID := auth.uid();
  v_plan_slug      TEXT;
  v_plan_features   JSONB;
  v_period_start    TIMESTAMPTZ;
  v_see_limit       INT;
  v_used            INT;
  v_revealed        BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_liker_id IS NULL THEN
    RAISE EXCEPTION 'p_liker_id is required';
  END IF;

  SELECT pc.plan_slug, pc.features, us.current_period_start
  INTO v_plan_slug, v_plan_features, v_period_start
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status IN ('active', 'past_due', 'canceled')
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');
  v_see_limit := COALESCE((v_plan_features->>'see_who_likes_you')::INT, 0);

  IF v_plan_slug = 'free' THEN
    RAISE EXCEPTION 'no_subscription_reveal_slots';
  END IF;

  IF v_see_limit < 0 THEN
    RAISE EXCEPTION 'plan_already_unlimited';
  END IF;

  SELECT COUNT(*) INTO v_used
  FROM public.user_likes
  WHERE liked_user_id = v_user_id
    AND reveal_source = 'subscription'
    AND revealed_at >= COALESCE(v_period_start, '-infinity'::timestamptz);

  IF v_used >= v_see_limit THEN
    RAISE EXCEPTION 'subscription_reveal_limit_reached';
  END IF;

  UPDATE public.user_likes ul
  SET reveal_state = 'revealed',
      reveal_source = 'subscription',
      revealed_at = now(),
      updated_at = now()
  WHERE ul.user_id = p_liker_id
    AND ul.liked_user_id = v_user_id
    AND ul.action_type IN ('like', 'super_like')
    AND ul.reveal_state = 'locked'
    AND NOT EXISTS (
      SELECT 1 FROM public.block_users b
      WHERE (b.blocker_id = v_user_id AND b.blocked_id = ul.user_id)
         OR (b.blocker_id = ul.user_id AND b.blocked_id = v_user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.reported_user_id = ul.user_id AND r.status = 'actioned'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.user_id = ul.user_id AND up.deleted_at IS NULL
    )
  RETURNING true INTO v_revealed;

  IF v_revealed IS NOT TRUE THEN
    RAISE EXCEPTION 'like_not_found_or_ineligible';
  END IF;

  RETURN jsonb_build_object(
    'success',           true,
    'liker_user_id',      p_liker_id,
    'reveals_remaining',   GREATEST(0, v_see_limit - v_used - 1)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_subscription_reveal(UUID) TO authenticated;
