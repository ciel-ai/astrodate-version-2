import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth';
import { getMembershipOrFree, type MembershipSummary } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';

type SubscriptionContextType = {
  membership: MembershipSummary | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

const SubscriptionContext = createContext<SubscriptionContextType>({
  membership: null,
  isLoading: true,
  refetch: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [membership, setMembership] = useState<MembershipSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMembership = useCallback(async () => {
    if (!user) {
      setMembership(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const data = await getMembershipOrFree();
    setMembership(data);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMembership();
  }, [fetchMembership]);

  // Realtime: re-fetch the instant the webhook (or the locked-down
  // sync_ios_subscription service-role path) flips user_subscriptions.status.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('subscription-' + user.id)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `user_id=eq.${user.id}`,
        },
        () => void fetchMembership()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchMembership]);

  return (
    <SubscriptionContext.Provider value={{ membership, isLoading, refetch: fetchMembership }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscriptionStatus = () => useContext(SubscriptionContext);
