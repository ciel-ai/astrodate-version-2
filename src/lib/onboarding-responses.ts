import { supabase } from './supabase';

export interface OnboardingResponses {
  about_me: string;
  languages: string[];
  education: string;
  drinking: string;
  smoking: string;
}

const EMPTY: OnboardingResponses = {
  about_me: '',
  languages: [],
  education: '',
  drinking: '',
  smoking: '',
};

export async function getOnboardingResponses(): Promise<{ success: boolean; data?: OnboardingResponses; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { data, error } = await supabase
      .from('onboarding_responses')
      .select('about_me, languages, education, drinking, smoking')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: { ...EMPTY } };

    return {
      success: true,
      data: {
        about_me: data.about_me ?? '',
        languages: data.languages ?? [],
        education: data.education ?? '',
        drinking: data.drinking ?? '',
        smoking: data.smoking ?? '',
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Upserts only the fields passed -- e.g. saving just `education` must not
 *  blank out a bio that was set separately (same pattern as saveUserProfile
 *  in user-profile.ts). */
export async function saveOnboardingResponses(
  fields: Partial<OnboardingResponses>
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'User not authenticated' };

    const { error } = await supabase
      .from('onboarding_responses')
      .upsert(
        { user_id: user.id, ...fields, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
