import { supabase } from '@/lib/supabase';
import { withTimeout } from './network';

// ---------------------------------------------------------------------------
// Discover deck + swipe actions. Pure RPC calls onto get_discover_deck /
// record_swipe (see 20260708170000_discover_deck_builder.sql). All tier
// quota composition, cold-start band fallback, and daily anti-reroll state
// are enforced server-side -- this file just calls the RPCs and shapes the
// response, no client-side gating logic lives here.
// ---------------------------------------------------------------------------

export type DeckBand = 'high' | 'medium' | 'low';

export type DiscoverCardData = {
  user_id: string;
  full_name: string | null;
  gender: string | null;
  age: number | null;
  location: string | null;
  score: number;
  band: DeckBand;
  is_top_match_of_day: boolean | null;
  western_sign: string | null;
  distance_label: string | null;
  fully_computed: boolean;
  personality_score: number | null;
  indian_score: number | null;
  western_score: number | null;
};

export type DiscoverDeckMeta = {
  deck_size: number;
  high_quota: number | null;
  high_percent: number | null;
  high_shown: number;
  more_high_locked_count: number;
};

export type DiscoverDeckResponse = {
  tier: string;
  cards: DiscoverCardData[];
  meta: DiscoverDeckMeta;
};

/** Returns null on any error/timeout -- callers should treat this as "show a
 *  retry/fallback state", not throw. */
export async function getDiscoverDeck(): Promise<DiscoverDeckResponse | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_discover_deck')),
      15000,
      'getDiscoverDeck timed out'
    );

    if (error) {
      console.warn('[discover] get_discover_deck failed:', error.message);
      return null;
    }

    return data as DiscoverDeckResponse;
  } catch (err: any) {
    console.warn('[discover] getDiscoverDeck exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export type SwipeAction = 'like' | 'pass' | 'super_like';

export type RecordSwipeResult =
  | { success: true; action: SwipeAction; matched: boolean; match_id: string | null; channel_id: string | null }
  | { success: false; reason: 'invalid_target' | 'invalid_action' | 'swipe_limit_reached' | 'super_like_limit_reached' };

/** Returns null on any error/timeout (network issue, not a rejection) --
 *  callers should distinguish this from a real {success:false} outcome. */
export async function recordSwipe(
  targetUserId: string,
  action: SwipeAction
): Promise<RecordSwipeResult | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase.rpc('record_swipe', { p_target_user_id: targetUserId, p_action: action })
      ),
      15000,
      'recordSwipe timed out'
    );

    if (error) {
      console.warn('[discover] record_swipe failed:', error.message);
      return null;
    }

    return data as RecordSwipeResult;
  } catch (err: any) {
    console.warn('[discover] recordSwipe exception (non-fatal):', err?.message ?? err);
    return null;
  }
}
