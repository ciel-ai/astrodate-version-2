-- ============================================================================
-- Close three related RLS gaps found in the 2026-07-28 pre-launch audit
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_matches: drop client-facing INSERT/UPDATE
-- ----------------------------------------------------------------------------
-- WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id) is trivially
-- satisfiable by ANY signed-in caller who knows a target's UUID (readily
-- available from the discover deck, who-liked-me, and sent-likes responses),
-- letting them fabricate a "match" with a total stranger via a direct REST
-- insert -- no swipe, no mutual like, no consent. That fake match then fires
-- the real match push notification to the victim, satisfies the messages
-- table's match-existence check (letting the attacker message the victim),
-- and lets the attacker call generate-icebreaker to read the victim's data.
--
-- Legitimate matches are created exclusively by record_swipe() (SECURITY
-- DEFINER, bypasses RLS entirely). No client code anywhere calls
-- .insert()/.update() on user_matches directly -- this policy was pure unused
-- attack surface, the same pattern already closed for other tables in
-- 20260718150000_rls_audit_fixes.sql but missed for this one.
-- SELECT is untouched (needed for realtime subscriptions + icebreaker.ts).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own matches" ON public.user_matches;
DROP POLICY IF EXISTS "Users can update own matches" ON public.user_matches;

-- ----------------------------------------------------------------------------
-- user_likes: drop client-facing INSERT/UPDATE/DELETE
-- ----------------------------------------------------------------------------
-- Same shape as user_matches above: WITH CHECK (auth.uid() = user_id) is the
-- only gate. All quota/eligibility logic (daily like limits, deck filters,
-- block checks) lives only inside record_swipe()/like_back()/rewind_last_swipe
-- (all SECURITY DEFINER, bypass RLS) -- there is no trigger enforcing any of
-- it at the table level. A direct insert lets any free-tier user bypass the
-- daily like quota entirely, target users outside their deck filters, and
-- pre-stage a guaranteed future match against a chosen victim. UPDATE further
-- allows retroactively rewriting action_type (e.g. dislike -> super_like),
-- bypassing the atomic super-like spend.
-- SELECT is untouched.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own likes" ON public.user_likes;
DROP POLICY IF EXISTS "Users can update own likes" ON public.user_likes;
DROP POLICY IF EXISTS "Users can delete own likes" ON public.user_likes;

-- ----------------------------------------------------------------------------
-- messages: require media_url to actually belong to the sender
-- ----------------------------------------------------------------------------
-- Chat image/audio messages (message_type <> 'text') have insert directly
-- from the client since 20260723120000 (text messages moved server-side that
-- day; media messages were explicitly left as-is because there's no text to
-- classify). The INSERT policy never validated media_url itself, so a caller
-- with a valid JWT could insert a message row pointing at ANY external URL --
-- not just unmoderated content, but a URL on a domain of the attacker's
-- choosing, leaking the recipient's IP/device metadata to that host the
-- moment they open the thread (the chat UI renders media_url unconditionally).
--
-- This is a stop-gap, not full moderation: it only proves the media object
-- lives under the sender's own folder in the messages storage bucket (the
-- same ownership shape the bucket's own storage policy already requires for
-- uploads, and the same check moderate-photo does for profile photos). It
-- does NOT run any content classification on chat images/audio -- that
-- requires a real moderate-chat-media function (tracked separately) mirroring
-- moderate-photo's Gemini-vision gate.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    message_type <> 'text'
    AND auth.uid() = sender_id
    AND (
      media_url IS NULL
      OR media_url LIKE '%/storage/v1/object/public/messages/' || auth.uid()::text || '/%'
    )
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
