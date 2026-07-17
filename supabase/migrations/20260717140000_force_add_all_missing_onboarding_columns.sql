-- Migration to ensure all onboarding_responses columns exist on the remote database
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS weed TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS religion TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS have_children TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS want_children TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS relationship_style TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS workout TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS diet TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS pets TEXT;
ALTER TABLE public.onboarding_responses ADD COLUMN IF NOT EXISTS travel TEXT;
