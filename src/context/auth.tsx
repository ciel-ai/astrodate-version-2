import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { syncLocationIfGranted } from '@/lib/location';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error('Error fetching Supabase session:', err);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Silent location refresh for the "nearby" feature. Only runs when a user is
  // signed in AND foreground permission was already granted — it never prompts.
  // The explicit opt-in prompt lives on an "Enable location" button
  // (see requestAndSyncLocation in @/lib/location). Refreshes on login and each
  // time the app returns to the foreground.
  useEffect(() => {
    if (!user) return;

    syncLocationIfGranted();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncLocationIfGranted();
      }
    });

    return () => {
      sub.remove();
    };
  }, [user]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
