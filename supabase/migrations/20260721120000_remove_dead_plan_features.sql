-- ============================================================================
-- Remove dead plan_catalog.features keys.
--
-- Live audit (2026-07-21): grepped every migration for `features->>'...'`
-- reads and every client file for direct `.features.<key>` / hasFeature()
-- usage. Only 8 keys are actually read by any RPC or component:
--   daily_likes, see_who_likes_you, weekly_super_likes, daily_rewinds,
--   deck_size, high_match_quota, high_match_percent, top_match_of_day
-- (why_you_match / personality-Indian-Western sub-score / Manglik-Nadi-
-- Bhakoot dosha gating are all direct `v_plan_slug = ...` checks in SQL, not
-- features-JSON reads, so they're untouched by this).
--
-- The remaining 13 keys were seeded as marketing/roadmap placeholders and
-- are read by nothing: advanced_filters, dealbreakers, incognito_mode,
-- basic_compatibility, full_synastry_report, deep_synastry,
-- daily_cosmic_insights, ai_match_reading, weekly_boost, priority_likes,
-- skip_the_line, astrologer_chat, reading_packages. astrologer_chat/
-- reading_packages were also `true` even on Free, which never made sense
-- for a feature with real per-session human cost -- removing rather than
-- fixing since there's no pay-per-credit model built yet.
--
-- Full replace (not `||` merge) of each plan's `features`, so a future
-- `db reset` replaying 20260630120200_subscriptions.sql's original 21-key
-- seed still ends up at this trimmed 8-key set once migrations replay to
-- here -- same pattern as 20260708120000/20260709140000 already used to
-- layer additive changes on top of that same seed.
-- ============================================================================

UPDATE public.plan_catalog
SET features = '{
  "daily_likes": 10,
  "see_who_likes_you": 1,
  "weekly_super_likes": 1,
  "daily_rewinds": 0,
  "deck_size": 10,
  "high_match_quota": 1,
  "high_match_percent": null,
  "top_match_of_day": false
}'::jsonb
WHERE plan_slug = 'free';

UPDATE public.plan_catalog
SET features = '{
  "daily_likes": 40,
  "see_who_likes_you": 5,
  "weekly_super_likes": 3,
  "daily_rewinds": 1,
  "deck_size": 40,
  "high_match_quota": 12,
  "high_match_percent": null,
  "top_match_of_day": false
}'::jsonb
WHERE plan_slug = 'astro_plus';

UPDATE public.plan_catalog
SET features = '{
  "daily_likes": -1,
  "see_who_likes_you": -1,
  "weekly_super_likes": 5,
  "daily_rewinds": -1,
  "deck_size": 100,
  "high_match_quota": null,
  "high_match_percent": 50,
  "top_match_of_day": true
}'::jsonb
WHERE plan_slug = 'astro_x';
