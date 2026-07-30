import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { syncLocationIfGranted } from '@/lib/location';
import { revokePushTokenForThisDevice, syncPushTokenIfGranted } from '@/lib/push-notifications';
import { withTimeout } from '@/lib/network';

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
  // Tracks whether we've ever had a session, so we can tell "session was lost"
  // (expired/revoked refresh token, or a stale onAuthStateChange firing after
  // a background tab quietly falls out of auth) apart from "never signed in
  // yet" -- only the former should force-navigate the user anywhere.
  const hadSessionRef = useRef(false);

  useEffect(() => {
    // Get initial session. Wrapped in withTimeout (same convention as every
    // other network call in this app) so a hung storage/session read can't
    // leave `loading` true forever — every screen that gates its first
    // render on auth (e.g. the Daily Insights tab) would otherwise be stuck
    // showing a spinner indefinitely with no way out.
    withTimeout(supabase.auth.getSession(), 10000, 'getSession timed out')
      .then(({ data: { session } }) => {
        hadSessionRef.current = !!session;
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching Supabase session:', err);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const hadSession = hadSessionRef.current;
      hadSessionRef.current = !!session;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Session was lost while we previously had one -- an expired/revoked
      // refresh token, or a raw deep link landing inside (tabs) while signed
      // out. Without this, tab screens are left to their own per-screen null
      // checks (silently empty deck, permanent "no user found" error, or
      // nothing at all), never actually returning the user to a sign-in
      // screen. Manual sign-out (settings.tsx) already does the same
      // dismissAll+replace itself; redoing it here on that same SIGNED_OUT
      // event is a harmless no-op double-navigation to the same destination.
      if (hadSession && !session) {
        router.dismissAll();
        router.replace('/create-account');
      }
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
    syncPushTokenIfGranted();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncLocationIfGranted();
        syncPushTokenIfGranted();
      }
    });

    return () => {
      sub.remove();
    };
  }, [user]);

  const signOut = async () => {
    try {
      await revokePushTokenForThisDevice();
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
