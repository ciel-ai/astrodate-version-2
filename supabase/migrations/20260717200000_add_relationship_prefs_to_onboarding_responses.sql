-- Migration: Add children and relationship style columns to onboarding_responses table
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS have_children text;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS want_children text;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS relationship_style text;
