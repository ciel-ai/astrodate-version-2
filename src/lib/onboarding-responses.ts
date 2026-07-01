import { supabase } from '@/lib/supabase';

export type Section1Responses = {
  interest: string[];
  looking_for?: string;
  relationship_status?: string;
  hobbies: string[];
  height?: string;
  introvert_extrovert?: string;
  partner_preference: string[];
};

export async function saveSection1Responses(responses: Section1Responses): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No user found');

  const { error } = await supabase.from('section1_qns').upsert(
    {
      user_id: user.id,
      ...responses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}
