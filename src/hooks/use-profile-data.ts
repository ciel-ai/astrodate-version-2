import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { MAX_PHOTOS, getUserPhotos, type UserPhoto } from '@/lib/user-photos';
import { EMPTY_PROMPT_SLOTS, PROMPT_SLOTS, getUserPrompts, type PromptSlots } from '@/lib/user-prompts';

export interface ProfileData {
  fullName: string;
  age: number | null;
  location: string | null;
  gender: string | null;
  genderDetail: string | null;
  /** Reads user_profiles.is_verified, added by
   *  20260713130000_add_profile_verification_field.sql. Cast through `any`
   *  below until `database.types.ts` is regenerated against that migration. */
  isVerified: boolean;

  bio: string;
  languages: string[];
  education: string;
  drinking: string;
  smoking: string;
  weed: string;
  religion: string;
  sexualOrientation: string;
  haveChildren: string;
  wantChildren: string;
  relationshipStyle: string;
  workout: string;
  diet: string;
  pets: string;
  travel: string;

  height: string;
  /** section1_qns.looking_for is a single TEXT column (single-select), not an
   *  array -- confirmed against onboarding-ques-02.tsx's write path. */
  lookingFor: string;
  hobbies: string[];

  westernSign: string | null;
  indianSign: string | null;
  nakshatraName: string | null;
  venusSign: string | null;
  marsSign: string | null;
  mercurySign: string | null;
  risingSign: string | null;
  dominantElement: string | null;

  photos: UserPhoto[];
  prompts: PromptSlots;
}

const EMPTY_PROFILE: ProfileData = {
  fullName: '',
  age: null,
  location: null,
  gender: null,
  genderDetail: null,
  isVerified: false,
  bio: '',
  languages: [],
  education: '',
  drinking: '',
  smoking: '',
  weed: '',
  religion: '',
  sexualOrientation: '',
  haveChildren: '',
  wantChildren: '',
  relationshipStyle: '',
  workout: '',
  diet: '',
  pets: '',
  travel: '',
  height: '',
  lookingFor: '',
  hobbies: [],
  westernSign: null,
  indianSign: null,
  nakshatraName: null,
  venusSign: null,
  marsSign: null,
  mercurySign: null,
  risingSign: null,
  dominantElement: null,
  photos: [],
  prompts: EMPTY_PROMPT_SLOTS,
};

/** Fields counted toward the completion meter, and why: name/location/astro/
 *  3-photo-minimum are all enforced during onboarding already (see
 *  getOnboardingResumeRoute in user-profile.ts), so every user already has
 *  them -- scoring them would just show 100% for everyone and mean nothing.
 *  Prompts are the one onboarding field NOT actually required to reach
 *  Discover (finish-ques.tsx saves fine with zero slots answered), and
 *  bio/education/drinking/smoking/a full 6-photo set have never had any
 *  write path before this Profile tab existed -- these 7 are the fields
 *  where completion is genuinely still open for most existing users. */
const COMPLETION_FIELD_COUNT = 7;

function calculateProfileCompletion(profile: ProfileData): number {
  let completed = 0;
  if (profile.bio.trim().length > 0) completed++;
  if (PROMPT_SLOTS.some((id) => profile.prompts[id].question)) completed++;
  if (profile.height) completed++;
  if (profile.education) completed++;
  if (profile.drinking) completed++;
  if (profile.smoking) completed++;
  if (profile.photos.length >= MAX_PHOTOS) completed++;
  return Math.round((completed / COMPLETION_FIELD_COUNT) * 100);
}

function calculateAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** Aggregates every read the Profile tab needs into one hook. Membership
 *  (plan/badge) is deliberately NOT fetched here -- it already lives in
 *  SubscriptionProvider (`useSubscriptionStatus()`), and duplicating that
 *  fetch would just risk the two going out of sync. */
export function useProfileData() {
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setProfile(EMPTY_PROFILE);
        return;
      }

      const [profileRes, astroRes, onboardingRes, section1Res, photosRes, promptsRes] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('astro_details').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('onboarding_responses').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('section1_qns').select('*').eq('user_id', user.id).maybeSingle(),
        getUserPhotos(),
        getUserPrompts(),
      ]);

      const profileRow = profileRes.data as (typeof profileRes.data & { is_verified?: boolean }) | null;
      const astro = astroRes.data;
      const onboarding = onboardingRes.data;
      const section1 = section1Res.data;

      setProfile({
        fullName: profileRow?.full_name ?? '',
        age: astro?.birth_date ? calculateAge(astro.birth_date) : null,
        location: profileRow?.location ?? null,
        gender: profileRow?.gender ?? null,
        genderDetail: profileRow?.gender_detail ?? null,
        isVerified: Boolean(profileRow?.is_verified),

        bio: onboarding?.about_me ?? '',
        languages: onboarding?.languages ?? [],
        education: onboarding?.education ?? '',
        drinking: onboarding?.drinking ?? '',
        smoking: onboarding?.smoking ?? '',
        weed: onboarding?.weed ?? '',
        religion: onboarding?.religion ?? '',
        sexualOrientation: profileRow?.sexual_orientation ?? '',
        haveChildren: onboarding?.have_children ?? '',
        wantChildren: onboarding?.want_children ?? '',
        relationshipStyle: onboarding?.relationship_style ?? '',
        workout: onboarding?.workout ?? '',
        diet: onboarding?.diet ?? '',
        pets: onboarding?.pets ?? '',
        travel: onboarding?.travel ?? '',

        height: section1?.height ?? '',
        lookingFor: section1?.looking_for ?? '',
        hobbies: section1?.hobbies ?? [],

        westernSign: astro?.western_sign ?? null,
        indianSign: astro?.indian_sign ?? null,
        nakshatraName: astro?.nakshatra_name ?? null,
        venusSign: astro?.venus_sign ?? null,
        marsSign: astro?.mars_sign ?? null,
        mercurySign: astro?.mercury_sign ?? null,
        risingSign: astro?.rising_sign ?? null,
        dominantElement: astro?.dominant_element ?? null,

        photos: photosRes.data ?? [],
        prompts: promptsRes.data ?? EMPTY_PROMPT_SLOTS,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll();
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  const completionPercent = useMemo(() => calculateProfileCompletion(profile), [profile]);

  return { profile, loading, refreshing, error, refresh, refetch: fetchAll, completionPercent };
}
