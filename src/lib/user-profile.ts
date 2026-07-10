import { supabase } from './supabase';

export interface UserProfile {
  phone_number?: string;
  full_name?: string;
  email?: string;
  gender?: string | null;
  gender_detail?: string | null;
  location?: string | null;
}

/**
 * Normalizes phone number to E.164 format (+919080923457).
 */
export const normalizePhoneToE164 = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  return '+' + cleaned;
};

/**
 * Inserts or updates the caller's public.user_profiles row. This is the only
 * table Discover/matching read profile data (full_name/gender/location) from
 * -- onboarding screens must funnel through here rather than writing directly,
 * since phone_number/full_name/email are all NOT NULL and existing-row
 * detection (insert vs update) has to happen consistently in one place.
 *
 * phone_number and email fall back to '' when not yet known (this app is
 * phone-first; email is only ever populated automatically from
 * auth.users.email for whichever users signed up via the email path).
 *
 * Only the fields actually passed in `profile` are written on an update --
 * e.g. address.tsx calling this with just `{location}` must not blank out
 * the full_name/gender the onboarding name+gender step already saved.
 * full_name is only required when there's no existing row yet to update.
 */
export const saveUserProfile = async (profile: UserProfile) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const userId = user.id;

    const hasPhoneInput = Boolean(profile.phone_number && profile.phone_number.trim().length > 0);
    const normalizedPhone = hasPhoneInput ? normalizePhoneToE164(profile.phone_number!) : '';

    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let result;

    if (existingProfile) {
      const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (profile.full_name !== undefined) updatePayload.full_name = profile.full_name;
      if (profile.email !== undefined) updatePayload.email = profile.email;
      if (profile.gender !== undefined) updatePayload.gender = profile.gender;
      if (profile.gender_detail !== undefined) updatePayload.gender_detail = profile.gender_detail;
      if (profile.location !== undefined) updatePayload.location = profile.location;
      if (hasPhoneInput) updatePayload.phone_number = normalizedPhone;

      result = await supabase
        .from('user_profiles')
        .update(updatePayload)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      if (!profile.full_name || !profile.full_name.trim()) {
        return { success: false, error: 'Missing required field: full_name' };
      }

      result = await supabase
        .from('user_profiles')
        .insert({
          user_id: userId,
          phone_number: normalizedPhone,
          full_name: profile.full_name,
          email: profile.email ?? '',
          gender: profile.gender ?? null,
          gender_detail: profile.gender_detail ?? null,
          location: profile.location ?? null,
        })
        .select()
        .single();
    }

    if (result.error) {
      return { success: false, error: result.error.message };
    }

    return { success: true, data: result.data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
};

/** Where a signed-in user should land after OTP verification, resuming the
 * onboarding wizard at the first step whose data isn't saved yet.
 *
 * None of the questionnaire screens (onboarding-ques-01..10) or
 * cosmic-identity.tsx pre-fill from previously saved answers -- each upsert
 * only writes its own columns. That means checking mere row-existence on
 * section1_qns/personality_qns/astro_details is NOT safe: a user who only
 * completed ques-01 of 7 already has a section1_qns row, and routing on row
 * existence would skip straight past ques-02..07, permanently leaving those
 * columns NULL (same failure mode for personality_qns and for astro_details'
 * computed sign fields, which are actually written by cosmic-identity.tsx,
 * not birth-details.tsx -- see its recompute-and-cache path around line 793
 * of cosmic-identity.tsx). So each block is gated on a sentinel column that
 * only the LAST screen in that block writes, and an incomplete block always
 * resumes at its first screen -- safe because upserts overwrite, not append,
 * so re-answering already-saved pages loses nothing.
 */
export type OnboardingResumeRoute =
  | '/onboarding'
  | '/address'
  | '/birth-details'
  | '/cosmic-identity'
  | '/onboarding-ques-01'
  | '/onboarding-ques-08'
  | '/upload-photos'
  | '/(tabs)/discover';

export const getOnboardingResumeRoute = async (): Promise<OnboardingResumeRoute> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '/onboarding';

  const userId = user.id;

  const [profileRes, astroRes, section1Res, personalityRes, photosRes] = await Promise.all([
    supabase.from('user_profiles').select('full_name, location').eq('user_id', userId).maybeSingle(),
    supabase.from('astro_details').select('western_sign, indian_sign, nakshatra_name').eq('user_id', userId).maybeSingle(),
    // partner_preference is only written by onboarding-ques-07.tsx, the last screen of that block.
    supabase.from('section1_qns').select('partner_preference').eq('user_id', userId).maybeSingle(),
    // how_often_do_you_overthink_relationships is only written by onboarding-ques-10.tsx, the last screen of that block.
    supabase.from('personality_qns').select('how_often_do_you_overthink_relationships').eq('user_id', userId).maybeSingle(),
    supabase.from('user_photos').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  if (!profileRes.data?.full_name) return '/onboarding';
  if (!profileRes.data?.location) return '/address';
  if (!astroRes.data) return '/birth-details';
  if (!astroRes.data.western_sign || !astroRes.data.indian_sign || !astroRes.data.nakshatra_name) return '/cosmic-identity';
  if (!section1Res.data?.partner_preference) return '/onboarding-ques-01';
  if (!personalityRes.data?.how_often_do_you_overthink_relationships) return '/onboarding-ques-08';
  if ((photosRes.count ?? 0) < 3) return '/upload-photos';
  return '/(tabs)/discover';
};

/** Fetches the caller's own user_profiles row, or null if it doesn't exist yet. */
export const getUserProfile = async () => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, error: 'User not authenticated' };
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
};
