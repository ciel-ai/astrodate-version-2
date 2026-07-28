import { assertEquals } from "jsr:@std/assert@1";
import { isInQuietHours, minutesUntilQuietHoursEnd, preferenceAllows } from "./index.ts";
import type { PreferenceRow } from "./index.ts";

function pref(overrides: Partial<PreferenceRow> = {}): PreferenceRow {
  return {
    user_id: "user-1",
    new_matches_enabled: true,
    new_messages_enabled: true,
    marketing_enabled: false,
    engagement_enabled: true,
    quiet_hours_start: null,
    quiet_hours_end: null,
    timezone: "UTC",
    ...overrides,
  };
}

Deno.test("preferenceAllows - defaults to allowed (all but marketing) when there is no preference row yet", () => {
  assertEquals(preferenceAllows(undefined, "new_match"), true);
  assertEquals(preferenceAllows(undefined, "new_message"), true);
  assertEquals(preferenceAllows(undefined, "engagement"), true);
  // Marketing has no explicit "no row" carve-out in the source -- it also
  // defaults to true when there's no row (same `!pref` early return), only
  // real per-user opt-outs disable it.
  assertEquals(preferenceAllows(undefined, "marketing"), true);
});

Deno.test("preferenceAllows - respects each notification type's own toggle", () => {
  assertEquals(preferenceAllows(pref({ new_matches_enabled: false }), "new_match"), false);
  assertEquals(preferenceAllows(pref({ new_messages_enabled: false }), "new_message"), false);
  assertEquals(preferenceAllows(pref({ engagement_enabled: false }), "engagement"), false);
  assertEquals(preferenceAllows(pref({ marketing_enabled: false }), "marketing"), false);
  assertEquals(preferenceAllows(pref({ marketing_enabled: true }), "marketing"), true);
});

Deno.test("isInQuietHours - false when quiet hours aren't configured", () => {
  assertEquals(isInQuietHours(pref(), new Date("2026-07-28T23:00:00Z")), false);
});

Deno.test("isInQuietHours - false when start equals end (a misconfigured/disabled window)", () => {
  const p = pref({ quiet_hours_start: "22:00", quiet_hours_end: "22:00" });
  assertEquals(isInQuietHours(p, new Date("2026-07-28T23:00:00Z")), false);
});

Deno.test("isInQuietHours - a normal same-day window (e.g. 13:00-18:00 UTC)", () => {
  const p = pref({ quiet_hours_start: "13:00", quiet_hours_end: "18:00", timezone: "UTC" });
  assertEquals(isInQuietHours(p, new Date("2026-07-28T15:00:00Z")), true);
  assertEquals(isInQuietHours(p, new Date("2026-07-28T12:59:00Z")), false);
  assertEquals(isInQuietHours(p, new Date("2026-07-28T18:00:00Z")), false); // end is exclusive
});

Deno.test("isInQuietHours - a window that wraps past midnight (e.g. 22:00-07:00)", () => {
  const p = pref({ quiet_hours_start: "22:00", quiet_hours_end: "07:00", timezone: "UTC" });
  assertEquals(isInQuietHours(p, new Date("2026-07-28T23:30:00Z")), true); // before midnight
  assertEquals(isInQuietHours(p, new Date("2026-07-29T03:00:00Z")), true); // after midnight
  assertEquals(isInQuietHours(p, new Date("2026-07-29T12:00:00Z")), false); // clearly daytime
});

Deno.test("isInQuietHours - evaluates the clock time in the preference's own timezone, not UTC", () => {
  // 22:00-07:00 IST is 16:30-01:30 UTC. At 17:00 UTC (22:30 IST) we're inside
  // quiet hours in IST despite it being late afternoon UTC.
  const p = pref({ quiet_hours_start: "22:00", quiet_hours_end: "07:00", timezone: "Asia/Kolkata" });
  assertEquals(isInQuietHours(p, new Date("2026-07-28T17:00:00Z")), true);
  assertEquals(isInQuietHours(p, new Date("2026-07-28T12:00:00Z")), false);
});

Deno.test("minutesUntilQuietHoursEnd - same-day window: straightforward minutes remaining", () => {
  const p = pref({ quiet_hours_start: "13:00", quiet_hours_end: "18:00", timezone: "UTC" });
  assertEquals(minutesUntilQuietHoursEnd(p, new Date("2026-07-28T17:00:00Z")), 60);
});

Deno.test("minutesUntilQuietHoursEnd - midnight-wrapping window: minutes remaining after midnight", () => {
  const p = pref({ quiet_hours_start: "22:00", quiet_hours_end: "07:00", timezone: "UTC" });
  assertEquals(minutesUntilQuietHoursEnd(p, new Date("2026-07-29T05:00:00Z")), 120);
});

Deno.test("minutesUntilQuietHoursEnd - midnight-wrapping window: minutes remaining before midnight wraps to next day", () => {
  const p = pref({ quiet_hours_start: "22:00", quiet_hours_end: "07:00", timezone: "UTC" });
  // At 23:00, end (07:00) is 8 hours away the "short way" only by wrapping
  // through midnight -- must not return a negative delta.
  assertEquals(minutesUntilQuietHoursEnd(p, new Date("2026-07-28T23:00:00Z")), 8 * 60);
});
