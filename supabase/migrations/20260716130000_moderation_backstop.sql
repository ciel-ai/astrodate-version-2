-- ============================================================================
-- MODERATION BACKSTOP
-- ============================================================================
-- A defense-in-depth trigger to reject severe blocklist terms synchronously
-- at the database level, preventing API bypasses of the client's Gemini check.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_blocklist_terms (
  term TEXT PRIMARY KEY,
  severity TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: No access to normal users. This table is strictly used by the superuser trigger.
ALTER TABLE public.moderation_blocklist_terms ENABLE ROW LEVEL SECURITY;

-- Seed initial backstop terms
INSERT INTO public.moderation_blocklist_terms (term, severity)
VALUES
  ('kill yourself', 'ILLEGAL'),
  ('faggot', 'HARASSMENT'),
  ('nigger', 'HARASSMENT'),
  ('http://scam-link.com', 'SPAM'),
  ('venmo me', 'SPAM'),
  ('cashapp', 'SPAM')
ON CONFLICT (term) DO NOTHING;

CREATE OR REPLACE FUNCTION public.check_message_moderation_backstop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  blocked_term TEXT;
BEGIN
  -- Perform a fast substring match against active blocklist terms.
  -- The check runs instantly since the terms list is small and in-memory.
  SELECT term INTO blocked_term
  FROM public.moderation_blocklist_terms
  WHERE active = true
    AND NEW.message_text ILIKE '%' || term || '%'
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'Message blocked: Contains prohibited language.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderation_backstop ON public.messages;
CREATE TRIGGER trg_moderation_backstop
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.check_message_moderation_backstop();
