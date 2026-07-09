-- ============================================================================
-- Align plan_catalog with the build plan's Section 3 / Section 6 numbers.
--
-- Section 3 specifies Astro+ at "~40" daily swipes with "~12/day (~30%)"
-- high-band (80-100) matches; this project's seed (20260630120200_subscriptions)
-- had Astro+ at 30 daily_likes with no explicit high-match quota at all. This
-- migration:
--   1. Bumps astro_plus.daily_likes 30 -> 40 to match the plan.
--   2. Adds deck_size / high_match_quota / high_match_percent / top_match_of_day
--      to all three plans' features JSON -- the numbers the upcoming
--      get_discover_deck deck-composition RPC (build plan Day 12) will read,
--      instead of guessing them ad hoc in that function:
--        - Free:     deck_size 10, high_match_quota 1   (~10%)
--        - Astro+:   deck_size 40, high_match_quota 12  (~30%)
--        - AstroX:   deck_size 100 (plan's "unlimited, cap ~100"),
--                    high_match_percent 50 (floor is ratio-based, not a fixed
--                    count, per Section 6), top_match_of_day true (pins the
--                    single highest-scoring candidate -- see get_my_daily_pick,
--                    which already computes this via get_match_score).
-- Free and Astro+ get top_match_of_day = false and high_match_percent = null
-- since their floor is a fixed count, not a ratio; AstroX gets
-- high_match_quota = null since its floor is the ratio instead.
-- ============================================================================

UPDATE public.plan_catalog
SET features = features || '{
  "daily_likes": 40,
  "deck_size": 40,
  "high_match_quota": 12,
  "high_match_percent": null,
  "top_match_of_day": false
}'::jsonb
WHERE plan_slug = 'astro_plus';

UPDATE public.plan_catalog
SET features = features || '{
  "deck_size": 10,
  "high_match_quota": 1,
  "high_match_percent": null,
  "top_match_of_day": false
}'::jsonb
WHERE plan_slug = 'free';

UPDATE public.plan_catalog
SET features = features || '{
  "deck_size": 100,
  "high_match_quota": null,
  "high_match_percent": 50,
  "top_match_of_day": true
}'::jsonb
WHERE plan_slug = 'astro_x';
