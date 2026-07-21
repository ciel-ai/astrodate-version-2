import { supabase } from './supabase';
import { invokeSupabaseFunctionWithTimeout, withTimeout } from './network';

/**
 * Kicks off Gemini icebreaker generation for a freshly created match. Fire-
 * and-forget by design -- callers must not await this in the swipe hot path
 * (see discover.tsx). generate-icebreaker is idempotent, so calling this more
 * than once for the same match is harmless.
 */
export async function triggerIcebreakerGeneration(matchId: string): Promise<void> {
  try {
    await invokeSupabaseFunctionWithTimeout(
      () => supabase.functions.invoke('generate-icebreaker', { body: { match_id: matchId } }),
      15000
    );
  } catch (err: any) {
    console.warn('[icebreaker] generation request failed (non-fatal):', err?.message ?? err);
  }
}

/** Reads the pre-generated icebreaker for a match by channel_id (unique per
 *  match). Never triggers generation -- the chat screen only reads; the
 *  match handler is what triggers. Returns null on any error, or while
 *  generation is still pending, so callers should fall back to the plain
 *  empty-thread state. */
export async function getIcebreakerForChannel(channelId: string): Promise<string | null> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase.from('user_matches').select('icebreaker_text').eq('channel_id', channelId).maybeSingle()
      ),
      10000,
      'getIcebreakerForChannel timed out'
    );

    if (error || !data) return null;
    return data.icebreaker_text ?? null;
  } catch (err: any) {
    console.warn('[icebreaker] getIcebreakerForChannel exception (non-fatal):', err?.message ?? err);
    return null;
  }
}
