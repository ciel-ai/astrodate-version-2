import { supabase } from '@/lib/supabase';
import { withTimeout } from './network';

// ---------------------------------------------------------------------------
// "Save to Journal" — backed by saved_insights (20260706130000_daily_insights.sql),
// owner-only RLS, no RPC needed.
// ---------------------------------------------------------------------------

export type SavedInsight = {
  id: string;
  category: string;
  prediction_date: string;
  content: string;
  created_at: string;
};

export async function saveInsight(
  userId: string,
  category: string,
  predictionDate: string,
  content: string
): Promise<boolean> {
  try {
    const { error } = await withTimeout(
      Promise.resolve(
        supabase.from('saved_insights').insert({
          user_id: userId,
          category,
          prediction_date: predictionDate,
          content,
        })
      ),
      15000,
      'saveInsight timed out'
    );
    if (error) {
      console.warn('[saved-insights] saveInsight failed:', error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn('[saved-insights] saveInsight exception (non-fatal):', err?.message ?? err);
    return false;
  }
}

export async function listSavedInsights(userId: string): Promise<SavedInsight[]> {
  try {
    const { data, error } = await withTimeout(
      Promise.resolve(
        supabase
          .from('saved_insights')
          .select('id, category, prediction_date, content, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      ),
      15000,
      'listSavedInsights timed out'
    );
    if (error) {
      console.warn('[saved-insights] listSavedInsights failed:', error.message);
      return [];
    }
    return data ?? [];
  } catch (err: any) {
    console.warn('[saved-insights] listSavedInsights exception (non-fatal):', err?.message ?? err);
    return [];
  }
}
