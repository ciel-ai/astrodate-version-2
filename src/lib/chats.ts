import { supabase } from '@/lib/supabase';
import { invokeSupabaseFunctionWithTimeout, withTimeout } from './network';

// ---------------------------------------------------------------------------
// Chats tab data layer. get_my_conversations is the one new RPC (server-side
// aggregation of last message + unread count per match, see
// 20260710190000_chats_backend.sql); everything else (send/paginate/mark-read)
// goes straight through the existing RLS-protected messages/reports tables --
// no RPC wrapper needed for those, RLS already scopes them correctly.
// ---------------------------------------------------------------------------

export type ModerationStatus = 'SAFE' | 'SPAM' | 'HARASSMENT' | 'ILLEGAL';

export type ConversationSummary = {
  channel_id: string;
  other_user_id: string;
  other_user_name: string | null;
  other_user_photo: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  matched_at: string;
};

export type MessageType = 'text' | 'image' | 'audio';

export type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_text: string | null;
  is_read: boolean;
  channel_id: string;
  moderation_status: ModerationStatus;
  created_at: string;
  // Added by 20260714120000_chat_media_messages. Rows created before that
  // migration have message_type absent -> treated as 'text' at the call site.
  message_type?: MessageType;
  media_url?: string | null;
  media_duration_ms?: number | null;
};

const MESSAGES_PAGE_SIZE = 30;

/** Short relative timestamp for the conversation list / message groups
 *  (e.g. "2m", "3h", "Yesterday", "Tue", "12/25"). */
export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffMs = Math.max(now - then, 0);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) {
    return new Date(then).toLocaleDateString(undefined, { weekday: 'short' });
  }
  return new Date(then).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' });
}

/** Returns null on any error/timeout -- callers should treat this as "show a
 *  retry/fallback state", not throw. */
export async function getConversations(): Promise<ConversationSummary[] | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_my_conversations')),
      15000,
      'getConversations timed out'
    );

    if (error) {
      console.warn('[chats] get_my_conversations failed:', error.message);
      return null;
    }

    return (data ?? []) as ConversationSummary[];
  } catch (err: any) {
    console.warn('[chats] getConversations exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

/** Fetches a page of messages, newest-first (matches the inverted FlatList's
 *  expected order -- index 0 renders at the bottom). Pass the oldest loaded
 *  message's created_at as `before` to load the next page further back. */
export async function getMessages(channelId: string, before?: string): Promise<Message[] | null> {
  try {
    let query = supabase
      .from('messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(MESSAGES_PAGE_SIZE);

    if (before) {
      query = query.lt('created_at', before);
    }

    const { data, error } = await withTimeout(Promise.resolve(query), 15000, 'getMessages timed out');

    if (error) {
      console.warn('[chats] getMessages failed:', error.message);
      return null;
    }

    return (data ?? []) as Message[];
  } catch (err: any) {
    console.warn('[chats] getMessages exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export type SendMessageResult =
  | { success: true; moderationStatus: ModerationStatus }
  | { success: false; blocked: boolean; reason: string };

/**
 * Moderates then sends. `id` must be the same client-generated UUID the
 * caller already used to render the optimistic bubble (see
 * message-bubble.tsx / chat/[channelId].tsx) -- reused as the real row's
 * primary key so the message's React key never changes across
 * optimistic -> confirmed, avoiding a flicker on every sent message.
 * Moderation fails open to SAFE on any error so an outage never silently
 * blocks every message in the app.
 */
export async function sendMessage(
  id: string,
  channelId: string,
  receiverId: string,
  messageText: string
): Promise<SendMessageResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, blocked: false, reason: 'Not authenticated' };

    let moderationStatus: ModerationStatus = 'SAFE';
    try {
      const { data, error } = await invokeSupabaseFunctionWithTimeout(
        () =>
          supabase.functions.invoke<{ status: ModerationStatus }>('moderate-message', {
            body: { messageText },
          }),
        15000
      );
      if (!error && data?.status) moderationStatus = data.status;
    } catch (modErr) {
      console.warn('[chats] moderation call failed, failing open to SAFE:', modErr);
    }

    if (moderationStatus === 'ILLEGAL') {
      return {
        success: false,
        blocked: true,
        reason: 'Message violates community guidelines and cannot be sent.',
      };
    }

    const { error } = await withTimeout(
      Promise.resolve(
        supabase.from('messages').insert({
          id,
          sender_id: user.id,
          receiver_id: receiverId,
          message_text: messageText,
          channel_id: channelId,
          moderation_status: moderationStatus,
        })
      ),
      15000,
      'sendMessage timed out'
    );

    if (error) {
      console.warn('[chats] sendMessage insert failed:', error.message);
      const isDbBlocked = error.message?.includes('Message blocked');
      return {
        success: false,
        blocked: isDbBlocked, // Set blocked: true for DB blocklist rejections
        reason: isDbBlocked ? 'Message violates community guidelines.' : error.message,
      };
    }

    return { success: true, moderationStatus };
  } catch (err: any) {
    console.warn('[chats] sendMessage exception:', err?.message ?? err);
    const isDbBlocked = err?.message?.includes('Message blocked');
    return {
      success: false,
      blocked: isDbBlocked,
      reason: isDbBlocked ? 'Message violates community guidelines.' : (err?.message ?? 'Failed to send message'),
    };
  }
}

export type SendMediaResult =
  | { success: true; mediaUrl: string }
  | { success: false; reason: string };

/**
 * Uploads a photo or voice note to the `messages` storage bucket, then inserts
 * a media message row. `id` is the client-generated UUID already used for the
 * optimistic bubble (same contract as sendMessage). Media rows skip text
 * moderation -- there's no text to classify -- and are stored under the
 * sender's uid folder, which the bucket's INSERT policy requires. The bucket
 * is public (see the migration), so the returned URL is readable by the
 * receiver too. The screen swaps its optimistic local-file bubble for this URL
 * on success.
 */
export async function sendMediaMessage(
  id: string,
  channelId: string,
  receiverId: string,
  media: {
    kind: Exclude<MessageType, 'text'>;
    bytes: ArrayBuffer;
    ext: string;
    contentType: string;
    durationMs?: number;
  }
): Promise<SendMediaResult> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { success: false, reason: 'Not authenticated' };

    const filePath = `${user.id}/${id}.${media.ext}`;

    const { error: uploadError } = await withTimeout(
      Promise.resolve(
        supabase.storage.from('messages').upload(filePath, media.bytes, { contentType: media.contentType })
      ),
      30000,
      'media upload timed out'
    );
    if (uploadError) {
      console.warn('[chats] media upload failed:', uploadError.message);
      return { success: false, reason: uploadError.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('messages').getPublicUrl(filePath);

    const { error } = await withTimeout(
      Promise.resolve(
        supabase.from('messages').insert({
          id,
          sender_id: user.id,
          receiver_id: receiverId,
          channel_id: channelId,
          message_type: media.kind,
          media_url: publicUrl,
          media_duration_ms: media.durationMs ?? null,
          moderation_status: 'SAFE',
        })
      ),
      15000,
      'sendMediaMessage timed out'
    );

    if (error) {
      // Row insert failed after the object uploaded -- remove the orphan.
      await supabase.storage.from('messages').remove([filePath]).catch(() => {});
      console.warn('[chats] sendMediaMessage insert failed:', error.message);
      return { success: false, reason: error.message };
    }

    return { success: true, mediaUrl: publicUrl };
  } catch (err: any) {
    console.warn('[chats] sendMediaMessage exception:', err?.message ?? err);
    return { success: false, reason: err?.message ?? 'Failed to send media' };
  }
}

/** Marks all unread-by-me messages in a thread as read. Debounce at the call
 *  site (see chat/[channelId].tsx) -- this itself just does the update. */
export async function markThreadRead(channelId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('messages')
          .update({ is_read: true })
          .eq('channel_id', channelId)
          .eq('receiver_id', user.id)
          .eq('is_read', false)
      ),
      10000,
      'markThreadRead timed out'
    );

    if (error) {
      console.warn('[chats] markThreadRead failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[chats] markThreadRead exception (non-fatal):', err?.message ?? err);
    return false;
  }
}

/** Blocks the other user (mutual match/messaging becomes impossible going
 *  forward -- existing rows aren't retroactively deleted, they just stop
 *  showing up: get_my_conversations excludes blocked pairs server-side). */
export async function blockAndLeave(userId: string): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(supabase.rpc('block_user', { p_blocked_id: userId })),
      15000,
      'blockAndLeave timed out'
    );

    if (error) {
      console.warn('[chats] block_user failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[chats] blockAndLeave exception (non-fatal):', err?.message ?? err);
    return false;
  }
}

export async function reportUser(
  reportedUserId: string,
  channelId: string | null,
  category: string,
  subcategory?: string
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await withTimeout(
      Promise.resolve(
        supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          channel_id: channelId,
          category,
          subcategory: subcategory ?? null,
        })
      ),
      15000,
      'reportUser timed out'
    );

    if (error) {
      console.warn('[chats] reportUser failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[chats] reportUser exception (non-fatal):', err?.message ?? err);
    return false;
  }
}

export type BlockedUser = {
  user_id: string;
  full_name: string | null;
  photo_url: string | null;
  blocked_at: string;
};

/** Lists everyone the current user has blocked, most recent first (see
 *  get_my_blocked_users(), 20260716140000_blocked_users_management.sql). */
export async function getMyBlockedUsers(): Promise<BlockedUser[] | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_my_blocked_users')),
      15000,
      'getMyBlockedUsers timed out'
    );
    if (error) {
      console.warn('[chats] getMyBlockedUsers failed:', error.message);
      return null;
    }
    return (data as BlockedUser[]) ?? [];
  } catch (err: any) {
    console.warn('[chats] getMyBlockedUsers exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export async function unblockUser(userId: string): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(supabase.rpc('unblock_user', { p_blocked_id: userId })),
      15000,
      'unblockUser timed out'
    );
    if (error) {
      console.warn('[chats] unblockUser failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[chats] unblockUser exception (non-fatal):', err?.message ?? err);
    return false;
  }
}
