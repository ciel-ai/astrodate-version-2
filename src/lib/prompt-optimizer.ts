import { supabase } from '@/lib/supabase';

export type OptimizePromptResult =
  | { success: true; optimized: string }
  | { success: false; reason: 'quota_exceeded' | 'error' };

/**
 * Polishes a draft prompt answer via the optimize-prompt edge function
 * (Gemini-backed). Capped server-side at 10 calls/day per user by
 * consume_prompt_optimize -- a 429/`quota_exceeded` here is expected once
 * that's hit, not a bug.
 */
export async function optimizePromptAnswer(question: string, answer: string): Promise<OptimizePromptResult> {
  const { data, error } = await supabase.functions.invoke('optimize-prompt', {
    body: { question, answer },
  });

  if (error) {
    // supabase-js surfaces non-2xx responses as an error without the parsed
    // body in older versions -- check the wrapped context for our 429 shape.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 429) return { success: false, reason: 'quota_exceeded' };
    return { success: false, reason: 'error' };
  }

  if (data?.success && typeof data.optimized === 'string') {
    return { success: true, optimized: data.optimized };
  }
  if (data?.error === 'quota_exceeded') {
    return { success: false, reason: 'quota_exceeded' };
  }
  return { success: false, reason: 'error' };
}
