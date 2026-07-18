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

type ChatsContextValue = {
  conversations: ConversationSummary[];
  totalUnread: number;
  loading: boolean;
  refresh: () => Promise<void>;
};

const ChatsContext = createContext<ChatsContextValue>({
  conversations: [],
  totalUnread: 0,
  loading: false,
  refresh: async () => {},
});

export function ChatsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const channelOpRef = useRef<Promise<void>>(Promise.resolve());

  const refresh = useCallback(async () => {
    if (!userRef.current) return;
    setLoading(true);
    const result = await getConversations();
    if (result) setConversations(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh();
    } else {
      setConversations([]);
    }
  }, [user, refresh]);

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
    let active = true;

    // Every setup/teardown for this effect is chained onto channelOpRef,
    // never run standalone. Two independent `setup()` calls racing on the
    // same channelName is exactly what used to throw "cannot add
    // postgres_changes callbacks ... after subscribe()": supabase.channel()
    // dedupes by topic, so a rebuild starting before the previous leave
    // finished would get handed back the still-joining old channel and then
    // call .on() on an already-subscribed instance. Chaining onto a single
    // promise makes every op wait for the previous one to fully finish
    // first, regardless of how many times this effect fires.
    channelOpRef.current = channelOpRef.current.then(async () => {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (!active) return;

      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` },
          () => {
            void refresh();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_matches', filter: `user1_id=eq.${userId}` },
          () => {
            void refresh();
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'user_matches', filter: `user2_id=eq.${userId}` },
          () => {
            void refresh();
          }
        )
        .subscribe();
    });

    return () => {
      active = false;
      channelOpRef.current = channelOpRef.current.then(async () => {
        if (channelRef.current) {
          await supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      });
    };
    // Keyed on user.id, not the user object: auth emits a fresh session/user reference on
    // every token refresh, and depending on the whole object would tear down + rebuild this
    // channel on every refresh instead of only on actual login/logout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refresh]);

  // Realtime websockets commonly drop when the app backgrounds -- refresh on
  // foreground return (same AppState pattern already used in context/auth.tsx
  // for syncLocationIfGranted) so a resumed session never shows a stale list.
  useEffect(() => {
    if (!user) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => sub.remove();
  }, [user, refresh]);

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <ChatsContext.Provider value={{ conversations, totalUnread, loading, refresh }}>
      {children}
    </ChatsContext.Provider>
  );
}

export const useChats = () => useContext(ChatsContext);
