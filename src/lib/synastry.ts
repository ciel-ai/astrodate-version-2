import { supabase } from '@/lib/supabase';

export type KootaDetail = {
  description?: string;
  total_points: number;
  received_points: number;
};

export type AshtakootaDetail = {
  varna?: KootaDetail;
  vashya?: KootaDetail;
  tara?: KootaDetail;
  yoni?: KootaDetail;
  maitri?: KootaDetail;
  gan?: KootaDetail;
  bhakut?: KootaDetail;
  nadi?: KootaDetail;
};

export type SynastryDetail = {
  ashtakoota_score: number | null;
  ashtakoota_detail: AshtakootaDetail | null;
  badges: string[];
};

/**
 * Reads the already-computed Ashtakoota breakdown + badges for the caller's
 * pair with `otherUserId` straight from synastry_cache_details -- RLS
 * ("Users can read their own synastry cache details") already scopes rows to
 * the two people in the pair, so no RPC is needed, just the same va/vb
 * pair-ordering convention compute-synastry uses.
 *
 * Returns null if synastry hasn't been computed for this pair yet (the deck
 * card's `fully_computed` will be false in that case) -- callers should hide
 * the relevant UI rather than render zeros.
 */
export async function getSynastryDetail(otherUserId: string): Promise<SynastryDetail | null> {
  const { data: auth } = await supabase.auth.getUser();
  const me = auth.user?.id;
  if (!me) return null;

  const [userAId, userBId] = [me, otherUserId].sort();

  const { data, error } = await supabase
    .from('synastry_cache_details')
    .select('ashtakoota_score, ashtakoota_detail, badges')
    .eq('user_a_id', userAId)
    .eq('user_b_id', userBId)
    .maybeSingle();

  if (error || !data) return null;

  // compute-synastry stores `badges` as a JSON.stringify'd array inside the
  // jsonb column (rather than a native jsonb array), so it comes back as a
  // plain string here -- parse defensively, don't assume the shape.
  let badges: string[] = [];
  const rawBadges = data.badges as unknown;
  try {
    if (Array.isArray(rawBadges)) {
      badges = rawBadges.filter((b): b is string => typeof b === 'string');
    } else if (typeof rawBadges === 'string') {
      const parsed = JSON.parse(rawBadges);
      if (Array.isArray(parsed)) badges = parsed.filter((b): b is string => typeof b === 'string');
    }
  } catch {
    badges = [];
  }

  return {
    ashtakoota_score: data.ashtakoota_score,
    ashtakoota_detail: (data.ashtakoota_detail as AshtakootaDetail | null) ?? null,
    badges,
  };
}
