-- Migration: Add workout, diet, pets, and travel columns to onboarding_responses table
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS workout text;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS diet text;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS pets text;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS travel text;
