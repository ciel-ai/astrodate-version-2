-- ============================================================================
-- AstroDate — Daily Insights oracle draw state
-- ============================================================================
-- Tracks whether the caller has already "drawn" today's insight so the
-- Daily Insights tab can show the sealed-card CTA vs the revealed state.
-- "Drawn today" is compared by calendar day, not exact time — done client-side
-- against device-local "today", since this is per-user personal state (unlike
-- daily_insights_cache, which needs a shared UTC key across users).
--
-- Same singleton-per-user shape as user_online_status. No RPC needed — the
-- client reads/upserts this table directly via supabase-js, same as
-- saved_insights needed no RPC.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_oracle_draws (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_drawn_at TIMESTAMPTZ
);

ALTER TABLE public.user_oracle_draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own oracle draw state" ON public.user_oracle_draws;
CREATE POLICY "Users can manage their own oracle draw state"
  ON public.user_oracle_draws
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
