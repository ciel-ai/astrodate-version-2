import { supabase } from '@/lib/supabase';
import { withTimeout } from './network';

// ---------------------------------------------------------------------------
// "Today Favors [sign]" — Daily Insights Phase 2. Pure DB query (get_todays_
// match_nudge), reusing the caller's own Discover pool (get_fallback_feed) and
// the fully-precomputed western_compatibility_cache. No Astrology API call,
// no Edge Function. See 20260707010000_todays_match_nudge.sql.
// ---------------------------------------------------------------------------

export type TodaysMatchNudge = {
  day_ruler_sign: string;
  favored_sign: string | null;
  match_count: number;
  sample_user_ids: string[];
  /** Same order as sample_user_ids — for avatar-initials placeholders (this
   * app has no real photo-URL rendering yet; every avatar is initials-based). */
  sample_names: string[];
};

/**
 * Fetches today's favored zodiac sign among the user's own Discover pool,
 * plus a small sample of matching candidates (id + name, for avatar-initials
 * placeholders). Returns null on any error; `favored_sign: null` (not an
 * error) means the pool currently has no candidates matching a cached sign.
 */
export async function getTodaysMatchNudge(
  userId: string,
  sampleSize = 3
): Promise<TodaysMatchNudge | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase.rpc('get_todays_match_nudge', {
          input_user_id: userId,
          p_sample_size: sampleSize,
        })
      ),
      15000,
      'getTodaysMatchNudge timed out'
    );

    if (error) {
      console.warn('[match-nudge] get_todays_match_nudge failed:', error.message);
      return null;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;

    return {
      day_ruler_sign: row.day_ruler_sign,
      favored_sign: row.favored_sign,
      match_count: row.match_count,
      sample_user_ids: row.sample_user_ids ?? [],
      sample_names: row.sample_names ?? [],
    };
  } catch (err: any) {
    console.warn('[match-nudge] getTodaysMatchNudge exception (non-fatal):', err?.message ?? err);
    return null;
  }
}
