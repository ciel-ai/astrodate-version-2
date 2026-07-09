-- "Who liked you" reveal mechanic (Phase 1: DB + reveal logic).
--
-- Corrected mechanic, final form: every free-tier account gets exactly ONE
-- free reveal, for the lifetime of the account, spendable on any locked
-- profile of their choosing. Not weekly, not per-new-like. Do not
-- reintroduce a recurring or per-event version of this.
--
-- Paid visibility is computed at read time as (is_paid OR reveal_state =
-- 'revealed') so upgrading never needs a backfill/migration step.

-- ============================================================================
-- user_likes: per-row reveal state
-- ============================================================================
ALTER TABLE public.user_likes ADD COLUMN IF NOT EXISTS reveal_state text NOT NULL DEFAULT 'locked';
ALTER TABLE public.user_likes ADD COLUMN IF NOT EXISTS reveal_source text;
ALTER TABLE public.user_likes ADD COLUMN IF NOT EXISTS seen boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_likes DROP CONSTRAINT IF EXISTS user_likes_reveal_state_check;
ALTER TABLE public.user_likes ADD CONSTRAINT user_likes_reveal_state_check
  CHECK (reveal_state IN ('locked', 'revealed'));

ALTER TABLE public.user_likes DROP CONSTRAINT IF EXISTS user_likes_reveal_source_check;
ALTER TABLE public.user_likes ADD CONSTRAINT user_likes_reveal_source_check
  CHECK (reveal_source IS NULL OR reveal_source IN ('free_reveal', 'subscription', 'one_time_purchase'));

COMMENT ON COLUMN public.user_likes.reveal_state IS 'Whether the LIKER''s identity is revealed to the person they liked (liked_user_id). Read visibility for paid viewers is computed dynamically (is_paid OR revealed) rather than backfilled on upgrade.';
COMMENT ON COLUMN public.user_likes.reveal_source IS 'How reveal_state became revealed: free_reveal (the one lifetime freebie), subscription, or one_time_purchase. NULL while locked.';
COMMENT ON COLUMN public.user_likes.seen IS 'Unread badge tracking for the liked_user_id''s bottom-nav Likes icon, independent of reveal_state.';

-- Rows that already existed before this feature shipped predate "seen"
-- entirely -- treat them as already-seen so launch doesn't spike every
-- user's unread badge with their full likes history.
UPDATE public.user_likes SET seen = true WHERE seen = false;

CREATE INDEX IF NOT EXISTS idx_user_likes_liked_user_reveal
  ON public.user_likes (liked_user_id, reveal_state)
  WHERE action_type IN ('like', 'super_like');

CREATE INDEX IF NOT EXISTS idx_user_likes_liked_user_seen
  ON public.user_likes (liked_user_id, seen)
  WHERE action_type IN ('like', 'super_like');

-- ============================================================================
-- user_profiles: lifetime free-reveal allowance + soft-delete marker
-- ============================================================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS free_reveal_used boolean NOT NULL DEFAULT false;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.user_profiles.free_reveal_used IS 'Set permanently to true the moment the account spends its one lifetime free reveal. Never reset -- no weekly/recurring/per-like grants.';
COMMENT ON COLUMN public.user_profiles.deleted_at IS 'Soft-delete marker. Accounts with this set are excluded from the who-liked-you grid/count even though the auth.users row (and its cascaded rows) may still exist.';

-- ============================================================================
-- reports: an "actioned" status is required to distinguish acted-on reports
-- from open/dismissed ones for the who-liked-you trust filter below. No such
-- status existed previously (reports were insert-only records).
-- ============================================================================
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'actioned', 'dismissed'));

COMMENT ON COLUMN public.reports.status IS 'pending = unreviewed, actioned = moderation confirmed and acted on the reported account, dismissed = reviewed and no action taken. Only actioned reports exclude an account from who-liked-you.';

CREATE INDEX IF NOT EXISTS idx_reports_reported_user_status ON public.reports (reported_user_id, status) WHERE status = 'actioned';

-- ============================================================================
-- get_who_liked_me(): rewritten to
--   1) always return the (trust-filtered) list, not just a count, so a free
--      user can see and choose which locked profile to spend their one
--      reveal on;
--   2) exclude blocked (either direction), actioned-report, and soft-deleted
--      accounts from BOTH the count and the grid -- the count must never
--      include anything that wouldn't survive being revealed;
--   3) compute per-row visibility dynamically (is_paid OR revealed) instead
--      of relying on stored state, so a subscription upgrade needs no
--      backfill;
--   4) always include user_id (so the client can fetch the compatibility
--      score separately) -- only full_name/photo_url are gated by
--      visibility, the score is never gated.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_who_liked_me()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id               UUID := auth.uid();
  v_plan_slug              TEXT;
  v_is_paid                BOOLEAN;
  v_free_reveal_used        BOOLEAN;
  v_count                   INT;
  v_unseen_count            INT;
  v_free_reveal_available   BOOLEAN;
  v_likers                  JSONB;
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

  SELECT COALESCE(up.free_reveal_used, true) INTO v_free_reveal_used
  FROM public.user_profiles up
  WHERE up.user_id = v_user_id;

  -- Defensive: if the viewer somehow has no profile row, don't offer a free
  -- reveal (treat as already used) rather than granting one incorrectly.
  v_free_reveal_used := COALESCE(v_free_reveal_used, true);

  WITH eligible_likes AS (
    SELECT
      ul.user_id,
      ul.action_type,
      ul.reveal_state,
      ul.reveal_source,
      ul.seen,
      ul.created_at,
      up.full_name,
      (
        SELECT p.photo_url
        FROM public.user_photos p
        WHERE p.user_id = ul.user_id
        ORDER BY p.is_primary DESC, p.display_order ASC
        LIMIT 1
      ) AS photo_url
    FROM public.user_likes ul
    JOIN public.user_profiles up ON up.user_id = ul.user_id
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
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE NOT seen),
    BOOL_OR((NOT v_free_reveal_used) AND reveal_state = 'locked'),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'user_id',       user_id,
          'action_type',   action_type,
          'reveal_state',  reveal_state,
          'is_visible',    (v_is_paid OR reveal_state = 'revealed'),
          'reveal_source', CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN reveal_source ELSE NULL END,
          'full_name',     CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN full_name ELSE NULL END,
          'photo_url',     CASE WHEN v_is_paid OR reveal_state = 'revealed' THEN photo_url ELSE NULL END,
          'seen',          seen,
          'created_at',    created_at
        ) ORDER BY created_at DESC
      ),
      '[]'::jsonb
    )
  INTO v_count, v_unseen_count, v_free_reveal_available, v_likers
  FROM eligible_likes;

  RETURN jsonb_build_object(
    'is_paid',                v_is_paid,
    'plan_slug',               v_plan_slug,
    'count',                   COALESCE(v_count, 0),
    'unseen_count',             COALESCE(v_unseen_count, 0),
    'free_reveal_used',         v_free_reveal_used,
    'free_reveal_available',    COALESCE(v_free_reveal_available, false),
    'likes',                    v_likers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_who_liked_me() TO authenticated;

-- ============================================================================
-- spend_free_reveal(): atomically spend the ONE lifetime free reveal on a
-- caller-chosen locked profile. Both updates happen in the same function
-- call, so if the like-row update fails to match (already revealed, doesn't
-- exist, or excluded by the trust filter), the exception rolls back the
-- free_reveal_used flip too -- the allowance is never burned on a no-op.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.spend_free_reveal(p_liker_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  UUID := auth.uid();
  v_claimed  BOOLEAN;
  v_revealed BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_liker_id IS NULL THEN
    RAISE EXCEPTION 'p_liker_id is required';
  END IF;

  UPDATE public.user_profiles
  SET free_reveal_used = true, updated_at = now()
  WHERE user_id = v_user_id
    AND free_reveal_used = false
  RETURNING true INTO v_claimed;

  IF v_claimed IS NOT TRUE THEN
    RAISE EXCEPTION 'free_reveal_already_used';
  END IF;

  UPDATE public.user_likes ul
  SET reveal_state = 'revealed',
      reveal_source = 'free_reveal',
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

  RETURN jsonb_build_object('success', true, 'liker_user_id', p_liker_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spend_free_reveal(UUID) TO authenticated;

-- ============================================================================
-- mark_likes_seen(): clears the unread badge. Independent of reveal_state --
-- "seen" just means the viewer opened the tab, not that they revealed anyone.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_likes_seen()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_likes
  SET seen = true, updated_at = now()
  WHERE liked_user_id = auth.uid()
    AND action_type IN ('like', 'super_like')
    AND seen = false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_likes_seen() TO authenticated;
