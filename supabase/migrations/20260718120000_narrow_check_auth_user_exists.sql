-- ============================================================================
-- Narrow check_auth_user_exists / check_phone_exists to a boolean
-- ----------------------------------------------------------------------------
-- These are anon-callable, pre-login RPCs (create-account.tsx, login.tsx call
-- them before a session exists) and that anon access is intentional. But they
-- previously returned the matched row's real auth.users.id and created_at,
-- even though both client call sites only ever check row-existence
-- (`.length > 0` / `.length === 0`). That let anyone holding the public anon
-- key call the RPC directly with an arbitrary phone number and get back the
-- account's UUID and signup date, and enabled phone-number enumeration.
-- Flagged in 20260717260000_anon_grant_hardening_audit.sql and deliberately
-- deferred there; closing it now.
-- ============================================================================
-- CREATE OR REPLACE cannot change a function's return type (TABLE(...) ->
-- BOOLEAN here) -- Postgres errors "cannot change return type of existing
-- function" and requires an explicit DROP first. Confirmed by actually
-- running this migration against a throwaway Postgres instance loaded with
-- the original TABLE-returning functions before writing the DROPs below.
DROP FUNCTION IF EXISTS public.check_auth_user_exists(TEXT);
DROP FUNCTION IF EXISTS public.check_phone_exists(TEXT);

CREATE FUNCTION public.check_auth_user_exists(input_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_phone TEXT;
  exists_flag BOOLEAN;
BEGIN
  normalized_phone := TRIM(LEADING '+' FROM input_phone);

  SELECT EXISTS(
    SELECT 1 FROM auth.users au
    WHERE au.phone = normalized_phone OR au.phone = input_phone
  ) INTO exists_flag;

  RETURN exists_flag;
END;
$$;

COMMENT ON FUNCTION public.check_auth_user_exists IS 'Checks if a phone number exists in auth.users table. Returns a boolean only -- see 20260718120000_narrow_check_auth_user_exists.sql for why the row shape was narrowed.';

-- DROP removes the function object entirely, including its ACL -- the
-- explicit anon/authenticated grants from 20260630120100_rls.sql don't carry
-- over to the newly created object, so they're reapplied here rather than
-- relying solely on Supabase's default-privilege auto-grant.
GRANT EXECUTE ON FUNCTION public.check_auth_user_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_auth_user_exists(TEXT) TO authenticated;

CREATE FUNCTION public.check_phone_exists(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN public.check_auth_user_exists(p_phone);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_phone_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_phone_exists(TEXT) TO authenticated;
