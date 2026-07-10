import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { withTimeout } from './network';

// ---------------------------------------------------------------------------
// Current-location capture for the "nearby" / distance feature.
//
// Privacy model (mirrors the backend): we send plain lat/lng to the
// `upsert_my_location` RPC, which stores the point server-side. Raw coordinates
// are never read back cross-user — other users only ever see a fuzzed distance
// string from the discovery feed. See migration 20260701120000_nearby_location.
//
// This module never prompts for permission on its own except in
// `requestAndSyncLocation`, which is meant to be called from an explicit
// "Enable location" button with a visible rationale. `syncLocationIfGranted`
// is the silent path used on app foreground / after login.
// ---------------------------------------------------------------------------

/** Read the current device position and persist it via the RPC. */
async function captureAndSave(): Promise<boolean> {
  try {
    // No timeout option on getCurrentPositionAsync itself -- without a
    // GPS fix (indoors, poor signal, location services off at the OS level)
    // this can hang indefinitely, leaving the caller's loading state stuck
    // forever with no error. withTimeout bounds it the same way the RPC
    // call below already is.
    const pos = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // ~100m — plenty for "X km away"
      }),
      15000,
      'Location fix timed out'
    );

    const { error } = await withTimeout(
      Promise.resolve(
        supabase.rpc('upsert_my_location', {
          p_latitude: pos.coords.latitude,
          p_longitude: pos.coords.longitude,
        })
      ),
      15000,
      'Location update timed out'
    );

    if (error) {
      console.warn('[location] upsert_my_location failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[location] captureAndSave error:', err);
    return false;
  }
}

/**
 * Silent sync: only runs if foreground permission was ALREADY granted.
 * Never shows a prompt. Safe to call on login / app foreground.
 * Returns true if a location was captured and saved.
 */
export async function syncLocationIfGranted(): Promise<boolean> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) return false;
    return await captureAndSave();
  } catch (err) {
    console.warn('[location] syncLocationIfGranted error:', err);
    return false;
  }
}

/**
 * Explicit opt-in: request foreground permission (shows the OS prompt), then
 * capture. Call this from a button where the user has seen why we want it.
 * Returns 'saved' | 'denied' | 'error'.
 */
export async function requestAndSyncLocation(): Promise<'saved' | 'denied' | 'error'> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return 'denied';
    return (await captureAndSave()) ? 'saved' : 'error';
  } catch (err) {
    console.warn('[location] requestAndSyncLocation error:', err);
    return 'error';
  }
}

/**
 * Stop sharing and delete the stored point (GDPR/CCPA delete path). The user
 * disappears from distance-filtered discovery immediately.
 */
export async function disableLocationSharing(): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(supabase.rpc('disable_my_location')),
      15000,
      'Location disable timed out'
    );
    if (error) {
      console.warn('[location] disable_my_location failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[location] disableLocationSharing error:', err);
    return false;
  }
}

/** Whether foreground location permission is currently granted (no prompt). */
export async function hasLocationPermission(): Promise<boolean> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    return granted;
  } catch {
    return false;
  }
}
