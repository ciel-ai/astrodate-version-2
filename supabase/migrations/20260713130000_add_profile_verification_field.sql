-- ============================================================================
-- Profile verification badge field
-- ----------------------------------------------------------------------------
-- Adds is_verified to user_profiles for the Profile tab's Hero-card badge
-- (astrodate-version-2 Profile Tab plan, Phase 1). The verification *flow*
-- (selfie capture, review, etc.) is out of scope here -- this only adds a
-- place to read/display status from; "Get verified" links to a placeholder
-- route until that flow is built.
--
-- RLS on user_profiles is row-scoped, not column-scoped (20260630120100_rls.sql
-- "Users can update their own profile" allows arbitrary column changes on an
-- owned row) -- so a bare ALTER TABLE would let any authenticated user
-- self-verify via a normal .update() call. A BEFORE UPDATE trigger pins
-- is_verified back to its previous value unless the writer is service_role,
-- closing that gap without touching the existing row-level policies.
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.protect_is_verified_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.is_verified := OLD.is_verified;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_is_verified ON public.user_profiles;
CREATE TRIGGER trg_protect_is_verified
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_is_verified_column();
