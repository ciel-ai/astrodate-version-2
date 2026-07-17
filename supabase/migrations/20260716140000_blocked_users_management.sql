-- ============================================================================
-- Blocked-users management for Settings.
--
-- get_blocked_user_ids() was locked to service_role-only by
-- 20260710160000_function_grant_lockdown.sql, three days before any client
-- feature used it -- same "lockdown migration outlives the security review
-- that predates the feature" pattern already found and fixed for
-- get_my_membership()/cancel_my_subscription() in 20260713120000. Since it
-- only returns bare uuids anyway (not enough for a settings list UI), this
-- adds a richer, properly-granted replacement instead of re-granting the
-- old one, plus the unblock RPC that never existed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_my_blocked_users()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  photo_url text,
  blocked_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    b.blocked_id,
    COALESCE(up.full_name, 'Deleted user'),
    (
      SELECT p.photo_url
      FROM public.user_photos p
      WHERE p.user_id = b.blocked_id
      ORDER BY p.is_primary DESC, p.display_order ASC
      LIMIT 1
    ) AS photo_url,
    b.created_at
  FROM public.block_users b
  LEFT JOIN public.user_profiles up ON up.user_id = b.blocked_id
  WHERE b.blocker_id = auth.uid()
  ORDER BY b.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_blocked_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.block_users
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unblock_user(uuid) TO authenticated;
