import { supabase } from '@/lib/supabase';
import { withTimeout } from './network';

// ---------------------------------------------------------------------------
// Oracle draw state for the Daily Insights tab's sealed/revealed card. Backed
// by user_oracle_draws (20260707020000_oracle_draw_state.sql) — owner-only
// RLS, no RPC needed.
// ---------------------------------------------------------------------------

/** Returns the ISO timestamp of the user's last draw, or null if they've never drawn. */
export async function getLastDrawnAt(userId: string): Promise<string | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('user_oracle_draws')
          .select('last_drawn_at')
          .eq('user_id', userId)
          .maybeSingle()
      ),
      15000,
      'getLastDrawnAt timed out'
    );
    if (error) {
      console.warn('[oracle] getLastDrawnAt failed:', error.message);
      return null;
    }
    return data?.last_drawn_at ?? null;
  } catch (err: any) {
    console.warn('[oracle] getLastDrawnAt exception (non-fatal):', err?.message ?? err);
    return null;
  }
}

/** Whether an ISO timestamp falls on the same device-local calendar day as now. */
export function isSameLocalDay(isoTimestamp: string | null): boolean {
  if (!isoTimestamp) return false;
  return new Date(isoTimestamp).toDateString() === new Date().toDateString();
}

/** Marks the oracle as drawn right now for this user. */
export async function recordOracleDraw(userId: string): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('user_oracle_draws')
          .upsert({ user_id: userId, last_drawn_at: new Date().toISOString() })
      ),
      15000,
      'recordOracleDraw timed out'
    );
    if (error) {
      console.warn('[oracle] recordOracleDraw failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[oracle] recordOracleDraw exception (non-fatal):', err?.message ?? err);
    return false;
  }
}
