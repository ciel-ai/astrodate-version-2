-- Migration to ensure the weed column exists on onboarding_responses
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS weed TEXT;
