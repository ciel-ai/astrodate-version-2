import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

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

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getWhoLikedMe();
    if (result) setData(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) {
      refresh();
    } else {
      setData(null);
    }
  }, [user, refresh]);

  const markSeen = useCallback(async () => {
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
