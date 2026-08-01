-- ============================================================================
-- Block anon/authenticated writes to public.spatial_ref_sys
-- ============================================================================
-- Security advisor flags spatial_ref_sys (RLS disabled) as critical. It's
-- PostGIS's own static SRID reference table, owned by supabase_admin (the
-- role that installs the extension) -- confirmed live that neither
-- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` nor `REVOKE ... FROM PUBLIC`
-- succeeds from this project's own postgres role (42501: must be owner of
-- table). This is a platform-level restriction, not something a project-side
-- migration can fix directly.
--
-- The real risk isn't the read exposure (static, non-sensitive EPSG data --
-- the same rows ship with every public PostGIS install) -- it's that this
-- project's anon/authenticated roles were also confirmed live to hold
-- INSERT/UPDATE/DELETE/TRUNCATE on this table (inherited via a PUBLIC grant
-- from the extension's own install script). Since RLS can't be enabled and
-- those grants can't be revoked, anyone holding the bundled anon key could
-- otherwise wipe or corrupt PostGIS's SRID table via a plain PostgREST call,
-- breaking every geography/geometry feature (astro-geo's nearby matching,
-- coordinate math) database-wide.
--
-- Workaround: postgres/service_role still hold the TRIGGER privilege on the
-- table (a separate grant from ownership), which does NOT require being the
-- table owner to exercise. A BEFORE trigger fires on every write regardless
-- of grants, so this closes the actual write-exposure without needing
-- ownership. Scoped to only block anon/authenticated specifically (checked
-- via current_user) so it doesn't interfere with a future PostGIS extension
-- upgrade, which could plausibly need to write new SRID rows as some
-- internal/admin role.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.block_spatial_ref_sys_writes()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    RAISE EXCEPTION 'spatial_ref_sys is read-only via the API';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- NOTE: DROP TRIGGER (even IF EXISTS) requires table ownership on Supabase's
-- managed Postgres and fails with 42501 for this extension-owned table, same
-- as ALTER TABLE/REVOKE above -- confirmed live. CREATE OR REPLACE TRIGGER
-- (PG14+) only requires the TRIGGER privilege, same as plain CREATE TRIGGER,
-- so it's the only idempotent form that actually works here.
CREATE OR REPLACE TRIGGER block_writes_spatial_ref_sys
  BEFORE INSERT OR UPDATE OR DELETE ON public.spatial_ref_sys
  FOR EACH ROW EXECUTE FUNCTION public.block_spatial_ref_sys_writes();

CREATE OR REPLACE TRIGGER block_truncate_spatial_ref_sys
  BEFORE TRUNCATE ON public.spatial_ref_sys
  FOR EACH STATEMENT EXECUTE FUNCTION public.block_spatial_ref_sys_writes();
