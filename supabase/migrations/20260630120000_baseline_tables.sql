-- ============================================================================
-- AstroDate — Baseline Tables (squashed from legacy migrations 001-103)
-- ============================================================================
-- This file contains the FINAL-STATE table definitions, indexes, and storage
-- bucket setup, derived by reading all 102 legacy migrations in numeric order
-- and resolving every ALTER/fix to its last applied state.
--
-- EXCLUDED (per migration plan, written up in migration-squash-report.md):
--   - Razorpay columns/tables (user_subscriptions.razorpay_*, processed_razorpay_webhooks)
--   - aadhar_verification table (created in 005, dropped in 017 — confirmed gone)
--   - Gemini chatbot tables (none found — only icebreaker text columns, which ARE included)
--
-- Function BODIES for compute_astro_score, personality_score (compute_personality_score),
-- and get_final_matches are NOT included anywhere in these 4 files — see the report for
-- their signatures and dependency analysis. Their PRIVATE helper functions
-- (get_western_sign_score, get_nakshatra_score) are used ONLY by those three excluded
-- functions and are therefore also NOT included — they must be recreated alongside the
-- new scoring formulas. get_sign_compatibility and get_signal_score are DIFFERENT,
-- general-purpose helpers used by in-scope features (synastry detail, signal
-- aggregation) and ARE included, in the realtime_cron migration file.
-- ============================================================================


-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS vector;


-- ============================================================================
-- TABLE: user_profiles
-- (001 create, 015 +sexual_orientation, 018 +plan_type/+personality_vector/+sexual_orientation)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  gender TEXT,
  gender_detail TEXT,
  location TEXT,
  sexual_orientation TEXT,
  plan_type TEXT DEFAULT 'Free',
  personality_vector public.vector,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles(phone_number);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON public.user_profiles(updated_at DESC);

COMMENT ON TABLE public.user_profiles IS 'Stores user profile information from onboarding flow';

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: astro_details
-- (003 create, 026 +venus/mars/mercury/rising/dominant_element/chart_json,
--  073 +birth_timezone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.astro_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Birth Details
  birth_date DATE NOT NULL,
  birth_time TIME NOT NULL,
  birth_location TEXT NOT NULL,
  birth_latitude DECIMAL(10, 8),
  birth_longitude DECIMAL(11, 8),
  birth_timezone TEXT,

  -- Western Astrology
  western_sign TEXT,
  venus_sign TEXT,
  mars_sign TEXT,
  mercury_sign TEXT,
  rising_sign TEXT,
  dominant_element TEXT,
  chart_json JSONB,

  -- Indian/Vedic Astrology
  indian_sign TEXT,

  -- Nakshatra Details
  nakshatra_name TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_astro_details_user_id ON public.astro_details(user_id);
CREATE INDEX IF NOT EXISTS idx_astro_details_western_sign ON public.astro_details(western_sign);

COMMENT ON TABLE public.astro_details IS 'Stores birth details and astrological signs (Western, Indian, and Nakshatra)';

ALTER TABLE public.astro_details ENABLE ROW LEVEL SECURITY;

-- RPC: get_astro_for_ranking  (026 create — unchanged thereafter)
-- NOTE: this is a private helper originally used only by compute_astro_score
-- (excluded — see report). Included here since it is a simple, general-purpose
-- read of astro_details and may be reused by the new scoring implementation.
CREATE OR REPLACE FUNCTION public.get_astro_for_ranking(p_user_id UUID)
RETURNS TABLE(
  western_sign TEXT, indian_sign TEXT, nakshatra_name TEXT,
  venus_sign TEXT, mars_sign TEXT, mercury_sign TEXT,
  rising_sign TEXT, dominant_element TEXT
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT western_sign, indian_sign, nakshatra_name, venus_sign, mars_sign,
         mercury_sign, rising_sign, dominant_element
  FROM public.astro_details WHERE user_id = p_user_id;
$$;

-- RPC + trigger: derive_dominant_element  (035 create — unchanged thereafter)
-- Computes the dominant element (fire/earth/air/water) from a user's chart
-- signs by majority vote. Originally run as a one-off UPDATE backfill in 035;
-- recreated here as the standalone function only (the backfill UPDATE was a
-- one-time data migration, not part of final schema state).
CREATE OR REPLACE FUNCTION public.derive_dominant_element(
  sun TEXT, moon TEXT, venus TEXT, mars TEXT, mercury TEXT, rising TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  fire_count INT := 0; earth_count INT := 0;
  air_count INT := 0;  water_count INT := 0;
  signs TEXT[] := ARRAY[sun, moon, venus, mars, mercury, rising];
  s TEXT;
BEGIN
  FOREACH s IN ARRAY signs LOOP
    IF s IS NULL THEN CONTINUE; END IF;
    CASE lower(s)
      WHEN 'aries' THEN fire_count := fire_count + 1;
      WHEN 'leo' THEN fire_count := fire_count + 1;
      WHEN 'sagittarius' THEN fire_count := fire_count + 1;
      WHEN 'taurus' THEN earth_count := earth_count + 1;
      WHEN 'virgo' THEN earth_count := earth_count + 1;
      WHEN 'capricorn' THEN earth_count := earth_count + 1;
      WHEN 'gemini' THEN air_count := air_count + 1;
      WHEN 'libra' THEN air_count := air_count + 1;
      WHEN 'aquarius' THEN air_count := air_count + 1;
      WHEN 'cancer' THEN water_count := water_count + 1;
      WHEN 'scorpio' THEN water_count := water_count + 1;
      WHEN 'pisces' THEN water_count := water_count + 1;
      ELSE NULL;
    END CASE;
  END LOOP;
  RETURN (SELECT val FROM (VALUES
    ('fire', fire_count), ('earth', earth_count),
    ('air', air_count), ('water', water_count)
  ) AS t(val, cnt) ORDER BY cnt DESC LIMIT 1);
END; $$;


-- ============================================================================
-- TABLE: user_photos
-- (004 create, 019 +display_order check 0..5, 062 +storage_path, 078 +thumbnail_url)
-- NOTE: `is_primary` is referenced by get_user_photos_batch (060/062/079) but is
-- never explicitly created via ALTER TABLE anywhere in the 102 source migrations.
-- This is a genuine gap in the legacy schema (flagged in the report). Included
-- here as a defensive addition since downstream RPCs hard-depend on it existing.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  photo_url text NOT NULL,
  storage_path text,
  thumbnail_url text,
  display_order int DEFAULT 0 CHECK (display_order >= 0 AND display_order < 6),
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enforce_user_photos_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_count integer;
BEGIN
  SELECT COUNT(*)
    INTO current_count
    FROM public.user_photos
   WHERE user_id = NEW.user_id;

  IF current_count >= 6 THEN
    RAISE EXCEPTION 'A user can only have up to 6 photos';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_photos_limit ON public.user_photos;
CREATE TRIGGER trg_user_photos_limit
BEFORE INSERT ON public.user_photos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_user_photos_limit();


-- ============================================================================
-- TABLE: section1_qns  (file named "onboarding_responses" in migration 006,
-- but the actual table created is section1_qns — basic preferences questionnaire)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.section1_qns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  interest TEXT[] DEFAULT '{}',
  looking_for TEXT,
  relationship_status TEXT,
  hobbies TEXT[] DEFAULT '{}',
  height TEXT,
  introvert_extrovert TEXT,
  partner_preference TEXT[] DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_section1_qns_user_id ON public.section1_qns(user_id);

COMMENT ON TABLE public.section1_qns IS 'Stores user responses to Section 1 onboarding questionnaire (basic preferences)';

ALTER TABLE public.section1_qns ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: onboarding_responses
-- (018 create — editable profile fields: bio, languages, education, drinking, smoking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  about_me TEXT,
  languages TEXT[] DEFAULT '{}',
  education TEXT,
  drinking TEXT,
  smoking TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_onboarding_responses_user_id ON public.onboarding_responses(user_id);

COMMENT ON TABLE public.onboarding_responses IS 'Stores editable profile fields not in user_profiles/section1_qns (bio, languages, education, drinking, smoking).';

ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: personality_qns  (007 create)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.personality_qns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Lifestyle Habits Section (5 questions)
  what_type_of_date_excites_you_the_most TEXT[],
  how_do_you_feel_about_trying_unusual_foods_or_activities TEXT,
  what_kind_of_conversations_do_you_enjoy_with_a_partner TEXT,
  what_best_describes_your_planning_style TEXT,
  how_do_you_handle_commitments_in_a_relationship TEXT,

  -- Personality Traits Section (5 questions)
  your_room_or_workspace_usually_looks_like TEXT,
  your_ideal_way_to_spend_time_with_a_partner TEXT,
  your_energy_level_on_dates_is_usually TEXT,
  you_prefer_a_partner_who_is TEXT,
  during_arguments_you_usually TEXT,

  -- Relationship Dynamics Section (5 questions)
  how_do_you_show_care_in_a_relationship TEXT,
  what_kind_of_partner_are_you TEXT,
  when_your_partner_replies_late_you_feel TEXT,
  how_do_you_handle_emotional_ups_and_downs TEXT,
  how_often_do_you_overthink_relationships TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_personality_qns_user_id ON public.personality_qns(user_id);

ALTER TABLE public.personality_qns ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_personality_qns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS personality_qns_updated_at_trigger ON public.personality_qns;
CREATE TRIGGER personality_qns_updated_at_trigger
BEFORE UPDATE ON public.personality_qns
FOR EACH ROW
EXECUTE FUNCTION public.update_personality_qns_updated_at();


-- ============================================================================
-- TABLE: user_prompts  (075 create — Hinge-style prompts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_id TEXT NOT NULL,
  question VARCHAR(100) NOT NULL,
  answer VARCHAR(300) NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_user_prompts_user_id ON public.user_prompts(user_id);

COMMENT ON TABLE public.user_prompts IS 'Stores Hinge-style prompts (questions and answers) for dating profiles';

ALTER TABLE public.user_prompts ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: user_likes
-- (008 create, 044 (note via 041)... actually 041 +note/+photo_index,
--  075 +prompt_id/+comment)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'dislike', 'super_like')),
  note TEXT,
  photo_index INT,
  prompt_id TEXT DEFAULT NULL,
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, liked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_likes_user_id ON public.user_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_liked_user_id ON public.user_likes(liked_user_id);
CREATE INDEX IF NOT EXISTS idx_user_likes_action_type ON public.user_likes(action_type);
CREATE INDEX IF NOT EXISTS idx_user_likes_user_liked ON public.user_likes(user_id, liked_user_id, action_type);
CREATE INDEX IF NOT EXISTS idx_user_likes_mutual_check ON public.user_likes(liked_user_id, user_id, action_type) WHERE action_type IN ('like', 'super_like');
CREATE INDEX IF NOT EXISTS idx_user_likes_user_acted ON public.user_likes(user_id, liked_user_id);

COMMENT ON TABLE public.user_likes IS 'Stores user likes, dislikes, and super likes for matching functionality';
COMMENT ON COLUMN public.user_likes.prompt_id IS 'Identifies the specific prompt ID that was liked, if any';
COMMENT ON COLUMN public.user_likes.comment IS 'Optional comment text sent alongside the profile/prompt like';

ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: user_matches
-- (010 create, 046 +icebreaker_text/+icebreaker_generated_at)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL UNIQUE,
  icebreaker_text TEXT,
  icebreaker_generated_at TIMESTAMPTZ,
  matched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT user_matches_users_check CHECK (user1_id < user2_id),
  CONSTRAINT user_matches_unique UNIQUE (user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_user_matches_user1 ON public.user_matches(user1_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_user2 ON public.user_matches(user2_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_channel ON public.user_matches(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_user_lookup ON public.user_matches(user1_id, user2_id);
CREATE INDEX IF NOT EXISTS idx_user_matches_icebreaker_pending ON public.user_matches (id) WHERE icebreaker_text IS NULL;

COMMENT ON TABLE public.user_matches IS 'Stores mutual likes (matches) between users with unique channel IDs for messaging';
COMMENT ON COLUMN public.user_matches.icebreaker_text IS
  'AI-generated conversation starter, written once by Gemini at match time.
   NULL means generation is pending or failed (static fallback will be shown).';
COMMENT ON COLUMN public.user_matches.icebreaker_generated_at IS
  'Timestamp of successful Gemini generation. NULL if still pending.';

ALTER TABLE public.user_matches ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: user_preferences
-- (014 create, 016 +location/+gender_preference/+sexual_orientation,
--  067 +preferred_elements/+blocked_signs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  min_age INTEGER NOT NULL DEFAULT 18,
  max_age INTEGER NOT NULL DEFAULT 65,
  max_distance INTEGER NOT NULL DEFAULT 50,
  new_match_notifications BOOLEAN NOT NULL DEFAULT TRUE,
  location text,
  gender_preference text,
  sexual_orientation text,
  preferred_elements TEXT[] NOT NULL DEFAULT '{}',
  blocked_signs TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: user_online_status  (020 create)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_online_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_online_status ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: messages
-- (021 create, 069 +moderation_status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users,
  receiver_id uuid REFERENCES auth.users,
  message_text text,
  is_read boolean DEFAULT false,
  channel_id text,
  moderation_status TEXT NOT NULL DEFAULT 'SAFE'
    CHECK (moderation_status IN ('SAFE', 'SPAM', 'HARASSMENT', 'ILLEGAL')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_moderation_status ON public.messages (moderation_status) WHERE moderation_status != 'SAFE';

COMMENT ON COLUMN public.messages.moderation_status IS
  'Content moderation classification. SAFE = clean; SPAM/HARASSMENT = stored but flagged; ILLEGAL = blocked before insert.';

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Final-state FKs (103 added ON DELETE CASCADE to sender/receiver)
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_id_fkey,
  DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
    FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT messages_receiver_id_fkey
    FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================================
-- TABLE: reports  (021 create, 103 cascade-delete FKs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES auth.users,
  reported_user_id uuid REFERENCES auth.users,
  channel_id text,
  category text,
  subcategory text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.reports
  DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey,
  DROP CONSTRAINT IF EXISTS reports_reported_user_id_fkey;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_id_fkey
    FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT reports_reported_user_id_fkey
    FOREIGN KEY (reported_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================================
-- TABLE: swipe_actions  (021 create, 090 cascade-delete FKs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.swipe_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id uuid REFERENCES auth.users,
  swiped_id uuid REFERENCES auth.users,
  action_type text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.swipe_actions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.swipe_actions
  DROP CONSTRAINT IF EXISTS swipe_actions_swiper_id_fkey,
  DROP CONSTRAINT IF EXISTS swipe_actions_swiped_id_fkey;
ALTER TABLE public.swipe_actions
  ADD CONSTRAINT swipe_actions_swiper_id_fkey
    FOREIGN KEY (swiper_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD CONSTRAINT swipe_actions_swiped_id_fkey
    FOREIGN KEY (swiped_id) REFERENCES auth.users(id) ON DELETE CASCADE;


-- ============================================================================
-- TABLE: block_users  (077 create)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.block_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.block_users ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: western_zodiac_compatibility / Indian_zodiac_match_scores  (022 create)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.western_zodiac_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sign_a text,
  sign_b text,
  compatibility_score numeric,
  description text
);

CREATE TABLE IF NOT EXISTS public."Indian_zodiac_match_scores" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nakshatra_a text,
  nakshatra_b text,
  match_score numeric,
  description text
);

-- Both reference tables are unseeded/unused by any RPC in the source (see
-- migration-squash-report.md, judgment call #6) but RLS was never enabled on
-- them in the legacy project either — closing that gap defensively here since
-- this is static lookup data with no write path, not a functional change.
ALTER TABLE public.western_zodiac_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Indian_zodiac_match_scores" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read zodiac compatibility" ON public.western_zodiac_compatibility;
CREATE POLICY "Authenticated users can read zodiac compatibility"
  ON public.western_zodiac_compatibility
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can read nakshatra match scores" ON public."Indian_zodiac_match_scores";
CREATE POLICY "Authenticated users can read nakshatra match scores"
  ON public."Indian_zodiac_match_scores"
  FOR SELECT
  USING (auth.role() = 'authenticated');


-- ============================================================================
-- TABLE: shooting_star_log  (041 create — quota tracking history for icebreaker likes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shooting_star_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.shooting_star_log ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: astro_events  (045 create — admin-managed banner events e.g. Mercury Rx)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.astro_events (
  id          SERIAL PRIMARY KEY,
  event_type  VARCHAR(50)  NOT NULL,
  event_name  VARCHAR(100) NOT NULL,
  start_date  TIMESTAMPTZ  NOT NULL,
  end_date    TIMESTAMPTZ  NOT NULL,
  description TEXT,
  ui_config   JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_astro_events_active ON public.astro_events (start_date, end_date);

ALTER TABLE public.astro_events ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: user_push_tokens / user_notification_preferences / notification_delivery_logs
-- (054 create — Expo push notification infrastructure)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  device_id TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT user_push_tokens_platform_check
    CHECK (platform IN ('ios', 'android', 'web', 'unknown'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_tokens_token ON public.user_push_tokens (expo_push_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_push_tokens_user_device ON public.user_push_tokens (user_id, device_id) WHERE device_id IS NOT NULL AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user_active ON public.user_push_tokens (user_id, is_active, last_seen_at DESC);

ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  new_matches_enabled BOOLEAN NOT NULL DEFAULT true,
  new_messages_enabled BOOLEAN NOT NULL DEFAULT true,
  marketing_enabled BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expo_ticket_ids TEXT[],
  expo_receipt_ids TEXT[],
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_delivery_logs_type_check
    CHECK (notification_type IN ('new_match', 'new_message', 'marketing')),
  CONSTRAINT notification_delivery_logs_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_delivery_logs_dedupe ON public.notification_delivery_logs (dedupe_key);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_claim ON public.notification_delivery_logs (status, next_attempt_at, created_at);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_user_status ON public.notification_delivery_logs (user_id, status, created_at DESC);

ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- TABLE: ai_usage_tracking  (050 create — generic per-user/per-endpoint AI usage limiter)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ai_usage_unique_per_day UNIQUE (user_id, endpoint, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage_tracking(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_endpoint_date ON public.ai_usage_tracking(endpoint, usage_date);

-- RPC: increment_ai_usage  (050 create — unchanged thereafter)
-- Generic per-user/per-endpoint daily usage limiter. Endpoint-agnostic (the
-- endpoint name is passed by the caller) — not specific to any one AI feature.
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user UUID, p_endpoint TEXT, p_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  LOOP
    SELECT request_count INTO v_count
    FROM public.ai_usage_tracking
    WHERE user_id = p_user AND endpoint = p_endpoint AND usage_date = CURRENT_DATE
    FOR UPDATE
    ;

    IF FOUND THEN
      IF v_count >= p_limit THEN
        RETURN FALSE;
      END IF;
      UPDATE public.ai_usage_tracking
      SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = p_user AND endpoint = p_endpoint AND usage_date = CURRENT_DATE;
      RETURN TRUE;
    ELSE
      INSERT INTO public.ai_usage_tracking(user_id, endpoint, request_count, usage_date)
      VALUES (p_user, p_endpoint, 1, CURRENT_DATE)
      ON CONFLICT (user_id, endpoint, usage_date) DO NOTHING;

      IF ROW_COUNT = 1 THEN
        RETURN TRUE;
      END IF;
    END IF;
  END LOOP;
END;
$$;


-- ============================================================================
-- STORAGE BUCKETS  (024 create, 060/070 mime-type + size-limit updates)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-photos', 'user-photos', false),
       ('messages', 'messages', false)
ON CONFLICT (id) DO NOTHING;

UPDATE storage.buckets
SET file_size_limit = 5242880,  -- 5MB
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/ogg',
      'audio/webm'
    ]
WHERE id IN ('user-photos', 'messages');

-- Storage policies for user-photos and messages buckets (024 create)
DROP POLICY IF EXISTS "user-photos-authenticated-select" ON storage.objects;
CREATE POLICY "user-photos-authenticated-select"
  ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

DROP POLICY IF EXISTS "user-photos-authenticated-insert" ON storage.objects;
CREATE POLICY "user-photos-authenticated-insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

DROP POLICY IF EXISTS "user-photos-authenticated-update" ON storage.objects;
CREATE POLICY "user-photos-authenticated-update"
  ON storage.objects
  FOR UPDATE
  USING ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

DROP POLICY IF EXISTS "user-photos-authenticated-delete" ON storage.objects;
CREATE POLICY "user-photos-authenticated-delete"
  ON storage.objects
  FOR DELETE
  USING ( bucket_id = 'user-photos' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

DROP POLICY IF EXISTS "messages-authenticated-select" ON storage.objects;
CREATE POLICY "messages-authenticated-select"
  ON storage.objects
  FOR SELECT
  USING ( bucket_id = 'messages' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );

DROP POLICY IF EXISTS "messages-authenticated-insert" ON storage.objects;
CREATE POLICY "messages-authenticated-insert"
  ON storage.objects
  FOR INSERT
  WITH CHECK ( bucket_id = 'messages' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text );


-- ============================================================================
-- RPC: check_auth_user_exists / check_phone_exists  (013 create, 023 wrapper)
-- Phone-existence lookup used by signup/login before the user is authenticated.
-- SECURITY DEFINER to read auth.users; this is the sanctioned replacement for
-- the broad RLS phone-check policies that were removed in 056/059.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_auth_user_exists(input_phone TEXT)
RETURNS TABLE(
  user_id UUID,
  phone TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_phone TEXT;
BEGIN
  normalized_phone := TRIM(LEADING '+' FROM input_phone);

  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.phone AS phone,
    au.created_at
  FROM auth.users au
  WHERE au.phone = normalized_phone OR au.phone = input_phone
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.check_auth_user_exists IS 'Checks if a phone number exists in auth.users table. Returns user_id, phone, and created_at if found.';

CREATE OR REPLACE FUNCTION public.check_phone_exists(p_phone text)
RETURNS TABLE (
  user_id uuid,
  phone text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM public.check_auth_user_exists(p_phone);
END;
$$;


-- ============================================================================
-- RPC: get_user_photos_batch  (060 create, 062 +storage_path, 079 FINAL +thumbnail_url)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_user_photos_batch(uuid[]);
CREATE FUNCTION public.get_user_photos_batch(p_user_ids uuid[])
RETURNS TABLE (
  user_id uuid,
  photo_url text,
  storage_path text,
  thumbnail_url text,
  display_order int,
  is_primary boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, photo_url, storage_path, thumbnail_url, display_order, is_primary
  FROM public.user_photos
  WHERE user_id = ANY(p_user_ids)
  ORDER BY is_primary DESC, display_order ASC;
$$;


-- ============================================================================
-- RPC: delete_old_messages  (023 create, 058 FINAL — 90-day retention, batched deletes)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.delete_old_messages()
RETURNS TABLE(deleted_count bigint, conversations_processed bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_size int := 10000;
  deleted_total bigint := 0;
  del_count int := 0;
BEGIN
  LOOP
    DELETE FROM public.messages
    WHERE id IN (
      SELECT id FROM public.messages
      WHERE created_at < now() - interval '90 days'
      LIMIT batch_size
    );

    GET DIAGNOSTICS del_count = ROW_COUNT;
    IF del_count = 0 THEN
      EXIT;
    END IF;

    deleted_total := deleted_total + del_count;
  END LOOP;

  RETURN QUERY SELECT deleted_total AS deleted_count, 0 AS conversations_processed;
END;
$$;


-- ============================================================================
-- RPC: block_user / get_blocked_user_ids  (077 create, 102 FINAL block_user —
-- preserves the match instead of deleting it, so unblocking restores the chat;
-- messaging is still prevented while blocked via the messages INSERT policy)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.block_users (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
  -- Match is intentionally preserved (102) so it can be restored on unblock.
END;
$$;

GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_blocked_user_ids()
RETURNS SETOF uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT blocked_id
  FROM public.block_users
  WHERE blocker_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_blocked_user_ids() TO authenticated;


-- ============================================================================
-- RPC: get_user_display_name / get_users_display_info  (068 create — unchanged
-- thereafter). SECURITY DEFINER name/location lookups scoped to relationship
-- (self, matched, or like-related) — required because 057/059 removed broad
-- cross-user reads of user_profiles via RLS.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_display_name(
  p_target_user_id UUID
)
RETURNS TABLE(user_id UUID, full_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id, up.full_name
  FROM public.user_profiles up
  WHERE up.user_id = p_target_user_id
    AND (
      auth.uid() = up.user_id
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (um.user1_id = auth.uid() AND um.user2_id = up.user_id)
           OR (um.user1_id = up.user_id AND um.user2_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = up.user_id
          AND ul.liked_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = auth.uid()
          AND ul.liked_user_id = up.user_id
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_users_display_info(
  p_target_user_ids UUID[]
)
RETURNS TABLE(user_id UUID, full_name TEXT, location TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT up.user_id, up.full_name, up.location
  FROM public.user_profiles up
  WHERE up.user_id = ANY(p_target_user_ids)
    AND (
      auth.uid() = up.user_id
      OR EXISTS (
        SELECT 1 FROM public.user_matches um
        WHERE (um.user1_id = auth.uid() AND um.user2_id = up.user_id)
           OR (um.user1_id = up.user_id AND um.user2_id = auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = up.user_id
          AND ul.liked_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.user_likes ul
        WHERE ul.user_id = auth.uid()
          AND ul.liked_user_id = up.user_id
      )
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_display_info(UUID[]) TO authenticated;


-- ============================================================================
-- RPC: link_apple_identity_to_user / link_google_identity_to_user  (080, 082
-- create — unchanged thereafter). Service-role-only identity linking, called
-- by Edge Functions during Apple/Google sign-in flows.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.link_apple_identity_to_user(
  p_user_id    uuid,
  p_apple_sub  text,
  p_apple_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_existing_user_id uuid;
  v_identity_id      uuid;
BEGIN
  SELECT user_id INTO v_existing_user_id
  FROM auth.identities
  WHERE provider = 'apple' AND provider_id = p_apple_sub;

  IF v_existing_user_id IS NOT NULL THEN
    IF v_existing_user_id = p_user_id THEN
      RETURN jsonb_build_object('status', 'already_linked');
    ELSE
      RETURN jsonb_build_object(
        'status', 'conflict',
        'error',  'This Apple ID is already linked to a different account'
      );
    END IF;
  END IF;

  v_identity_id := gen_random_uuid();

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_identity_id,
    p_user_id,
    p_apple_sub,
    jsonb_build_object(
      'sub',            p_apple_sub,
      'email',          COALESCE(p_apple_email, ''),
      'email_verified', true,
      'provider_id',    p_apple_sub
    ),
    'apple',
    NOW(), NOW(), NOW()
  );

  RETURN jsonb_build_object('status', 'linked', 'identity_id', v_identity_id);
END;
$$;

REVOKE ALL ON FUNCTION public.link_apple_identity_to_user FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.link_apple_identity_to_user TO service_role;

CREATE OR REPLACE FUNCTION public.link_google_identity_to_user(
  p_user_id      uuid,
  p_google_sub    text,
  p_google_email  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_existing_user_id uuid;
  v_identity_id      uuid;
BEGIN
  SELECT user_id INTO v_existing_user_id
  FROM auth.identities
  WHERE provider = 'google' AND provider_id = p_google_sub;

  IF v_existing_user_id IS NOT NULL THEN
    IF v_existing_user_id = p_user_id THEN
      RETURN jsonb_build_object('status', 'already_linked');
    ELSE
      RETURN jsonb_build_object(
        'status', 'conflict',
        'error',  'This Google ID is already linked to a different account'
      );
    END IF;
  END IF;

  v_identity_id := gen_random_uuid();

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_identity_id,
    p_user_id,
    p_google_sub,
    jsonb_build_object(
      'sub',            p_google_sub,
      'email',          COALESCE(p_google_email, ''),
      'email_verified', true,
      'provider_id',    p_google_sub
    ),
    'google',
    NOW(), NOW(), NOW()
  );

  RETURN jsonb_build_object('status', 'linked', 'identity_id', v_identity_id);
END;
$$;

REVOKE ALL ON FUNCTION public.link_google_identity_to_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_google_identity_to_user TO service_role;


-- ============================================================================
-- RPC: get_fallback_feed  (033 create, 077 +block filters, 098 FINAL +
-- bidirectional gender-preference filtering resolved from user_preferences or
-- section1_qns.interest as fallback)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_fallback_feed(uuid);
CREATE OR REPLACE FUNCTION public.get_fallback_feed(input_user_id UUID)
RETURNS TABLE (
  match_user_id UUID,
  full_name TEXT,
  gender TEXT,
  age INT,
  location TEXT,
  final_match_score NUMERIC,
  personality_score NUMERIC,
  indian_score NUMERIC,
  western_score NUMERIC,
  indian_recommendation TEXT,
  western_report TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_min_age           INT;
  v_max_age           INT;
  v_gender_pref       TEXT;
  v_viewer_gender     TEXT;
  v_location          TEXT;
BEGIN
  SELECT
    COALESCE(up.min_age, 18),
    COALESCE(up.max_age, 65),
    up.gender_preference,
    prof.gender,
    COALESCE(up.location, prof.location)
  INTO v_min_age, v_max_age, v_gender_pref, v_viewer_gender, v_location
  FROM public.user_profiles prof
  LEFT JOIN public.user_preferences up ON up.user_id = prof.user_id
  WHERE prof.user_id = input_user_id;

  v_min_age           := COALESCE(v_min_age, 18);
  v_max_age           := COALESCE(v_max_age, 65);

  IF v_gender_pref IS NULL THEN
    SELECT
      CASE
        WHEN s1.interest IS NULL THEN 'Everyone'
        WHEN 'everyone' = ANY(s1.interest) THEN 'Everyone'
        WHEN array_length(s1.interest, 1) = 1 THEN
          CASE
            WHEN s1.interest[1] = 'women' THEN 'Female'
            WHEN s1.interest[1] = 'men' THEN 'Male'
            WHEN s1.interest[1] = 'beyond-binary' THEN 'Non-binary'
            ELSE 'Everyone'
          END
        ELSE 'Everyone'
      END
    INTO v_gender_pref
    FROM public.section1_qns s1
    WHERE s1.user_id = input_user_id;
  END IF;

  RETURN QUERY
  SELECT
    up.user_id AS match_user_id,
    up.full_name,
    up.gender,
    EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age,
    up.location,
    ROUND(GREATEST(10.0 - (ROW_NUMBER() OVER (ORDER BY up.updated_at DESC) * 0.2), 1.0)::NUMERIC, 2) AS final_match_score,
    0::NUMERIC AS personality_score,
    0::NUMERIC AS indian_score,
    0::NUMERIC AS western_score,
    'Unscored'::TEXT AS indian_recommendation,
    'Unscored'::TEXT AS western_report
  FROM public.user_profiles up
  LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
  LEFT JOIN public.user_preferences cand_pref ON cand_pref.user_id = up.user_id
  LEFT JOIN public.section1_qns cand_sec1 ON cand_sec1.user_id = up.user_id
  WHERE up.user_id <> input_user_id
    AND up.user_id NOT IN (
      SELECT liked_user_id FROM public.user_likes WHERE user_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocked_id FROM public.block_users WHERE blocker_id = input_user_id
    )
    AND up.user_id NOT IN (
      SELECT blocker_id FROM public.block_users WHERE blocked_id = input_user_id
    )
    AND (
      ad.birth_date IS NULL
      OR EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date)) BETWEEN v_min_age AND v_max_age
    )
    AND (
      v_gender_pref IS NULL
      OR lower(v_gender_pref) IN ('everyone', 'all', '')
      OR lower(up.gender) = lower(v_gender_pref)
    )
    AND (
      lower(COALESCE(
        cand_pref.gender_preference,
        CASE
          WHEN cand_sec1.interest IS NULL THEN 'Everyone'
          WHEN 'everyone' = ANY(cand_sec1.interest) THEN 'Everyone'
          WHEN array_length(cand_sec1.interest, 1) = 1 THEN
            CASE
              WHEN cand_sec1.interest[1] = 'women' THEN 'Female'
              WHEN cand_sec1.interest[1] = 'men' THEN 'Male'
              WHEN cand_sec1.interest[1] = 'beyond-binary' THEN 'Non-binary'
              ELSE 'Everyone'
            END
          ELSE 'Everyone'
        END
      )) IN ('everyone', 'all', '')
      OR lower(COALESCE(
        cand_pref.gender_preference,
        CASE
          WHEN cand_sec1.interest IS NULL THEN 'Everyone'
          WHEN 'everyone' = ANY(cand_sec1.interest) THEN 'Everyone'
          WHEN array_length(cand_sec1.interest, 1) = 1 THEN
            CASE
              WHEN cand_sec1.interest[1] = 'women' THEN 'Female'
              WHEN cand_sec1.interest[1] = 'men' THEN 'Male'
              WHEN cand_sec1.interest[1] = 'beyond-binary' THEN 'Non-binary'
              ELSE 'Everyone'
            END
          ELSE 'Everyone'
        END
      )) = lower(v_viewer_gender)
    )
  ORDER BY up.updated_at DESC
  LIMIT 50;
END;
$$;
