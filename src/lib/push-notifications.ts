import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from './supabase';
import { withTimeout } from './network';

// ---------------------------------------------------------------------------
// Expo push token registration. Mirrors location.ts's permission model: a
// silent path for state already decided (call on login / app foreground) and
// an explicit path that actually shows the OS prompt.
//
// Server side: register_push_token / revoke_push_token RPCs and the
// notification_delivery_logs / user_push_tokens tables already exist (see
// supabase/migrations/20260630120300_realtime_cron.sql). This module is the
// half that was missing -- nothing was ever writing a token into that table.
//
// No device_id is sent: user_push_tokens is already unique per
// expo_push_token, and omitting device_id means a user signed in on two
// devices keeps both tokens active (both get notified), which is what you
// actually want for a chat/match app -- not a bug, a deliberate simplification.
//
// Expo Go can't do any of this: as of SDK 53, expo-notifications throws the
// instant it's imported on Android inside Expo Go (its own module-scope
// auto-registration effect calls a function that throws). So `Notifications`
// is only required when we're NOT in Expo Go, and every exported function
// below no-ops instead of touching the module otherwise. A development build
// is required to actually exercise push notifications.
// ---------------------------------------------------------------------------

const pushAvailable = !isRunningInExpoGo();

let Notifications: typeof import('expo-notifications') | null = null;

if (pushAvailable) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    Notifications = require('expo-notifications');
  } catch (err) {
    console.warn('[push-notifications] expo-notifications could not be imported:', err);
  }
}

if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (err) {
    console.warn('[push-notifications] Failed to initialize setNotificationHandler:', err);
    Notifications = null; // Disable push notifications downstream
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Matches & messages',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#7C3AED',
  });
}

async function fetchAndRegisterToken(): Promise<boolean> {
  if (!Notifications) return false;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  let expoPushToken: string;
  try {
    const result = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    expoPushToken = result.data;
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed:', err);
    return false;
  }

  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown';
  const { error: rpcError } = await withTimeout(
    Promise.resolve(supabase.rpc('register_push_token', { p_expo_push_token: expoPushToken, p_platform: platform })),
    15000,
    'Push token registration timed out'
  );
  if (rpcError) {
    console.warn('[push] register_push_token failed:', rpcError.message);
    return false;
  }
  return true;
}

/**
 * Silent sync: only runs if permission was ALREADY granted. Never shows a
 * prompt. Safe to call on login / app foreground -- also refreshes
 * last_seen_at and re-registers if the OS rotated the token.
 */
export async function syncPushTokenIfGranted(): Promise<boolean> {
  if (!Notifications) return false;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return false;
    await ensureAndroidChannel();
    return await fetchAndRegisterToken();
  } catch (err) {
    console.warn('[push] syncPushTokenIfGranted error:', err);
    return false;
  }
}

/**
 * Deactivates THIS device's push token, called right before sign-out. Only
 * this device's token, not every token the user has (see the file-level
 * comment: multi-device is deliberate, both devices should keep getting
 * notified while both stay signed in) -- so a shared/reused device stops
 * receiving a signed-out account's notifications without logging out other
 * devices that account is still active on. Must run BEFORE
 * supabase.auth.signOut(): revoke_push_token is auth.uid()-scoped and has no
 * JWT to work with once the session is gone. Best-effort -- a failure here
 * should never block sign-out itself.
 */
export async function revokePushTokenForThisDevice(): Promise<void> {
  if (!Notifications) return;
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    await withTimeout(
      Promise.resolve(supabase.rpc('revoke_push_token', { p_expo_push_token: expoPushToken })),
      10000,
      'revoke_push_token timed out'
    );
  } catch (err) {
    console.warn('[push] revokePushTokenForThisDevice error (non-fatal):', err);
  }
}

/**
 * Explicit opt-in: shows the OS permission prompt (only actually shown the
 * first time -- the OS no-ops on repeat calls once a user has decided).
 * Returns 'registered' | 'denied' | 'error'.
 */
export async function requestAndRegisterPushToken(): Promise<'registered' | 'denied' | 'error'> {
  if (!Notifications) return 'error';
  try {
    await ensureAndroidChannel();
    const { granted } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    if (!granted) return 'denied';
    return (await fetchAndRegisterToken()) ? 'registered' : 'error';
  } catch (err) {
    console.warn('[push] requestAndRegisterPushToken error:', err);
    return 'error';
  }
}

// ---------------------------------------------------------------------------
// Notification tap deep-linking. Routes a tapped push to the screen its
// payload's `type` refers to -- see the enqueue triggers in
// supabase/migrations (enqueue_match_push_notifications,
// enqueue_message_push_notification, enqueue_like_push_notification) and the
// daily-insight-notify / notify-high-matches cron jobs for the exact payload
// shape each type emits.
// 'chat_id' is already produced by the two existing match/message triggers;
// no server-side payload change was needed for this.
// ---------------------------------------------------------------------------
type NotificationTapData = {
  type?: string;
  chat_id?: string;
};

function routeForNotificationTap(data: NotificationTapData): void {
  switch (data.type) {
    case 'match':
    case 'message':
      if (data.chat_id) router.push(`/chat/${data.chat_id}` as any);
      break;
    case 'like_nudge':
      // Already lists the newest like at the top, blurred for free users --
      // that alone makes the tap destination match what the push claimed,
      // no per-notification "highlight this user" plumbing required.
      router.push('/likes' as any);
      break;
    case 'daily_insight':
      router.push('/insights' as any);
      break;
    case 'high_match':
      // get_fallback_feed orders by distance/recency, not score, so the
      // candidate isn't guaranteed to be the very next card -- the claim
      // ("entered your deck") stays true, just not maximally convenient.
      router.push('/discover' as any);
      break;
    default:
      break;
  }
}

/**
 * Wires up notification-tap routing for both a live tap (foreground/
 * background) and a cold start (app launched by tapping a notification, via
 * getLastNotificationResponseAsync). Call once from the root layout; the
 * returned function removes the listener on unmount.
 */
export function registerNotificationTapHandler(): () => void {
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    routeForNotificationTap((response.notification.request.content.data ?? {}) as NotificationTapData);
  });

  Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (response) {
        routeForNotificationTap((response.notification.request.content.data ?? {}) as NotificationTapData);
      }
    })
    .catch((err) => console.warn('[push] getLastNotificationResponseAsync error:', err));

  return () => subscription.remove();
}
