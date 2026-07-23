import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useAuth } from './auth';
import { getWhoLikedMe, markLikesSeen, type WhoLikedMeResponse } from '@/lib/likes';

// ---------------------------------------------------------------------------
// Shared "liked you" state. Lifted to context (rather than fetched locally in
// the Likes screen) because the bottom-nav badge dot (rendered by the tabs
// layout, a sibling of the Likes screen) needs the same unseen_count without
// a second network round-trip.
// ---------------------------------------------------------------------------

type LikesContextValue = {
  data: WhoLikedMeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  /** Optimistically clears the badge locally, then confirms with the server. */
  markSeen: () => Promise<void>;
};

const LikesContext = createContext<LikesContextValue>({
  data: null,
  loading: false,
  refresh: async () => {},
  markSeen: async () => {},
});

export function LikesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<WhoLikedMeResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refresh = useCallback(async () => {
    if (!userRef.current) return;
    setLoading(true);
    const result = await getWhoLikedMe();
    if (result) setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void refresh();
    } else {
      setData(null);
    }
  }, [user, refresh]);

  // Unlike ChatsProvider, this can't subscribe to postgres_changes on
  // user_likes directly -- RLS only grants SELECT where auth.uid() =
  // user_id (the liker), deliberately NOT liked_user_id (the recipient),
  // so reveal/paywall gating stays enforced only through get_who_liked_me()
  // and can't be bypassed by a client-side realtime filter. Foreground
  // AppState refresh (same pattern as ChatsProvider) is the safe middle
  // ground: not instant-push, but the badge/list stop being frozen for the
  // rest of a session just because the Likes tab hasn't been revisited.
  useEffect(() => {
    if (!user) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => sub.remove();
  }, [user, refresh]);

  const markSeen = useCallback(async () => {
    if (!userRef.current) return;
    setData((prev) => {
      if (!prev || prev.unseen_count === 0) return prev;
      return { ...prev, unseen_count: 0, likes: prev.likes.map((l) => ({ ...l, seen: true })) };
    });
    await markLikesSeen();
  }, []);

  return (
    <LikesContext.Provider value={{ data, loading, refresh, markSeen }}>
      {children}
    </LikesContext.Provider>
  );
}

export const useLikes = () => useContext(LikesContext);
