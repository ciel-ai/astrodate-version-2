-- ============================================================================
-- Two correctness gaps found while diagnosing "a blocked/matched profile
-- still shows up in Discover" reports. The actual reappearing-card symptom
-- turned out to be a client-side stale-deck cache (Discover never refetched
-- on tab focus, unlike every other screen -- fixed separately in
-- src/app/(tabs)/discover.tsx), but auditing the write/read paths around it
-- surfaced two real server-side holes:
--
-- 1. record_swipe() never checked block_users, even though every other
--    read/write path touching a user pair already does (get_fallback_feed,
--    like_back, get_who_liked_me, get_my_conversations). A swipe reaching a
--    blocked pair (e.g. via a stale client-side card) would still spend
--    swipe/super-like quota and could re-touch user_matches. Add the same
--    bidirectional block check already used everywhere else in this
--    codebase, short-circuiting before any quota is consumed.
--
-- 2. get_fallback_feed() never excluded soft-deleted (user_profiles.deleted_at)
--    or moderation-actioned (reports.status = 'actioned') accounts, even
--    though get_who_liked_me/like_back/spend_free_reveal all already carry
--    this exact trust filter. A soft-deleted or actioned-report account could
--    still surface as a live Discover card and be swiped/matched with.
--
-- NOTE ON VERSIONING: originally authored as 20260717130000. Before pushing,
-- `supabase db push` surfaced 5 migrations already applied directly to the
-- linked remote database (20260717140000-20260717180000) that exist nowhere
-- in this repo's git history -- including one occupying the 20260717130000
-- slot itself under a different name/body. Those untracked migrations had
-- also (a) extended get_fallback_feed's RETURNS TABLE with 5 new columns
-- (vedic_sign, nakshatra, height_cm, looking_for, personality_factors) that
-- get_discover_deck now depends on via `SELECT * FROM get_fallback_feed(...)`,
-- and (b) granted EXECUTE on get_fallback_feed/get_discover_deck/record_swipe
-- to `anon` -- the latter meaning get_fallback_feed (whose only same-user
-- guard is skipped entirely when auth.uid() IS NULL) was live-exploitable by
-- anyone with the public anon key to pull any user's discover feed with no
-- login. That anon/public grant was already revoked directly against the
-- live database as an emergency fix before this migration file was finished.
-- Renumbered to 20260717190000 (after the latest known remote version) to
-- avoid re-colliding, and get_fallback_feed's body below was rebuilt from the
-- function's ACTUAL live definition (via pg_get_functiondef against the
-- linked project), not the stale copy in 20260710180000, specifically so
-- this migration adds only the two new filters without reverting those 5
-- columns. See conversation/incident notes for full detail; this is not a
-- change anyone should silently repeat -- if you're reading this while
-- writing a new migration, use `supabase db push`/`migration list --linked`
-- first to confirm local and remote agree before assuming either one.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. record_swipe(): block check added right after basic input validation,
-- before the advisory lock / quota consumption -- same convention as the
-- invalid_target/invalid_action early-returns above it. Byte-for-byte the
-- same body as 20260710130000 otherwise.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_swipe(p_target_user_id UUID, p_action TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID := auth.uid();
  v_db_action    TEXT;
  v_swipe_ok     BOOLEAN;
  v_super_left   INT;
  v_reciprocal   TEXT;
  v_user1        UUID;
  v_user2        UUID;
  v_channel_id   TEXT;
  v_match_id     UUID;
  v_matched      BOOLEAN := false;
  v_existing     public.user_likes%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_target_user_id IS NULL OR p_target_user_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_target');
  END IF;

  IF p_action NOT IN ('like', 'pass', 'super_like') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_action');
  END IF;

  -- Blocked pairs (either direction) can't interact going forward -- same
  -- check already used by get_fallback_feed/like_back/get_my_conversations.
  -- Returned as invalid_target rather than a distinct reason: the client has
  -- no card to show for a blocked user anyway (fresh decks already exclude
  -- them), so this is purely a server-side backstop, not a UI-facing state.
  IF EXISTS (
    SELECT 1 FROM public.block_users b
    WHERE (b.blocker_id = v_user_id AND b.blocked_id = p_target_user_id)
       OR (b.blocker_id = p_target_user_id AND b.blocked_id = v_user_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_target');
  END IF;

  -- Serialize concurrent record_swipe calls for this exact (user, target)
  -- pair so the idempotency check below can't race. hashtext() is a signed
  -- 32-bit hash; pg_advisory_xact_lock takes a bigint key, which is fine.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_target_user_id::text));

  -- Idempotency guard -- must run before any quota is touched.
  SELECT * INTO v_existing
  FROM public.user_likes
  WHERE user_id = v_user_id AND liked_user_id = p_target_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'action', CASE WHEN v_existing.action_type = 'dislike' THEN 'pass' ELSE v_existing.action_type END,
      'matched', false,
      'match_id', NULL,
      'channel_id', NULL
    );
  END IF;

  v_db_action := CASE WHEN p_action = 'pass' THEN 'dislike' ELSE p_action END;

  IF p_action = 'super_like' THEN
    SELECT public.get_super_likes_remaining(v_user_id) INTO v_super_left;
    IF v_super_left <= 0 THEN
      RETURN jsonb_build_object('success', false, 'reason', 'super_like_limit_reached');
    END IF;
  END IF;

  SELECT public.consume_like(v_user_id) INTO v_swipe_ok;
  IF NOT v_swipe_ok THEN
    RETURN jsonb_build_object('success', false, 'reason', 'swipe_limit_reached');
  END IF;

  IF p_action = 'super_like' THEN
    PERFORM public.consume_super_like(v_user_id);
  END IF;

  INSERT INTO public.user_likes (user_id, liked_user_id, action_type)
  VALUES (v_user_id, p_target_user_id, v_db_action)
  ON CONFLICT (user_id, liked_user_id) DO UPDATE
    SET action_type = EXCLUDED.action_type, updated_at = now();

  IF v_db_action IN ('like', 'super_like') THEN
    SELECT ul.action_type INTO v_reciprocal
    FROM public.user_likes ul
    WHERE ul.user_id = p_target_user_id
      AND ul.liked_user_id = v_user_id
      AND ul.action_type IN ('like', 'super_like');

    IF v_reciprocal IS NOT NULL THEN
      v_user1 := LEAST(v_user_id, p_target_user_id);
      v_user2 := GREATEST(v_user_id, p_target_user_id);
      v_channel_id := 'match_' || v_user1::TEXT || '_' || v_user2::TEXT;

      INSERT INTO public.user_matches (user1_id, user2_id, channel_id)
      VALUES (v_user1, v_user2, v_channel_id)
      ON CONFLICT ON CONSTRAINT user_matches_unique DO UPDATE
        SET updated_at = public.user_matches.updated_at
      RETURNING id, channel_id INTO v_match_id, v_channel_id;

      v_matched := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'matched', v_matched,
    'match_id', v_match_id,
    'channel_id', v_channel_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_swipe(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_swipe(UUID, TEXT) TO authenticated;


-- ----------------------------------------------------------------------------
-- 2. get_fallback_feed(): add the same deleted_at / actioned-report trust
-- filter get_who_liked_me/like_back/spend_free_reveal already carry. Base
-- body is the function's actual live definition (5 trailing columns --
-- vedic_sign/nakshatra/height_cm/looking_for/personality_factors -- added by
-- an untracked remote migration; see the note at the top of this file),
-- NOT the stale 20260710180000 copy in this repo. get_discover_deck's
-- `SELECT * FROM get_fallback_feed(...)` depends on this exact column set.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_fallback_feed(uuid, numeric, int);
CREATE OR REPLACE FUNCTION public.get_fallback_feed(
  input_user_id UUID,
  p_distance_multiplier NUMERIC DEFAULT 1,
  p_age_expand INT DEFAULT 0
)
RETURNS TABLE (
  match_user_id UUID,
  full_name TEXT,
  gender TEXT,
  age INT,
  location TEXT,
  final_match_score NUMERIC,
  personality_score NUMERIC,
  indian_score NUMERIC,
  western_score NUMERIC,
  indian_recommendation TEXT,
  western_report TEXT,
  distance_km NUMERIC,
  distance_label TEXT,
  western_sign TEXT,
  fully_computed BOOLEAN,
  manglik_status BOOLEAN,
  nadi_dosha BOOLEAN,
  bhakoot_dosha BOOLEAN,
  why_you_match TEXT,
  vedic_sign TEXT,
  nakshatra TEXT,
  height_cm INT,
  looking_for TEXT,
  personality_factors JSONB
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_min_age           INT;
  v_max_age           INT;
  v_viewer_gender_pref TEXT;
  v_viewer_interest   TEXT[];
  v_viewer_gender     TEXT;
  v_location          TEXT;
  v_max_distance      INT;
  v_viewer_geog       GEOGRAPHY;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> input_user_id THEN
    RAISE EXCEPTION 'Cannot query discover feed for another user';
  END IF;

  SELECT
    COALESCE(up.min_age, 18),
    COALESCE(up.max_age, 65),
    up.gender_preference,
    prof.gender,
    COALESCE(up.location, prof.location),
    COALESCE(up.max_distance, 50)
  INTO v_min_age, v_max_age, v_viewer_gender_pref, v_viewer_gender, v_location, v_max_distance
  FROM public.user_profiles prof
  LEFT JOIN public.user_preferences up ON up.user_id = prof.user_id
  WHERE prof.user_id = input_user_id;

  v_min_age      := GREATEST(COALESCE(v_min_age, 18) - p_age_expand, 18);
  v_max_age      := COALESCE(v_max_age, 65) + p_age_expand;
  v_max_distance := COALESCE(v_max_distance, 50) * p_distance_multiplier;

  SELECT ul.geog INTO v_viewer_geog
  FROM public.user_locations ul
  WHERE ul.user_id = input_user_id AND ul.consent;

  -- user_preferences.gender_preference takes priority if ever set (single
  -- value -- wrapped as a 1-element array for gender_matches_interest);
  -- section1_qns.interest (the real onboarding answer today) otherwise.
  IF v_viewer_gender_pref IS NOT NULL THEN
    v_viewer_interest := ARRAY[v_viewer_gender_pref];
  ELSE
    SELECT s1.interest INTO v_viewer_interest
    FROM public.section1_qns s1
    WHERE s1.user_id = input_user_id;
  END IF;

  RETURN QUERY
  SELECT
    up.user_id AS match_user_id,
    up.full_name,
    up.gender,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age,
    up.location,
    COALESCE(
      ms.total_score,
      ROUND(GREATEST(10.0 - (ROW_NUMBER() OVER (ORDER BY up.updated_at DESC) * 0.2), 1.0)::NUMERIC, 2)
    ) AS final_match_score,
    ms.personality_points AS personality_score,
    ms.indian_points AS indian_score,
    ms.western_points AS western_score,
    CASE WHEN ms.indian_points IS NOT NULL THEN 'Scored' ELSE 'Unscored' END AS indian_recommendation,
    CASE WHEN ms.western_points IS NOT NULL THEN 'Scored' ELSE 'Unscored' END AS western_report,
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      ELSE ROUND((ST_Distance(cand_loc.geog, v_viewer_geog) / 1000.0)::NUMERIC, 1)
    END AS distance_km,
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      WHEN ST_Distance(cand_loc.geog, v_viewer_geog) < 1000 THEN 'Less than 1 km away'
      ELSE ROUND(ST_Distance(cand_loc.geog, v_viewer_geog) / 1000.0)::TEXT || ' km away'
    END AS distance_label,
    ad.western_sign AS western_sign,
    COALESCE(ms.fully_computed, false) AS fully_computed,
    (ms.breakdown->>'manglik_status')::BOOLEAN AS manglik_status,
    (ms.breakdown->>'nadi_dosha')::BOOLEAN AS nadi_dosha,
    (ms.breakdown->>'bhakoot_dosha')::BOOLEAN AS bhakoot_dosha,
    scd.compatibility_summary AS why_you_match,
    ad.indian_sign AS vedic_sign,
    ad.nakshatra_name AS nakshatra,
    NULLIF(regexp_replace(cand_sec1.height, '[^0-9]', '', 'g'), '')::INT AS height_cm,
    cand_sec1.looking_for AS looking_for,
    ms.breakdown->'personality_factors' AS personality_factors
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  LEFT JOIN public.user_preferences cand_pref ON cand_pref.user_id = up.user_id
  LEFT JOIN public.section1_qns cand_sec1 ON cand_sec1.user_id = up.user_id
  LEFT JOIN public.user_locations cand_loc ON cand_loc.user_id = up.user_id AND cand_loc.consent
  LEFT JOIN public.synastry_cache_details scd
    ON scd.user_a_id = LEAST(input_user_id, up.user_id) AND scd.user_b_id = GREATEST(input_user_id, up.user_id)
  CROSS JOIN LATERAL public.get_match_score(input_user_id, up.user_id) AS ms
  WHERE up.user_id <> input_user_id
    AND up.deleted_at IS NULL
    AND up.user_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocked_id FROM public.block_users WHERE blocker_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocker_id FROM public.block_users WHERE blocked_id = input_user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.reported_user_id = up.user_id AND r.status = 'actioned'
    )
    AND (
      ad.birth_date IS NULL
      OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date)) BETWEEN v_min_age AND v_max_age
    )
    -- Does the viewer want to see this candidate's gender?
    AND public.gender_matches_interest(up.gender, v_viewer_interest)
    -- Does the candidate want to see the viewer's gender? (bidirectional)
    AND public.gender_matches_interest(
      v_viewer_gender,
      CASE WHEN cand_pref.gender_preference IS NOT NULL
           THEN ARRAY[cand_pref.gender_preference]
           ELSE cand_sec1.interest
      END
    )
    AND (
      v_viewer_geog IS NULL
      OR cand_loc.geog IS NULL
      OR ST_DWithin(cand_loc.geog, v_viewer_geog, v_max_distance * 1000)
    )
  ORDER BY
    CASE
      WHEN v_viewer_geog IS NULL OR cand_loc.geog IS NULL THEN NULL
      ELSE ST_Distance(cand_loc.geog, v_viewer_geog)
    END ASC NULLS LAST,
    up.updated_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.get_fallback_feed(uuid, numeric, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_fallback_feed(uuid, numeric, int) TO authenticated, service_role;
