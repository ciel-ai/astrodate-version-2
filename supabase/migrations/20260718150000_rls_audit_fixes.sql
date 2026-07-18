-- ============================================================================
-- Full RLS/grant audit fixes (2026-07-18)
-- ----------------------------------------------------------------------------
-- Live-schema audit (grants + policies pulled via `supabase db query --linked`,
-- not migration-file archaeology) turned up five real gaps. Each was verified
-- against actual client code and RPC bodies before being touched here -- see
-- audit notes for what was checked and ruled out as intentional.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CRITICAL: consume_prompt_optimize / get_prompt_optimize_remaining were
--    callable by `anon` (Supabase's default-privilege auto-grant -- the
--    migration only ever wrote `GRANT ... TO authenticated`, never revoked
--    from anon/PUBLIC). Combined with the internal guard only rejecting an
--    *authenticated* impersonator (auth.uid() IS NOT NULL AND auth.uid() <>
--    p_user_id), an anon caller's NULL auth.uid() sailed through untouched --
--    anyone, no account needed, could consume or read any user's daily
--    prompt-optimize quota. No cron/service-role caller exists for either
--    function (grep confirms client-RPC is the only caller), so unlike the
--    dual-use pattern elsewhere in this schema, these two should always
--    require a real matching session -- tightened accordingly, not just
--    grant-revoked, so the fix doesn't again depend solely on grants holding.
-- ----------------------------------------------------------------------------
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
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
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
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
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

-- Defense in depth: don't rely solely on the body-level check above (that's
-- exactly the assumption that failed here originally) -- also close the
-- grant gap directly.
REVOKE ALL ON FUNCTION public.consume_prompt_optimize(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_prompt_optimize_remaining(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_prompt_optimize(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_prompt_optimize_remaining(UUID) TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. HIGH: onboarding_responses / section1_qns SELECT policies allowed ANY
--    authenticated user to read EVERY row (auth.uid() IS NOT NULL, no owner
--    check) -- religion, weed use, relationship style, lifestyle details,
--    drinking/smoking, bio, height, hobbies, partner_preference, all exposed
--    to any signed-in user via a plain unfiltered select(), no swipe/match/
--    distance/gender filtering, no RPC involved.
--
--    Verified this is safe to narrow: get_fallback_feed/get_discover_deck
--    (the actual discover-feed RPCs) are SECURITY DEFINER and already bypass
--    RLS internally when joining this data for other users' cards, and every
--    client call site (src/lib/onboarding-responses.ts, section1-responses.ts,
--    use-profile-data.ts) reads only .eq('user_id', <own id>). This broad
--    policy is annotated "089 (final SELECT policy)" in the baseline squash,
--    suggesting it predates the RPC-based discover architecture and was never
--    revoked once the RPC took over -- every comparably sensitive table
--    (user_profiles, astro_details, user_preferences) is already owner-scoped
--    only, so this brings these two in line rather than changing behavior
--    anything currently depends on.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow logged-in read onboarding responses" ON public.onboarding_responses;
CREATE POLICY "Users can read their own onboarding responses"
  ON public.onboarding_responses
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow logged-in read section1 responses" ON public.section1_qns;
CREATE POLICY "Users can read their own section1 responses"
  ON public.section1_qns
  FOR SELECT
  USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 3. MEDIUM: daily_like_quota / daily_rewind_quota / super_like_quota /
--    prompt_optimize_quota / discover_deck_daily_state each had a single FOR
--    ALL USING (auth.uid() = user_id) policy -- owner-scoped, but with no
--    restriction on WHAT gets written. Since record_swipe / rewind_last_swipe
--    / consume_prompt_optimize / get_discover_deck are all SECURITY DEFINER
--    and already bypass RLS entirely (confirmed via pg_get_functiondef), the
--    client-facing INSERT/UPDATE/DELETE grant these ALL policies provide
--    serves no purpose the app uses -- but does let any signed-in user
--    directly UPDATE their own used_count back to 0 (or clear
--    high_shown_ids), bypassing every one of these RPCs' rate-limiting logic.
--    No client code references any of these 5 tables directly (confirmed via
--    grep across src/) other than through the RPCs above, so narrowing to
--    SELECT-only changes no working behavior, only closes the bypass.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users manage own like quota" ON public.daily_like_quota;
CREATE POLICY "Users read own like quota" ON public.daily_like_quota
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own rewind quota" ON public.daily_rewind_quota;
CREATE POLICY "Users read own rewind quota" ON public.daily_rewind_quota
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own quota" ON public.super_like_quota;
CREATE POLICY "Users read own super like quota" ON public.super_like_quota
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own prompt optimize quota" ON public.prompt_optimize_quota;
CREATE POLICY "Users read own prompt optimize quota" ON public.prompt_optimize_quota
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own deck state" ON public.discover_deck_daily_state;
CREATE POLICY "Users read own deck state" ON public.discover_deck_daily_state
  FOR SELECT USING (auth.uid() = user_id);


-- ----------------------------------------------------------------------------
-- 4. LOW-MEDIUM: is_deck_eligible(p_viewer_id, p_candidate_id) had no
--    ownership check on p_viewer_id -- any authenticated client could probe
--    arbitrary user pairs for mutual block status, prior-swipe status, and
--    (combined with age/gender-preference assumptions) rough proximity.
--
--    NOT simply locking this to p_viewer_id = auth.uid(): it's legitimately
--    called with arbitrary pairs from the high-match-notification cron worker
--    (20260714130000_high_match_notification.sql, is_deck_eligible(sc.user_a_id,
--    sc.user_b_id) and the reverse), which runs with auth.uid() IS NULL, same
--    as every other trusted-server-context caller in this schema. Applying
--    the same auth.uid() IS NOT NULL AND auth.uid() <> p_viewer_id guard used
--    19 other places in this codebase preserves that path while blocking an
--    authenticated client from querying pairs that aren't their own.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_deck_eligible(p_viewer_id UUID, p_candidate_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_viewer_id THEN
    RETURN false;
  END IF;

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

REVOKE ALL ON FUNCTION public.is_deck_eligible(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_deck_eligible(UUID, UUID) TO authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 5. HYGIENE (not exploitable, no action needed on its own -- included only
--    because it's a one-line no-risk cleanup): check_message_moderation_backstop
--    and enqueue_like_push_notification both show as anon-executable per
--    grants (Supabase's default-privilege auto-grant, same root cause as #1),
--    but both are RETURNS TRIGGER functions -- Postgres refuses to invoke
--    these outside real trigger context, so this was never actually callable.
--    Revoking anyway rather than depending on that invariant holding forever.
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_message_moderation_backstop() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enqueue_like_push_notification() FROM PUBLIC, anon, authenticated;
