import { supabase } from '@/lib/supabase';

export type PersonalityQnsResponses = {
  what_type_of_date_excites_you_the_most: string[];
  how_do_you_feel_about_trying_unusual_foods_or_activities?: string;
  what_kind_of_conversations_do_you_enjoy_with_a_partner?: string;
  what_best_describes_your_planning_style?: string;
  how_do_you_handle_commitments_in_a_relationship?: string;
  your_room_or_workspace_usually_looks_like?: string;
  your_ideal_way_to_spend_time_with_a_partner?: string;
  your_energy_level_on_dates_is_usually?: string;
  you_prefer_a_partner_who_is?: string;
  during_arguments_you_usually?: string;
  how_do_you_show_care_in_a_relationship?: string;
  what_kind_of_partner_are_you?: string;
  when_your_partner_replies_late_you_feel?: string;
  how_do_you_handle_emotional_ups_and_downs?: string;
  how_often_do_you_overthink_relationships?: string;
};

export async function savePersonalityQnsResponses(responses: PersonalityQnsResponses): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No user found');

  const { error } = await supabase.from('personality_qns').upsert(
    {
      user_id: user.id,
      ...responses,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (error) throw error;
}
