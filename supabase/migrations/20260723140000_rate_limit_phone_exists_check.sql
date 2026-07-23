-- ============================================================================
-- Rate limit check_auth_user_exists / check_phone_exists by caller IP
-- ============================================================================
-- Both are anon-callable, pre-login RPCs (create-account.tsx / login.tsx call
-- them before a session exists, to avoid spending an OTP send on a number
-- that doesn't/does already have an account -- see
-- 20260718120000_narrow_check_auth_user_exists.sql for why the response was
-- already narrowed to a bare boolean). That still leaves them a phone-number
-- enumeration oracle for anyone holding the public anon key: nothing stopped
-- rapid-fire calls checking many numbers per second to build a list of which
-- phone numbers have an account. A single check for one known number (the
-- "is my ex on this app" case) isn't something a per-caller rate limit can
-- prevent -- it only takes one call -- but bulk enumeration does require many
-- calls in a short window, which this throttles.
--
-- Keyed on the caller's IP (from PostgREST's request.headers GUC, the
-- standard way a SECURITY DEFINER function sees the caller's address),
-- fixed 1-minute window, generous 20-call cap -- comfortably above any real
-- user's retry/typo pattern, low enough to blunt a bulk-enumeration script.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.phone_check_rate_limit (
  ip_address TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  call_count INT NOT NULL DEFAULT 0
);

-- No client access -- only the SECURITY DEFINER function below touches this.
ALTER TABLE public.phone_check_rate_limit ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_auth_user_exists(input_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized_phone TEXT;
  exists_flag BOOLEAN;
  v_ip TEXT;
  v_count INT;
BEGIN
  -- Best-effort IP extraction -- if request.headers isn't set (e.g. called
  -- outside a PostgREST request) or isn't the expected shape, fall back to a
  -- shared 'unknown' bucket rather than letting a bad assumption about the
  -- header format take down login/signup entirely. Rate limiting itself is
  -- weaker for that bucket (everyone with no detectable IP shares one
  -- counter), but the core existence check still works.
  BEGIN
    v_ip := NULLIF(TRIM(split_part(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ',', 1)), '');
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;
  v_ip := COALESCE(v_ip, 'unknown');

  INSERT INTO public.phone_check_rate_limit AS rl (ip_address, window_start, call_count)
  VALUES (v_ip, now(), 1)
  ON CONFLICT (ip_address) DO UPDATE
  SET call_count = CASE
        WHEN rl.window_start < now() - INTERVAL '1 minute' THEN 1
        ELSE rl.call_count + 1
      END,
      window_start = CASE
        WHEN rl.window_start < now() - INTERVAL '1 minute' THEN now()
        ELSE rl.window_start
      END
  RETURNING call_count INTO v_count;

  IF v_ip <> 'unknown' AND v_count > 20 THEN
    RAISE EXCEPTION 'Too many requests. Please try again in a minute.';
  END IF;

  normalized_phone := TRIM(LEADING '+' FROM input_phone);

  SELECT EXISTS(
    SELECT 1 FROM auth.users au
    WHERE au.phone = normalized_phone OR au.phone = input_phone
  ) INTO exists_flag;

  RETURN exists_flag;
END;
$$;

-- check_phone_exists just delegates to check_auth_user_exists, so it's
-- covered by the same rate limit without any change of its own.
