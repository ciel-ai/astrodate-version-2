-- ============================================================================
-- Require server-side moderation for text messages
-- ============================================================================
-- The INSERT policy previously let any authenticated sender write a `messages`
-- row with any moderation_status they chose (including 'SAFE' for a message
-- that never actually went through the moderate-message Gemini check) -- the
-- app's own client always calls moderate-message first and trusts its result,
-- but nothing enforced that for a caller hitting the REST API directly with a
-- valid anon/authenticated key.
--
-- Text messages (message_type = 'text', the default) must now be inserted by
-- moderate-message itself (service_role, after running the Gemini classifier
-- -- see that function for the match/block checks it replicates, since
-- service_role bypasses RLS). Media messages (image/audio) are unaffected --
-- there's no text to classify, so they keep inserting directly from the
-- client exactly as before.
-- ============================================================================

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;

CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    message_type <> 'text'
    AND auth.uid() = sender_id
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
