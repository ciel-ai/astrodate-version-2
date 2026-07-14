import { supabase } from './supabase';

/** Only `height` is read/written here -- Profile's Basic Info card is the
 *  only Phase-3 consumer. interest/looking_for/hobbies/partner_preference
 *  stay untouched (Looking For / Interests / Languages is a later section,
 *  not in scope for this pass). */
export async function getSection1Height(): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('section1_qns')
      .select('height')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data?.height ?? '' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function saveSection1Height(height: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { error } = await supabase
      .from('section1_qns')
      .upsert(
        { user_id: user.id, height, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
