-- ============================================================================
-- western_zodiac_compatibility and Indian_zodiac_match_scores are confirmed
-- dead: 0 rows in production, no function/view/FK references them (verified
-- against a fresh live schema dump -- only their own DDL, PK, RLS policy, and
-- grants mention their names), and no client code (src/) references them
-- either. They're superseded by the real, seeded, actually-wired tables:
-- western_compatibility_cache (get_western_compatibility) and
-- synastry_cache_details (get_indian_compatibility). Both dead tables were
-- also still grant-open to anon (RLS happened to block anon via an
-- authenticated-only SELECT policy, but there's no reason to keep either the
-- exposure or the dead schema around). Dropping outright rather than leaving
-- them as inert-but-present, since 0 rows means there is nothing to migrate.
-- ============================================================================
DROP TABLE IF EXISTS public.western_zodiac_compatibility;
DROP TABLE IF EXISTS public."Indian_zodiac_match_scores";
