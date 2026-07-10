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
