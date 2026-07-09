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

export type DiscoverPhoto = {
  url: string;
  is_primary: boolean;
};

export type DiscoverPrompt = {
  question: string;
  answer: string;
};

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
  manglik_status: boolean | null;
  nadi_dosha: boolean | null;
  bhakoot_dosha: boolean | null;
  /** AstroX-only synastry narrative (Section 3: "Full + synastry 'why you
   *  match'") -- reuses compute-synastry's existing compatibility_summary,
   *  null for every other tier and null when genuinely not yet computed. */
  why_you_match: string | null;
  photos: DiscoverPhoto[];
  prompts: DiscoverPrompt[];
  about: string | null;
};

export type DiscoverDeckMeta = {
  deck_size: number;
  high_quota: number | null;
  high_percent: number | null;
  high_shown: number;
  more_high_locked_count: number;
  /** True when the deck's size was actually capped by today's remaining
   *  swipe quota (as opposed to the tier's own max, or a thin pool) --
   *  i.e. swiping through the whole deck exactly exhausts today's swipes.
   *  Lets the client show "you're out of swipes" even when the deck ends
   *  via a successful final swipe rather than a rejected one. */
  swipes_exhausted: boolean;
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

/** Real remaining-rewind count for the given user (Section 3: Free = 0,
 *  Astro+ = 1/day, AstroX = unlimited (returned as 999)). Used to set the
 *  rewind button's initial locked state accurately -- a tier-only heuristic
 *  can't tell "Astro+ who hasn't used today's rewind yet" apart from
 *  "Astro+ who already spent it in an earlier session today". Returns null
 *  on network/timeout; callers should fall back to treating it as locked
 *  rather than optimistically unlocked. */
export async function getRewindsRemaining(userId: string): Promise<number | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_rewinds_remaining', { p_user_id: userId })),
      15000,
      'getRewindsRemaining timed out'
    );

    if (error) {
      console.warn('[discover] get_rewinds_remaining failed:', error.message);
      return null;
    }

    return data as number;
  } catch (err: any) {
    console.warn('[discover] getRewindsRemaining exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export type RewindResult =
  | { success: true; restored_user_id: string; restored_action: string }
  | { success: false; reason: 'rewind_not_available' | 'rewind_limit_reached' | 'nothing_to_rewind' | 'already_matched' };

/** Undoes the caller's most recent swipe (Section 3: Free = none, Astro+ =
 *  1/day, AstroX = unlimited). Returns null on network/timeout, distinct
 *  from a real {success:false} rejection. */
export async function rewindLastSwipe(): Promise<RewindResult | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('rewind_last_swipe')),
      15000,
      'rewindLastSwipe timed out'
    );

    if (error) {
      console.warn('[discover] rewind_last_swipe failed:', error.message);
      return null;
    }

    return data as RewindResult;
  } catch (err: any) {
    console.warn('[discover] rewindLastSwipe exception (non-fatal):', err?.message ?? err);
    return null;
  }
}
