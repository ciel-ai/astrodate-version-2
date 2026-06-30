-- ============================================================================
-- AstroDate — Row Level Security Policies (squashed from legacy migrations 001-103)
-- ============================================================================
-- FINAL-STATE policies only. Where a table's policies were superseded by a later
-- hardening migration, only the final (most restrictive / most correct) version
-- is included. Priority hardening migrations specifically verified for final
-- state: 027, 049, 057, 059, 061, 089, 102.
-- ============================================================================


-- ============================================================================
-- user_profiles
-- ----------------------------------------------------------------------------
-- History: 001 created own-row CRUD + broad "anyone can check phone" SELECT.
-- 002 duplicated the phone-check policy. 027 dropped the phone-check policy and
-- replaced it with "any authenticated user can read ALL columns of ANY profile"
-- (a SEC leak). 056 dropped that broad policy and replaced it with: own-row
-- SELECT + an unauthenticated-only phone-existence-check policy. 059 (final)
-- removed even the unauthenticated phone-check policy, forcing all phone
-- lookups through the check_auth_user_exists SECURITY DEFINER RPC.
-- FINAL STATE: only own-row SELECT/INSERT/UPDATE/DELETE. No cross-user direct
-- reads — cross-user reads (feed, matching, chat) all go through SECURITY
-- DEFINER RPCs which bypass RLS by design.
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can check phone number existence" ON public.user_profiles;
DROP POLICY IF EXISTS "Authenticated users can read public profile fields" ON public.user_profiles;
DROP POLICY IF EXISTS "Unauthenticated phone existence check" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.user_profiles;

CREATE POLICY "Users can read their own profile"
  ON public.user_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profile"
  ON public.user_profiles
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- astro_details — unchanged since migration 003 (own-row CRUD only)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own astro details" ON public.astro_details;
DROP POLICY IF EXISTS "Users can insert their own astro details" ON public.astro_details;
DROP POLICY IF EXISTS "Users can update their own astro details" ON public.astro_details;
DROP POLICY IF EXISTS "Users can delete their own astro details" ON public.astro_details;

CREATE POLICY "Users can read their own astro details"
  ON public.astro_details FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own astro details"
  ON public.astro_details FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own astro details"
  ON public.astro_details FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own astro details"
  ON public.astro_details FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- user_photos — unchanged since migration 004 (owner-only FOR ALL)
-- ============================================================================
DROP POLICY IF EXISTS "Users can manage their own photos" ON public.user_photos;

CREATE POLICY "Users can manage their own photos"
  ON public.user_photos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================================
-- section1_qns
-- ----------------------------------------------------------------------------
-- History: 006 created with USING(true)/WITH CHECK(true) — wide open to ANY
-- authenticated request regardless of ownership (likely a bug). 049 (hardening,
-- explicitly called out) replaced these with proper auth.uid() = user_id
-- ownership checks. 089 then added an additional broad "any logged-in user can
-- SELECT" policy so other users' answers can be shown in feed/profile-details
-- (this is intentional — matches/likes need to see a candidate's preferences).
-- FINAL STATE: any authenticated user can SELECT (089); only the owner can
-- INSERT/UPDATE/DELETE (049).
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Users can insert their own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Users can update their own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Users can delete their own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Users can read own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Users can insert own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Users can update own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Users can delete own section1 responses" ON public.section1_qns;
DROP POLICY IF EXISTS "Allow logged-in read section1 responses" ON public.section1_qns;

-- 089 (final SELECT policy): any logged-in user may read
CREATE POLICY "Allow logged-in read section1 responses"
  ON public.section1_qns
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- 049 (final hardened write policies): owner only
CREATE POLICY "Users can insert own section1 responses"
  ON public.section1_qns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own section1 responses"
  ON public.section1_qns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own section1 responses"
  ON public.section1_qns
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- onboarding_responses
-- ----------------------------------------------------------------------------
-- History: 018 created with strict own-row CRUD. 089 added a broad logged-in
-- SELECT policy (same rationale as section1_qns — feed/profile-details needs
-- to show bio/languages/education for OTHER users).
-- FINAL STATE: any authenticated user can SELECT; only owner can INSERT/UPDATE/DELETE.
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own onboarding responses" ON public.onboarding_responses;
DROP POLICY IF EXISTS "Users can insert their own onboarding responses" ON public.onboarding_responses;
DROP POLICY IF EXISTS "Users can update their own onboarding responses" ON public.onboarding_responses;
DROP POLICY IF EXISTS "Users can delete their own onboarding responses" ON public.onboarding_responses;
DROP POLICY IF EXISTS "Allow logged-in read onboarding responses" ON public.onboarding_responses;

CREATE POLICY "Allow logged-in read onboarding responses"
  ON public.onboarding_responses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own onboarding responses"
  ON public.onboarding_responses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding responses"
  ON public.onboarding_responses
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own onboarding responses"
  ON public.onboarding_responses
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- personality_qns — unchanged since migration 007 (own-row CRUD only)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own personality_qns" ON public.personality_qns;
DROP POLICY IF EXISTS "Users can insert own personality_qns" ON public.personality_qns;
DROP POLICY IF EXISTS "Users can update own personality_qns" ON public.personality_qns;
DROP POLICY IF EXISTS "Users can delete own personality_qns" ON public.personality_qns;

CREATE POLICY "Users can view own personality_qns"
  ON public.personality_qns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own personality_qns"
  ON public.personality_qns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own personality_qns"
  ON public.personality_qns
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own personality_qns"
  ON public.personality_qns
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- user_prompts — unchanged since migration 075 (broad authenticated SELECT,
-- owner-only writes — intentional, prompts are profile content shown to others)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can view prompts" ON public.user_prompts;
DROP POLICY IF EXISTS "Users can insert own prompts" ON public.user_prompts;
DROP POLICY IF EXISTS "Users can update own prompts" ON public.user_prompts;
DROP POLICY IF EXISTS "Users can delete own prompts" ON public.user_prompts;

CREATE POLICY "Authenticated users can view prompts"
  ON public.user_prompts
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert own prompts"
  ON public.user_prompts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prompts"
  ON public.user_prompts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own prompts"
  ON public.user_prompts
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- user_likes
-- ----------------------------------------------------------------------------
-- History: legacy migration 008 had a blanket "Users can view who liked them"
-- SELECT policy (auth.uid() = liked_user_id) — unrestricted, no tier check.
-- DEVIATION FROM LEGACY (NEW for this version): the subscription plan
-- requires Free = "Count only (blurred)", Astro+/AstroX = "Full" for the
-- Likes tab's who-liked-you view (Section 3) — this is explicitly named in
-- the build plan's risk section as a row-level-security requirement, not a
-- middleware one. A blanket SELECT policy can't express "count only", since
-- RLS gates whole rows, not redacted fields. So that policy is dropped here
-- and NOT recreated — "who liked me" reads must go through the tier-aware
-- get_who_liked_me() RPC (subscriptions.sql) instead, which returns a count
-- for Free and full rows for Astro+/AstroX.
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own likes" ON public.user_likes;
DROP POLICY IF EXISTS "Users can view who liked them" ON public.user_likes;
DROP POLICY IF EXISTS "Users can insert own likes" ON public.user_likes;
DROP POLICY IF EXISTS "Users can update own likes" ON public.user_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.user_likes;

CREATE POLICY "Users can view own likes"
  ON public.user_likes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own likes"
  ON public.user_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own likes"
  ON public.user_likes
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own likes"
  ON public.user_likes
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- user_matches — unchanged since migration 010
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own matches" ON public.user_matches;
DROP POLICY IF EXISTS "Users can insert own matches" ON public.user_matches;
DROP POLICY IF EXISTS "Users can update own matches" ON public.user_matches;

CREATE POLICY "Users can view own matches"
  ON public.user_matches
  FOR SELECT
  USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can insert own matches"
  ON public.user_matches
  FOR INSERT
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Users can update own matches"
  ON public.user_matches
  FOR UPDATE
  USING (auth.uid() = user1_id OR auth.uid() = user2_id)
  WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);


-- ============================================================================
-- user_preferences — unchanged since migration 014 (own-row CRUD only)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;

CREATE POLICY "Users can read their own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================================
-- user_online_status
-- ----------------------------------------------------------------------------
-- History: 020 created with USING(true) broad SELECT (anyone can read anyone's
-- online status — a presence-leak). 051 (hardening, explicitly called out)
-- dropped the broad policy and restricted SELECT to: self, matched users, or
-- users you have an active message thread with.
-- FINAL STATE: scoped SELECT (051); owner-only writes (020, unchanged).
-- ============================================================================
DROP POLICY IF EXISTS "Anyone can read online status" ON public.user_online_status;
DROP POLICY IF EXISTS "Users can read own or matched online status" ON public.user_online_status;
DROP POLICY IF EXISTS "Users can update own status" ON public.user_online_status;

CREATE POLICY "Users can read own or matched online status"
  ON public.user_online_status
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE (
        (um.user1_id = auth.uid() AND um.user2_id = user_id)
        OR (um.user1_id = user_id AND um.user2_id = auth.uid())
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.messages m
      WHERE (
        (m.sender_id = auth.uid() AND m.receiver_id = user_id)
        OR (m.sender_id = user_id AND m.receiver_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can update own status"
  ON public.user_online_status FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPCs (051, unchanged thereafter): SECURITY DEFINER presence lookups that
-- enforce the same scoping as the SELECT policy above, for callers that need
-- a single-user or batch presence check rather than a direct table read.
CREATE OR REPLACE FUNCTION public.get_user_presence(p_target_user_id UUID)
RETURNS TABLE(user_id UUID, is_online BOOLEAN, last_seen TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.user_id, u.is_online, u.last_seen
  FROM public.user_online_status u
  WHERE u.user_id = p_target_user_id
    AND (
      auth.uid() = u.user_id
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (
          (um.user1_id = auth.uid() AND um.user2_id = u.user_id)
          OR (um.user1_id = u.user_id AND um.user2_id = auth.uid())
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.messages m
        WHERE (
          (m.sender_id = auth.uid() AND m.receiver_id = u.user_id)
          OR (m.sender_id = u.user_id AND m.receiver_id = auth.uid())
        )
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_matched_user_presence(p_target_user_ids UUID[])
RETURNS TABLE(user_id UUID, is_online BOOLEAN, last_seen TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT u.user_id, u.is_online, u.last_seen
  FROM public.user_online_status u
  WHERE u.user_id = ANY(p_target_user_ids)
    AND (
      auth.uid() = u.user_id
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (
          (um.user1_id = auth.uid() AND um.user2_id = u.user_id)
          OR (um.user1_id = u.user_id AND um.user2_id = auth.uid())
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.messages m
        WHERE (
          (m.sender_id = auth.uid() AND m.receiver_id = u.user_id)
          OR (m.sender_id = u.user_id AND m.receiver_id = auth.uid())
        )
      )
    );
END;
$$;


-- ============================================================================
-- messages
-- ----------------------------------------------------------------------------
-- History: 021 created basic sender/receiver SELECT + INSERT. 048 rewrote
-- SELECT/INSERT/UPDATE/DELETE to require an active user_matches row (so you can
-- only message people you've matched with) — but had a self-referencing
-- tautology bug (channel_id = channel_id always true regardless of which row).
-- 061 (hardening, explicitly called out) fixed the tautology by qualifying
-- messages.channel_id. 102 (hardening, explicitly called out) added a block-check
-- to the INSERT policy so blocked users cannot message each other, while
-- preserving historical messages/matches on block (block no longer deletes the
-- match — see RPC layer).
-- FINAL STATE: SELECT scoped to sender/receiver; INSERT requires an existing
-- match AND no block in either direction (102); UPDATE limited to receiver
-- (read-marking); DELETE allowed for either participant.
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update received messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages (receivers mark read)" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

CREATE POLICY "Users can view own messages"
  ON public.messages
  FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Final state per migration 102: match required AND no block in either direction
CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.user_matches um
      WHERE um.channel_id = messages.channel_id
        AND ((um.user1_id = auth.uid() AND um.user2_id = receiver_id)
             OR (um.user1_id = receiver_id AND um.user2_id = auth.uid()))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.block_users b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = receiver_id)
         OR (b.blocker_id = receiver_id AND b.blocked_id = auth.uid())
    )
  );

CREATE POLICY "Users can update messages (receivers mark read)"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

CREATE POLICY "Users can delete their own messages"
  ON public.messages
  FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);


-- ============================================================================
-- reports — unchanged since migration 021 (reporter-only INSERT, no SELECT policy)
-- ============================================================================
DROP POLICY IF EXISTS "Users can insert their own reports" ON public.reports;

CREATE POLICY "Users can insert their own reports"
  ON public.reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);


-- ============================================================================
-- swipe_actions — unchanged since migration 021 (owner-only read/insert)
-- ============================================================================
DROP POLICY IF EXISTS "Users can read their own swipe actions" ON public.swipe_actions;
DROP POLICY IF EXISTS "Users can insert their own swipe actions" ON public.swipe_actions;

CREATE POLICY "Users can read their own swipe actions"
  ON public.swipe_actions
  FOR SELECT
  USING (auth.uid() = swiper_id);

CREATE POLICY "Users can insert their own swipe actions"
  ON public.swipe_actions
  FOR INSERT
  WITH CHECK (auth.uid() = swiper_id);


-- ============================================================================
-- block_users — unchanged since migration 077 (blocker-only CRUD, no UPDATE)
-- ============================================================================
DROP POLICY IF EXISTS "Users can select own blocks" ON public.block_users;
DROP POLICY IF EXISTS "Users can insert own blocks" ON public.block_users;
DROP POLICY IF EXISTS "Users can delete own blocks" ON public.block_users;

CREATE POLICY "Users can select own blocks" ON public.block_users
  FOR SELECT USING (blocker_id = auth.uid());

CREATE POLICY "Users can insert own blocks" ON public.block_users
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can delete own blocks" ON public.block_users
  FOR DELETE USING (blocker_id = auth.uid());


-- ============================================================================
-- astro_events — unchanged since migration 045 (read: authenticated; write: service_role)
-- ============================================================================
DROP POLICY IF EXISTS "Authenticated users can read astro events" ON public.astro_events;
DROP POLICY IF EXISTS "Service role can manage astro events" ON public.astro_events;

CREATE POLICY "Authenticated users can read astro events"
  ON public.astro_events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage astro events"
  ON public.astro_events
  FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- user_push_tokens — unchanged since migration 054
-- ============================================================================
DROP POLICY IF EXISTS "Users manage own push tokens" ON public.user_push_tokens;
DROP POLICY IF EXISTS "Service role manages push tokens" ON public.user_push_tokens;

CREATE POLICY "Users manage own push tokens"
  ON public.user_push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages push tokens"
  ON public.user_push_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================================
-- user_notification_preferences — unchanged since migration 054
-- ============================================================================
DROP POLICY IF EXISTS "Users manage own notification preferences" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "Service role reads notification preferences" ON public.user_notification_preferences;

CREATE POLICY "Users manage own notification preferences"
  ON public.user_notification_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role reads notification preferences"
  ON public.user_notification_preferences
  FOR SELECT
  USING (auth.role() = 'service_role');


-- ============================================================================
-- notification_delivery_logs — unchanged since migration 054
-- ============================================================================
DROP POLICY IF EXISTS "Users read own notification logs" ON public.notification_delivery_logs;
DROP POLICY IF EXISTS "Service role manages notification logs" ON public.notification_delivery_logs;

CREATE POLICY "Users read own notification logs"
  ON public.notification_delivery_logs
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages notification logs"
  ON public.notification_delivery_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================================
-- GRANTS for SECURITY DEFINER RPCs whose bodies live outside this squash
-- (declared here since they are part of the security/access-control surface)
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.check_auth_user_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_auth_user_exists(TEXT) TO authenticated;
