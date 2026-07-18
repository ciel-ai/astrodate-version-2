export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_usage_tracking: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          request_count: number
          updated_at: string | null
          usage_date: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          request_count?: number
          updated_at?: string | null
          usage_date?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          request_count?: number
          updated_at?: string | null
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      astro_details: {
        Row: {
          birth_date: string
          birth_latitude: number | null
          birth_location: string
          birth_longitude: number | null
          birth_time: string
          birth_timezone: string | null
          chart_json: Json | null
          created_at: string | null
          dominant_element: string | null
          id: string
          indian_sign: string | null
          mars_sign: string | null
          mercury_sign: string | null
          nakshatra_name: string | null
          rising_sign: string | null
          updated_at: string | null
          user_id: string
          venus_sign: string | null
          western_sign: string | null
        }
        Insert: {
          birth_date: string
          birth_latitude?: number | null
          birth_location: string
          birth_longitude?: number | null
          birth_time: string
          birth_timezone?: string | null
          chart_json?: Json | null
          created_at?: string | null
          dominant_element?: string | null
          id?: string
          indian_sign?: string | null
          mars_sign?: string | null
          mercury_sign?: string | null
          nakshatra_name?: string | null
          rising_sign?: string | null
          updated_at?: string | null
          user_id: string
          venus_sign?: string | null
          western_sign?: string | null
        }
        Update: {
          birth_date?: string
          birth_latitude?: number | null
          birth_location?: string
          birth_longitude?: number | null
          birth_time?: string
          birth_timezone?: string | null
          chart_json?: Json | null
          created_at?: string | null
          dominant_element?: string | null
          id?: string
          indian_sign?: string | null
          mars_sign?: string | null
          mercury_sign?: string | null
          nakshatra_name?: string | null
          rising_sign?: string | null
          updated_at?: string | null
          user_id?: string
          venus_sign?: string | null
          western_sign?: string | null
        }
        Relationships: []
      }
      astro_events: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string
          event_name: string
          event_type: string
          id: number
          start_date: string
          ui_config: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date: string
          event_name: string
          event_type: string
          id?: number
          start_date: string
          ui_config?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string
          event_name?: string
          event_type?: string
          id?: number
          start_date?: string
          ui_config?: Json | null
        }
        Relationships: []
      }
      block_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      daily_insights_cache: {
        Row: {
          created_at: string
          id: string
          moon_nakshatra: string | null
          moon_sign: string | null
          nakshatra: string
          prediction: Json
          prediction_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          moon_nakshatra?: string | null
          moon_sign?: string | null
          nakshatra: string
          prediction: Json
          prediction_date: string
        }
        Update: {
          created_at?: string
          id?: string
          moon_nakshatra?: string | null
          moon_sign?: string | null
          nakshatra?: string
          prediction?: Json
          prediction_date?: string
        }
        Relationships: []
      }
      daily_like_quota: {
        Row: {
          quota_date: string
          updated_at: string | null
          used_count: number
          user_id: string
        }
        Insert: {
          quota_date?: string
          updated_at?: string | null
          used_count?: number
          user_id: string
        }
        Update: {
          quota_date?: string
          updated_at?: string | null
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_picks: {
        Row: {
          astro_score: number | null
          id: string
          pick_date: string
          picked_user_id: string
          user_id: string
        }
        Insert: {
          astro_score?: number | null
          id?: string
          pick_date?: string
          picked_user_id: string
          user_id: string
        }
        Update: {
          astro_score?: number | null
          id?: string
          pick_date?: string
          picked_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_rewind_quota: {
        Row: {
          quota_date: string
          updated_at: string | null
          used_count: number
          user_id: string
        }
        Insert: {
          quota_date?: string
          updated_at?: string | null
          used_count?: number
          user_id: string
        }
        Update: {
          quota_date?: string
          updated_at?: string | null
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }
      discover_deck_daily_state: {
        Row: {
          created_at: string
          deck_date: string
          high_shown_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_date?: string
          high_shown_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_date?: string
          high_shown_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message_text: string | null
          moderation_status: string
          receiver_id: string | null
          sender_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string | null
          moderation_status?: string
          receiver_id?: string | null
          sender_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string | null
          moderation_status?: string
          receiver_id?: string | null
          sender_id?: string | null
        }
        Relationships: []
      }
      moderation_blocklist_terms: {
        Row: {
          active: boolean | null
          created_at: string | null
          severity: string
          term: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          severity: string
          term: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          severity?: string
          term?: string
        }
        Relationships: []
      }
      notification_delivery_logs: {
        Row: {
          attempt_count: number
          body: string
          created_at: string
          created_date_utc: string
          dedupe_key: string
          error_message: string | null
          expo_receipt_ids: string[] | null
          expo_ticket_ids: string[] | null
          id: string
          next_attempt_at: string
          notification_type: string
          payload: Json
          reference_id: string
          sent_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          body: string
          created_at?: string
          created_date_utc?: string
          dedupe_key: string
          error_message?: string | null
          expo_receipt_ids?: string[] | null
          expo_ticket_ids?: string[] | null
          id?: string
          next_attempt_at?: string
          notification_type: string
          payload?: Json
          reference_id: string
          sent_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          body?: string
          created_at?: string
          created_date_utc?: string
          dedupe_key?: string
          error_message?: string | null
          expo_receipt_ids?: string[] | null
          expo_ticket_ids?: string[] | null
          id?: string
          next_attempt_at?: string
          notification_type?: string
          payload?: Json
          reference_id?: string
          sent_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_responses: {
        Row: {
          about_me: string | null
          created_at: string | null
          diet: string | null
          drinking: string | null
          education: string | null
          have_children: string | null
          id: string
          languages: string[] | null
          pets: string | null
          relationship_style: string | null
          religion: string | null
          smoking: string | null
          travel: string | null
          updated_at: string | null
          user_id: string
          want_children: string | null
          weed: string | null
          workout: string | null
        }
        Insert: {
          about_me?: string | null
          created_at?: string | null
          diet?: string | null
          drinking?: string | null
          education?: string | null
          have_children?: string | null
          id?: string
          languages?: string[] | null
          pets?: string | null
          relationship_style?: string | null
          religion?: string | null
          smoking?: string | null
          travel?: string | null
          updated_at?: string | null
          user_id: string
          want_children?: string | null
          weed?: string | null
          workout?: string | null
        }
        Update: {
          about_me?: string | null
          created_at?: string | null
          diet?: string | null
          drinking?: string | null
          education?: string | null
          have_children?: string | null
          id?: string
          languages?: string[] | null
          pets?: string | null
          relationship_style?: string | null
          religion?: string | null
          smoking?: string | null
          travel?: string | null
          updated_at?: string | null
          user_id?: string
          want_children?: string | null
          weed?: string | null
          workout?: string | null
        }
        Relationships: []
      }
      personality_qns: {
        Row: {
          created_at: string | null
          during_arguments_you_usually: string | null
          how_do_you_feel_about_trying_unusual_foods_or_activities:
            | string
            | null
          how_do_you_handle_commitments_in_a_relationship: string | null
          how_do_you_handle_emotional_ups_and_downs: string | null
          how_do_you_show_care_in_a_relationship: string | null
          how_often_do_you_overthink_relationships: string | null
          id: string
          updated_at: string | null
          user_id: string
          what_best_describes_your_planning_style: string | null
          what_kind_of_conversations_do_you_enjoy_with_a_partner: string | null
          what_kind_of_partner_are_you: string | null
          what_type_of_date_excites_you_the_most: string[] | null
          when_your_partner_replies_late_you_feel: string | null
          you_prefer_a_partner_who_is: string | null
          your_energy_level_on_dates_is_usually: string | null
          your_ideal_way_to_spend_time_with_a_partner: string | null
          your_room_or_workspace_usually_looks_like: string | null
        }
        Insert: {
          created_at?: string | null
          during_arguments_you_usually?: string | null
          how_do_you_feel_about_trying_unusual_foods_or_activities?:
            | string
            | null
          how_do_you_handle_commitments_in_a_relationship?: string | null
          how_do_you_handle_emotional_ups_and_downs?: string | null
          how_do_you_show_care_in_a_relationship?: string | null
          how_often_do_you_overthink_relationships?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          what_best_describes_your_planning_style?: string | null
          what_kind_of_conversations_do_you_enjoy_with_a_partner?: string | null
          what_kind_of_partner_are_you?: string | null
          what_type_of_date_excites_you_the_most?: string[] | null
          when_your_partner_replies_late_you_feel?: string | null
          you_prefer_a_partner_who_is?: string | null
          your_energy_level_on_dates_is_usually?: string | null
          your_ideal_way_to_spend_time_with_a_partner?: string | null
          your_room_or_workspace_usually_looks_like?: string | null
        }
        Update: {
          created_at?: string | null
          during_arguments_you_usually?: string | null
          how_do_you_feel_about_trying_unusual_foods_or_activities?:
            | string
            | null
          how_do_you_handle_commitments_in_a_relationship?: string | null
          how_do_you_handle_emotional_ups_and_downs?: string | null
          how_do_you_show_care_in_a_relationship?: string | null
          how_often_do_you_overthink_relationships?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          what_best_describes_your_planning_style?: string | null
          what_kind_of_conversations_do_you_enjoy_with_a_partner?: string | null
          what_kind_of_partner_are_you?: string | null
          what_type_of_date_excites_you_the_most?: string[] | null
          when_your_partner_replies_late_you_feel?: string | null
          you_prefer_a_partner_who_is?: string | null
          your_energy_level_on_dates_is_usually?: string | null
          your_ideal_way_to_spend_time_with_a_partner?: string | null
          your_room_or_workspace_usually_looks_like?: string | null
        }
        Relationships: []
      }
      plan_catalog: {
        Row: {
          amount_paise: number
          created_at: string | null
          features: Json
          id: string
          interval: string | null
          is_active: boolean
          plan_badge: string
          plan_name: string
          plan_slug: string
        }
        Insert: {
          amount_paise?: number
          created_at?: string | null
          features?: Json
          id?: string
          interval?: string | null
          is_active?: boolean
          plan_badge: string
          plan_name: string
          plan_slug: string
        }
        Update: {
          amount_paise?: number
          created_at?: string | null
          features?: Json
          id?: string
          interval?: string | null
          is_active?: boolean
          plan_badge?: string
          plan_name?: string
          plan_slug?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          category: string | null
          channel_id: string | null
          created_at: string | null
          id: string
          reported_user_id: string | null
          reporter_id: string | null
          status: string
          subcategory: string | null
        }
        Insert: {
          category?: string | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string
          subcategory?: string | null
        }
        Update: {
          category?: string | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: string
          subcategory?: string | null
        }
        Relationships: []
      }
      saved_insights: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          prediction_date: string
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          prediction_date: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          prediction_date?: string
          user_id?: string
        }
        Relationships: []
      }
      section1_qns: {
        Row: {
          created_at: string | null
          height: string | null
          hobbies: string[] | null
          id: string
          interest: string[] | null
          introvert_extrovert: string | null
          looking_for: string | null
          partner_preference: string[] | null
          relationship_status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          height?: string | null
          hobbies?: string[] | null
          id?: string
          interest?: string[] | null
          introvert_extrovert?: string | null
          looking_for?: string | null
          partner_preference?: string[] | null
          relationship_status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          height?: string | null
          hobbies?: string[] | null
          id?: string
          interest?: string[] | null
          introvert_extrovert?: string | null
          looking_for?: string | null
          partner_preference?: string[] | null
          relationship_status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shooting_star_log: {
        Row: {
          id: string
          sent_at: string | null
          target_id: string
          user_id: string
        }
        Insert: {
          id?: string
          sent_at?: string | null
          target_id: string
          user_id: string
        }
        Update: {
          id?: string
          sent_at?: string | null
          target_id?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_weight_config: {
        Row: {
          base_weight: number
          description: string | null
          signal_type: string
        }
        Insert: {
          base_weight: number
          description?: string | null
          signal_type: string
        }
        Update: {
          base_weight?: number
          description?: string | null
          signal_type?: string
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      super_like_quota: {
        Row: {
          quota_date: string
          updated_at: string | null
          used_count: number
          user_id: string
        }
        Insert: {
          quota_date?: string
          updated_at?: string | null
          used_count?: number
          user_id: string
        }
        Update: {
          quota_date?: string
          updated_at?: string | null
          used_count?: number
          user_id?: string
        }
        Relationships: []
      }

      synastry_cache: {
        Row: {
          astro_score: number
          computed_at: string | null
          id: string
          indian_score: number | null
          is_stale: boolean
          personality_score: number | null
          signal_score: number | null
          user_a_id: string
          user_b_id: string
          western_score: number | null
        }
        Insert: {
          astro_score: number
          computed_at?: string | null
          id?: string
          indian_score?: number | null
          is_stale?: boolean
          personality_score?: number | null
          signal_score?: number | null
          user_a_id: string
          user_b_id: string
          western_score?: number | null
        }
        Update: {
          astro_score?: number
          computed_at?: string | null
          id?: string
          indian_score?: number | null
          is_stale?: boolean
          personality_score?: number | null
          signal_score?: number | null
          user_a_id?: string
          user_b_id?: string
          western_score?: number | null
        }
        Relationships: []
      }
      synastry_cache_details: {
        Row: {
          ashtakoota_detail: Json | null
          ashtakoota_score: number | null
          badges: Json | null
          compatibility_summary: string | null
          computed_at: string | null
          dominant_element_match: boolean | null
          is_stale: boolean
          manglik_female_percentage: number | null
          manglik_male_percentage: number | null
          manglik_status: boolean | null
          mars_score: number | null
          mercury_score: number | null
          moon_score: number | null
          sun_score: number | null
          user_a_id: string
          user_b_id: string
          venus_score: number | null
        }
        Insert: {
          ashtakoota_detail?: Json | null
          ashtakoota_score?: number | null
          badges?: Json | null
          compatibility_summary?: string | null
          computed_at?: string | null
          dominant_element_match?: boolean | null
          is_stale?: boolean
          manglik_female_percentage?: number | null
          manglik_male_percentage?: number | null
          manglik_status?: boolean | null
          mars_score?: number | null
          mercury_score?: number | null
          moon_score?: number | null
          sun_score?: number | null
          user_a_id: string
          user_b_id: string
          venus_score?: number | null
        }
        Update: {
          ashtakoota_detail?: Json | null
          ashtakoota_score?: number | null
          badges?: Json | null
          compatibility_summary?: string | null
          computed_at?: string | null
          dominant_element_match?: boolean | null
          is_stale?: boolean
          manglik_female_percentage?: number | null
          manglik_male_percentage?: number | null
          manglik_status?: boolean | null
          mars_score?: number | null
          mercury_score?: number | null
          moon_score?: number | null
          sun_score?: number | null
          user_a_id?: string
          user_b_id?: string
          venus_score?: number | null
        }
        Relationships: []
      }
      synastry_prewarm_jobs: {
        Row: {
          candidate_user_id: string
          created_at: string
          id: string
          last_error: string | null
          pair_a_id: string | null
          pair_b_id: string | null
          processed_at: string | null
          retry_count: number
          status: string
          user_id: string
        }
        Insert: {
          candidate_user_id: string
          created_at?: string
          id?: string
          last_error?: string | null
          pair_a_id?: string | null
          pair_b_id?: string | null
          processed_at?: string | null
          retry_count?: number
          status?: string
          user_id: string
        }
        Update: {
          candidate_user_id?: string
          created_at?: string
          id?: string
          last_error?: string | null
          pair_a_id?: string | null
          pair_b_id?: string | null
          processed_at?: string | null
          retry_count?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_likes: {
        Row: {
          action_type: string
          comment: string | null
          created_at: string | null
          id: string
          liked_user_id: string
          note: string | null
          photo_index: number | null
          prompt_id: string | null
          reveal_source: string | null
          reveal_state: string
          seen: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          comment?: string | null
          created_at?: string | null
          id?: string
          liked_user_id: string
          note?: string | null
          photo_index?: number | null
          prompt_id?: string | null
          reveal_source?: string | null
          reveal_state?: string
          seen?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          comment?: string | null
          created_at?: string | null
          id?: string
          liked_user_id?: string
          note?: string | null
          photo_index?: number | null
          prompt_id?: string | null
          reveal_source?: string | null
          reveal_state?: string
          seen?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          consent: boolean
          geog: unknown
          updated_at: string
          user_id: string
        }
        Insert: {
          consent?: boolean
          geog: unknown
          updated_at?: string
          user_id: string
        }
        Update: {
          consent?: boolean
          geog?: unknown
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_matches: {
        Row: {
          channel_id: string
          created_at: string | null
          icebreaker_generated_at: string | null
          icebreaker_text: string | null
          id: string
          matched_at: string | null
          updated_at: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          icebreaker_generated_at?: string | null
          icebreaker_text?: string | null
          id?: string
          matched_at?: string | null
          updated_at?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          icebreaker_generated_at?: string | null
          icebreaker_text?: string | null
          id?: string
          matched_at?: string | null
          updated_at?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      user_notification_preferences: {
        Row: {
          created_at: string
          engagement_enabled: boolean
          marketing_enabled: boolean
          new_matches_enabled: boolean
          new_messages_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          engagement_enabled?: boolean
          marketing_enabled?: boolean
          new_matches_enabled?: boolean
          new_messages_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          engagement_enabled?: boolean
          marketing_enabled?: boolean
          new_matches_enabled?: boolean
          new_messages_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_online_status: {
        Row: {
          is_online: boolean
          last_seen: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen?: string
          user_id?: string
        }
        Relationships: []
      }
      user_oracle_draws: {
        Row: {
          last_drawn_at: string | null
          user_id: string
        }
        Insert: {
          last_drawn_at?: string | null
          user_id: string
        }
        Update: {
          last_drawn_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_photos: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          photo_url: string
          storage_path: string | null
          thumbnail_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_url: string
          storage_path?: string | null
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_url?: string
          storage_path?: string | null
          thumbnail_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          blocked_signs: string[]
          created_at: string
          gender_preference: string | null
          location: string | null
          max_age: number
          max_distance: number
          min_age: number
          new_match_notifications: boolean
          preferred_elements: string[]
          sexual_orientation: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          blocked_signs?: string[]
          created_at?: string
          gender_preference?: string | null
          location?: string | null
          max_age?: number
          max_distance?: number
          min_age?: number
          new_match_notifications?: boolean
          preferred_elements?: string[]
          sexual_orientation?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          blocked_signs?: string[]
          created_at?: string
          gender_preference?: string | null
          location?: string | null
          max_age?: number
          max_distance?: number
          min_age?: number
          new_match_notifications?: boolean
          preferred_elements?: string[]
          sexual_orientation?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          email: string
          free_reveal_used: boolean
          full_name: string
          gender: string | null
          gender_detail: string | null
          id: string
          is_verified: boolean
          location: string | null
          personality_vector: string | null
          phone_number: string
          plan_type: string | null
          sexual_orientation: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          email: string
          free_reveal_used?: boolean
          full_name: string
          gender?: string | null
          gender_detail?: string | null
          id?: string
          is_verified?: boolean
          location?: string | null
          personality_vector?: string | null
          phone_number: string
          plan_type?: string | null
          sexual_orientation?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          free_reveal_used?: boolean
          full_name?: string
          gender?: string | null
          gender_detail?: string | null
          id?: string
          is_verified?: boolean
          location?: string | null
          personality_vector?: string | null
          phone_number?: string
          plan_type?: string | null
          sexual_orientation?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_prompts: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          is_custom: boolean
          prompt_id: string
          question: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          is_custom?: boolean
          prompt_id: string
          question: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          is_custom?: boolean
          prompt_id?: string
          question?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_push_tokens: {
        Row: {
          created_at: string
          device_id: string | null
          expo_push_token: string
          id: string
          is_active: boolean
          last_seen_at: string
          platform: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          expo_push_token: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string | null
          expo_push_token?: string
          id?: string
          is_active?: boolean
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_signals: {
        Row: {
          created_at: string | null
          id: string
          signal_type: string
          signal_weight: number
          target_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          signal_type: string
          signal_weight?: number
          target_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          signal_type?: string
          signal_weight?: number
          target_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plan_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      western_compatibility_cache: {
        Row: {
          compatibility_percentage: number
          compatibility_report: string | null
          compatibility_score_45: number
          created_at: string
          sign_a: string
          sign_b: string
        }
        Insert: {
          compatibility_percentage: number
          compatibility_report?: string | null
          compatibility_score_45: number
          created_at?: string
          sign_a: string
          sign_b: string
        }
        Update: {
          compatibility_percentage?: number
          compatibility_report?: string | null
          compatibility_score_45?: number
          created_at?: string
          sign_a?: string
          sign_b?: string
        }
        Relationships: []
      }
    }
    Views: {
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      block_user: { Args: { p_blocked_id: string }; Returns: undefined }
      cancel_my_subscription: { Args: never; Returns: undefined }
      check_auth_user_exists: {
        Args: { input_phone: string }
        Returns: boolean
      }
      check_phone_exists: {
        Args: { p_phone: string }
        Returns: boolean
      }
      claim_notification_delivery_logs: {
        Args: { p_limit?: number }
        Returns: {
          attempt_count: number
          body: string
          id: string
          notification_type: string
          payload: Json
          reference_id: string
          title: string
          user_id: string
        }[]
      }
      claim_synastry_prewarm_jobs: {
        Args: { p_limit?: number }
        Returns: {
          candidate_user_id: string
          id: string
          retry_count: number
          user_id: string
        }[]
      }
      consume_like: { Args: { p_user_id: string }; Returns: boolean }
      consume_super_like: { Args: { p_user_id: string }; Returns: boolean }
      delete_old_messages: {
        Args: never
        Returns: {
          conversations_processed: number
          deleted_count: number
        }[]
      }
      derive_dominant_element: {
        Args: {
          mars: string
          mercury: string
          moon: string
          rising: string
          sun: string
          venus: string
        }
        Returns: string
      }
      disable_my_location: { Args: never; Returns: undefined }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      enablelongtransactions: { Args: never; Returns: string }
      enqueue_synastry_prewarm: {
        Args: { p_user_id: string }
        Returns: {
          enqueued_count: number
        }[]
      }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      gender_matches_interest: {
        Args: { p_interest: string[]; p_person_gender: string }
        Returns: boolean
      }
      generate_daily_picks_now: { Args: never; Returns: number }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_astro_for_ranking: {
        Args: { p_user_id: string }
        Returns: {
          dominant_element: string
          indian_sign: string
          mars_sign: string
          mercury_sign: string
          nakshatra_name: string
          rising_sign: string
          venus_sign: string
          western_sign: string
        }[]
      }
      get_blocked_user_ids: { Args: never; Returns: string[] }
      get_current_point_for_user: {
        Args: { p_user_id: string }
        Returns: {
          lat: number
          lon: number
        }[]
      }
      get_discover_deck: { Args: never; Returns: Json }
      get_fallback_feed: {
        Args: {
          input_user_id: string
          p_age_expand?: number
          p_distance_multiplier?: number
        }
        Returns: {
          age: number
          bhakoot_dosha: boolean
          distance_km: number
          distance_label: string
          final_match_score: number
          full_name: string
          fully_computed: boolean
          gender: string
          indian_recommendation: string
          indian_score: number
          location: string
          manglik_status: boolean
          match_user_id: string
          nadi_dosha: boolean
          personality_score: number
          western_report: string
          western_score: number
          western_sign: string
          why_you_match: string
        }[]
      }
      get_indian_compatibility: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: {
          bhakoot_dosha: boolean
          computed: boolean
          guna_score: number
          indian_percent: number
          indian_points: number
          manglik_status: boolean
          nadi_dosha: boolean
        }[]
      }
      get_likes_remaining: { Args: { p_user_id: string }; Returns: number }
      get_match_score: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: {
          breakdown: Json
          fully_computed: boolean
          indian_points: number
          personality_points: number
          total_score: number
          western_points: number
        }[]
      }
      get_matched_user_presence: {
        Args: { p_target_user_ids: string[] }
        Returns: {
          is_online: boolean
          last_seen: string
          user_id: string
        }[]
      }
      get_my_conversations: {
        Args: never
        Returns: {
          channel_id: string
          last_message_at: string
          last_message_sender_id: string
          last_message_text: string
          matched_at: string
          other_user_id: string
          other_user_name: string
          other_user_photo: string
          unread_count: number
        }[]
      }
      get_my_blocked_users: {
        Args: never
        Returns: {
          blocked_at: string
          full_name: string
          photo_url: string
          user_id: string
        }[]
      }
      get_my_daily_pick: { Args: never; Returns: Json }
      get_my_membership: { Args: never; Returns: Json }
      get_my_sent_likes: { Args: never; Returns: Json }
      get_personality_compatibility: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: {
          compatibility_percent: number
          factor_breakdown: Json
          personality_points: number
        }[]
      }
      get_rewinds_remaining: { Args: { p_user_id: string }; Returns: number }
      get_sign_compatibility: {
        Args: { sign_a: string; sign_b: string }
        Returns: number
      }
      get_signal_score: {
        Args: { p_target_id: string; p_viewer_id: string }
        Returns: number
      }
      get_super_likes_remaining: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_synastry_detail: {
        Args: { user_x: string; user_y: string }
        Returns: {
          ashtakoota_detail: Json
          ashtakoota_score: number
          badges: Json
          compatibility_summary: string
          computed_at: string
          dominant_element_match: boolean
          mars_score: number
          mercury_score: number
          moon_score: number
          sun_score: number
          venus_score: number
        }[]
      }
      get_todays_match_nudge: {
        Args: { input_user_id: string; p_sample_size?: number }
        Returns: {
          day_ruler_sign: string
          favored_sign: string
          match_count: number
          sample_names: string[]
          sample_user_ids: string[]
        }[]
      }
      get_user_display_name: {
        Args: { p_target_user_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_user_photos_batch: {
        Args: { p_user_ids: string[] }
        Returns: {
          display_order: number
          is_primary: boolean
          photo_url: string
          storage_path: string
          thumbnail_url: string
          user_id: string
        }[]
      }
      get_user_presence: {
        Args: { p_target_user_id: string }
        Returns: {
          is_online: boolean
          last_seen: string
          user_id: string
        }[]
      }
      get_users_display_info: {
        Args: { p_target_user_ids: string[] }
        Returns: {
          full_name: string
          location: string
          user_id: string
        }[]
      }
      get_western_compatibility: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: {
          computed: boolean
          western_percent: number
          western_points: number
        }[]
      }
      get_who_liked_me: { Args: never; Returns: Json }
      gettransactionid: { Args: never; Returns: unknown }
      increment_ai_usage: {
        Args: { p_endpoint: string; p_limit: number; p_user: string }
        Returns: boolean
      }
      is_deck_eligible: {
        Args: { p_candidate_id: string; p_viewer_id: string }
        Returns: boolean
      }
      like_back: { Args: { p_liker_id: string }; Returns: Json }
      link_apple_identity_to_user: {
        Args: { p_apple_email?: string; p_apple_sub: string; p_user_id: string }
        Returns: Json
      }
      link_google_identity_to_user: {
        Args: {
          p_google_email?: string
          p_google_sub: string
          p_user_id: string
        }
        Returns: Json
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      mark_likes_seen: { Args: never; Returns: undefined }
      personality_categorical_match: {
        Args: { a: string; b: string }
        Returns: number
      }
      personality_goal_match: {
        Args: { a: string; b: string }
        Returns: number
      }
      personality_jaccard_match: {
        Args: { a: string[]; b: string[] }
        Returns: number
      }
      personality_ordinal_match: {
        Args: { a: string; b: string; spectrum: string[] }
        Returns: number
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      process_synastry_prewarm_job: {
        Args: { p_job_id: string }
        Returns: Json
      }
      record_signal: {
        Args: { p_signal_type: string; p_target_id: string; p_user_id: string }
        Returns: undefined
      }
      record_swipe: {
        Args: { p_action: string; p_target_user_id: string }
        Returns: Json
      }
      refresh_synastry_prewarm_queue: { Args: never; Returns: number }
      register_push_token: {
        Args: {
          p_device_id?: string
          p_expo_push_token: string
          p_platform?: string
        }
        Returns: string
      }
      revoke_push_token: {
        Args: { p_device_id?: string; p_expo_push_token?: string }
        Returns: number
      }
      rewind_last_swipe: { Args: never; Returns: Json }
      spend_free_reveal: { Args: { p_liker_id: string }; Returns: Json }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      synastry_location_priority: {
        Args: { candidate_location: string; viewer_location: string }
        Returns: number
      }
      sync_ios_subscription: {
        Args: { entitlement_id: string }
        Returns: boolean
      }
      unblock_user: { Args: { p_blocked_id: string }; Returns: undefined }
      unlockrows: { Args: { "": string }; Returns: number }
      update_notification_preferences: {
        Args: {
          p_engagement_enabled?: boolean
          p_marketing_enabled?: boolean
          p_new_matches_enabled?: boolean
          p_new_messages_enabled?: boolean
          p_quiet_hours_end?: string
          p_quiet_hours_start?: string
          p_timezone?: string
        }
        Returns: {
          created_at: string
          engagement_enabled: boolean
          marketing_enabled: boolean
          new_matches_enabled: boolean
          new_messages_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "user_notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      upsert_my_location: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
