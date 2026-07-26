import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from './auth';
import { supabase } from '@/lib/supabase';
import { getConversations, type ConversationSummary } from '@/lib/chats';

// ---------------------------------------------------------------------------
// Shared conversation-list state. Lifted to context (same reasoning as
// LikesProvider) because the bottom-nav badge dot needs totalUnread without
// a second network round-trip, and because this is the first client-side
// realtime consumer in the app -- one subscription here, not one per screen
// that happens to render the tab bar.
// ---------------------------------------------------------------------------

// Module-scope, not per-instance: guards against a race the old per-ref lock
// couldn't cover -- a remount of ChatsProvider (Fast Refresh, or the (tabs)
// layout unmounting/remounting on an auth transition) where the outgoing
// instance's teardown and the incoming instance's setup both target the same
// topic. supabase.channel() dedupes by topic, so if the two operations don't
// serialize against each other -- regardless of which component instance
// issued them -- the new instance's `.on()` can land on the still-joined
// channel object the old instance left behind, throwing "cannot add
// `postgres_changes` callbacks ... after `subscribe()`".
const channelSetupLocks = new Map<string, Promise<void>>();

function runExclusive(key: string, op: () => Promise<void>) {
  const next = (channelSetupLocks.get(key) ?? Promise.resolve()).then(op).catch(() => {});
  channelSetupLocks.set(key, next);
  return next;
}

type ChatsContextValue = {
  conversations: ConversationSummary[];
  totalUnread: number;
  loading: boolean;
  /** True only while a user-initiated pull-to-refresh is in flight -- drives
   *  RefreshControl's spinner. */
  refreshing: boolean;
  /** True when the most recent fetch failed (network/timeout) -- distinct
   *  from a genuinely empty inbox (getConversations returns null on failure,
   *  [] on a real empty list), so the UI can show "couldn't load, retry"
   *  instead of silently rendering the same copy as "no conversations yet". */
  fetchFailed: boolean;
  refresh: () => Promise<void>;
  /** Same fetch, but doesn't toggle `refreshing` -- for focus/realtime/
   *  AppState triggers, so returning to the tab never pops the native
   *  pull-to-refresh spinner (and the list-content jump that comes with it)
   *  when the user didn't ask for a refresh. */
  refreshSilently: () => Promise<void>;
};

const ChatsContext = createContext<ChatsContextValue>({
  conversations: [],
  totalUnread: 0,
  loading: false,
  refreshing: false,
  fetchFailed: false,
  refresh: async () => {},
  refreshSilently: async () => {},
});

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchFailed, setFetchFailed] = useState(false);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const fetchConversations = useCallback(async () => {
    if (!userRef.current) return;
    const result = await getConversations();
    if (result) {
      setConversations(result);
      setFetchFailed(false);
    } else {
      setFetchFailed(true);
    }
  }, []);

  const refreshSilently = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, [fetchConversations]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      void fetchConversations().finally(() => setLoading(false));
    } else {
      setConversations([]);
    }
  }, [user, fetchConversations]);

  // Realtime: a new message addressed to me, or a new match I'm part of,
  // should refresh the list (last-message preview / unread badge / a brand
  // new conversation appearing). RLS already scopes what a client can even
  // receive on these tables -- the filters below are for efficiency, not
  // security, and simply trigger a re-fetch rather than patching state
  // surgically (get_my_conversations is cheap and this keeps the logic in
  // one place instead of duplicating the aggregation client-side).
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    const channelName = `chats-list-${userId}`;
    const topic = `realtime:${channelName}`;
    let active = true;

    // Always remove whatever channel object currently occupies this topic in
    // the client's global registry -- not just one this effect run created --
    // so a leftover from a different ChatsProvider instance (see the
    // channelSetupLocks comment above) gets cleaned up too.
    const removeExisting = async () => {
      const stale = supabase.getChannels().find((c) => c.topic === topic);
      if (stale) await supabase.removeChannel(stale);
    };

    void runExclusive(channelName, async () => {
      await removeExisting();
      if (!active) return;

      supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
          () => {
            void refreshSilently();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_matches', filter: `user1_id=eq.${userId}` },
          () => {
            void refreshSilently();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_matches', filter: `user2_id=eq.${userId}` },
          () => {
            void refreshSilently();
          }
        )
        .subscribe();
    });

    return () => {
      active = false;
      void runExclusive(channelName, removeExisting);
    };
    // Keyed on user.id, not the user object: auth emits a fresh session/user reference on
    // every token refresh, and depending on the whole object would tear down + rebuild this
    // channel on every refresh instead of only on actual login/logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refreshSilently]);

  // Realtime websockets commonly drop when the app backgrounds -- refresh on
  // foreground return (same AppState pattern already used in context/auth.tsx
  // for syncLocationIfGranted) so a resumed session never shows a stale list.
  useEffect(() => {
    if (!user) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void refreshSilently();
      }
    });

    return () => sub.remove();
  }, [user, refreshSilently]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <ChatsContext.Provider value={{ conversations, totalUnread, loading, refreshing, fetchFailed, refresh, refreshSilently }}>
      {children}
    </ChatsContext.Provider>
  );
}

export const useChats = () => useContext(ChatsContext);
