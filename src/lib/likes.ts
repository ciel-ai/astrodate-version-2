import { supabase } from '@/lib/supabase';
import { withTimeout } from './network';

// ---------------------------------------------------------------------------
// "Who liked you" tab. Pure RPC calls onto get_who_liked_me / get_my_sent_likes
// / spend_free_reveal / like_back / mark_likes_seen (see
// 20260707040000_who_liked_me_reveal.sql, 20260707050000_like_back_mechanic.sql,
// 20260707060000_likes_frontend_support.sql). All gating (locked vs revealed,
// free-reveal eligibility, paywall bypass prevention) is enforced server-side
// -- this file just calls the RPCs and shapes the response, no client-side
// gating logic lives here.
// ---------------------------------------------------------------------------

export type LikeCardData = {
  user_id: string;
  action_type: 'like' | 'super_like';
  reveal_state: 'locked' | 'revealed';
  is_visible: boolean;
  reveal_source: 'free_reveal' | 'subscription' | 'one_time_purchase' | null;
  full_name: string | null;
  photo_url: string | null;
  compatibility_score: number | null;
  seen: boolean;
  created_at: string;
};

export type WhoLikedMeResponse = {
  is_paid: boolean;
  plan_slug: string;
  /** Remaining reveal slots for the caller's current billing period (Astro+
   *  only). null on unlimited plans (AstroX) and free, where it's moot. */
  subscription_reveals_remaining: number | null;
  count: number;
  unseen_count: number;
  free_reveal_used: boolean;
  free_reveal_available: boolean;
  likes: LikeCardData[];
};

export type SentLikeData = {
  user_id: string;
  action_type: 'like' | 'super_like';
  full_name: string;
  photo_url: string | null;
  compatibility_score: number | null;
  created_at: string;
};

/** Returns null on any error/timeout -- callers should treat this as "show a
 *  retry/fallback state", not throw. */
export async function getWhoLikedMe(): Promise<WhoLikedMeResponse | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_who_liked_me')),
      15000,
      'getWhoLikedMe timed out'
    );

    if (error) {
      console.warn('[likes] get_who_liked_me failed:', error.message);
      return null;
    }

    return data as WhoLikedMeResponse;
  } catch (err: any) {
    console.warn('[likes] getWhoLikedMe exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export async function getMySentLikes(): Promise<SentLikeData[] | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('get_my_sent_likes')),
      15000,
      'getMySentLikes timed out'
    );

    if (error) {
      console.warn('[likes] get_my_sent_likes failed:', error.message);
      return null;
    }

    return (data?.likes ?? []) as SentLikeData[];
  } catch (err: any) {
    console.warn('[likes] getMySentLikes exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export type SpendFreeRevealResult = { success: true } | { success: false; reason: string };

/** Spends the one lifetime free reveal on the given locked profile. */
export async function spendFreeReveal(likerUserId: string): Promise<SpendFreeRevealResult | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('spend_free_reveal', { p_liker_id: likerUserId })),
      15000,
      'spendFreeReveal timed out'
    );

    if (error) {
      console.warn('[likes] spend_free_reveal failed:', error.message);
      return { success: false, reason: error.message };
    }

    return data as SpendFreeRevealResult;
  } catch (err: any) {
    console.warn('[likes] spendFreeReveal exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export type SpendSubscriptionRevealResult =
  | { success: true; reveals_remaining: number }
  | { success: false; reason: string };

/** Spends one of the caller's Astro+ per-period reveal slots on the given
 *  locked profile. Not applicable to AstroX (already unlimited) or free. */
export async function spendSubscriptionReveal(likerUserId: string): Promise<SpendSubscriptionRevealResult | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('spend_subscription_reveal', { p_liker_id: likerUserId })),
      15000,
      'spendSubscriptionReveal timed out'
    );

    if (error) {
      console.warn('[likes] spend_subscription_reveal failed:', error.message);
      return { success: false, reason: error.message };
    }

    return data as SpendSubscriptionRevealResult;
  } catch (err: any) {
    console.warn('[likes] spendSubscriptionReveal exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

export type LikeBackResult =
  | { success: true; matched: true; match_id: string; channel_id: string; liker_user_id: string }
  | { success: false; reason: 'locked' | 'not_found' };

/** The heart button on a "liked you" card. Server re-checks visibility on
 *  every call -- a 'locked' reason means the UI should open the paywall,
 *  not retry. */
export async function likeBack(likerUserId: string): Promise<LikeBackResult | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(supabase.rpc('like_back', { p_liker_id: likerUserId })),
      15000,
      'likeBack timed out'
    );

    if (error) {
      console.warn('[likes] like_back failed:', error.message);
      return null;
    }

    return data as LikeBackResult;
  } catch (err: any) {
    console.warn('[likes] likeBack exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

/** Clears the unread badge. Call on Likes-tab focus, independent of reveal
 *  state -- seeing a blurred card counts as "seen" even before revealing it. */
export async function markLikesSeen(): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(supabase.rpc('mark_likes_seen')),
      15000,
      'markLikesSeen timed out'
    );

    if (error) {
      console.warn('[likes] mark_likes_seen failed:', error.message);
      return false;
    }

    return true;
  } catch (err: any) {
    console.warn('[likes] markLikesSeen exception (non-fatal):', err?.message ?? err);
    return false;
  }
}
