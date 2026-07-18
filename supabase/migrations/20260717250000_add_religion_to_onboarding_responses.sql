-- Migration: Add religion column to onboarding_responses table
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS religion text;
