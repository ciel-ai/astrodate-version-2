-- ============================================================================
-- messages: add indexes covering channel_id
-- ----------------------------------------------------------------------------
-- messages had indexes on created_at and moderation_status, but nothing
-- covering channel_id -- yet every chat-thread query filters by it first
-- (src/lib/chats.ts):
--   * pagination: .eq('channel_id', channelId).order('created_at', desc).limit(20)
--   * mark-as-read: .eq('channel_id', channelId).eq('receiver_id', user.id).eq('is_read', false)
-- With low row counts Postgres doesn't notice; at real message volume the
-- first becomes a full-table sort and the second a full-table scan on every
-- chat open. Two indexes, one per query shape.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_messages_channel_created
  ON public.messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_channel_unread
  ON public.messages(channel_id, receiver_id)
  WHERE is_read = false;
