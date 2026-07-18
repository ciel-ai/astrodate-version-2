-- ============================================================================
-- MODERATION OUTAGE LOG
-- ============================================================================
-- moderate-message fails open to SAFE on any Gemini outage/misconfiguration
-- (see supabase/functions/moderate-message/index.ts) -- a deliberate choice,
-- since a moderation outage must never silently block every message. But
-- until now that fail-open path had zero visibility: an outage was
-- indistinguishable from normal traffic short of grepping function logs.
-- This table gives it a queryable trail. moderation_blocklist_terms is
-- still the DB-level backstop underneath the Gemini pass; this is separate
-- -- it's a record of when the Gemini pass itself didn't run.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_outages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL,
  detail TEXT
);

-- RLS: no client access at all. Written exclusively by moderate-message's
-- service-role client; read via the Supabase dashboard / SQL, same access
-- model as moderation_blocklist_terms.
ALTER TABLE public.moderation_outages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.moderation_outages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.moderation_outages TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.moderation_outages_id_seq TO service_role;
