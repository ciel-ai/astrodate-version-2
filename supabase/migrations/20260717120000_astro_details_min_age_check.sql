-- ============================================================================
-- SERVER-SIDE MINIMUM AGE ENFORCEMENT (18+)
-- ============================================================================
-- birth-details.tsx already blocks the onboarding UI from submitting a birth
-- date under 18, but that check was client-only: astro_details is written via
-- an anon-key upsert, so any direct API call (or a patched client) could
-- write an under-18 birth_date with no server-side resistance. Apple/Google
-- both require dating apps to actually enforce an 18+ minimum, not just
-- collect and hint at it client-side.
-- ============================================================================

ALTER TABLE public.astro_details
  ADD CONSTRAINT astro_details_birth_date_min_age_check
  CHECK (birth_date <= (CURRENT_DATE - INTERVAL '18 years'));
