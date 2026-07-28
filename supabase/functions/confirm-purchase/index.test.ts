import { assertEquals } from "jsr:@std/assert@1";
import { resolveActivePlanSlug } from "./index.ts";

const FIXED_NOW = new Date("2026-07-28T00:00:00Z").getTime();
const FUTURE = new Date(FIXED_NOW + 30 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(FIXED_NOW - 24 * 60 * 60 * 1000).toISOString();

Deno.test("resolveActivePlanSlug - returns undefined when there are no entitlements at all", () => {
  assertEquals(resolveActivePlanSlug({}, FIXED_NOW), undefined);
});

Deno.test("resolveActivePlanSlug - resolves a single active astro_plus entitlement", () => {
  const entitlements = { astro_plus: { expires_date: FUTURE } };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), "astro_plus");
});

Deno.test("resolveActivePlanSlug - resolves a lifetime entitlement (expires_date: null) as active", () => {
  const entitlements = { astro_x: { expires_date: null } };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), "astro_x");
});

Deno.test("resolveActivePlanSlug - ignores an expired entitlement entirely", () => {
  const entitlements = { astro_plus: { expires_date: PAST } };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), undefined);
});

Deno.test("resolveActivePlanSlug - astro_x outranks astro_plus when both are active", () => {
  const entitlements = {
    astro_plus: { expires_date: FUTURE },
    astro_x: { expires_date: FUTURE },
  };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), "astro_x");
});

Deno.test("resolveActivePlanSlug - falls back to astro_plus when astro_x is present but expired", () => {
  const entitlements = {
    astro_plus: { expires_date: FUTURE },
    astro_x: { expires_date: PAST },
  };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), "astro_plus");
});

Deno.test("resolveActivePlanSlug - ignores an entitlement id RevenueCat reports that we don't recognize", () => {
  const entitlements = { some_future_addon: { expires_date: FUTURE } };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), undefined);
});

Deno.test("resolveActivePlanSlug - an unrecognized active entitlement doesn't block a real one from resolving", () => {
  const entitlements = {
    some_future_addon: { expires_date: FUTURE },
    astro_plus: { expires_date: FUTURE },
  };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), "astro_plus");
});

Deno.test("resolveActivePlanSlug - treats an entitlement expiring at exactly `now` as no longer active", () => {
  const entitlements = { astro_plus: { expires_date: new Date(FIXED_NOW).toISOString() } };
  assertEquals(resolveActivePlanSlug(entitlements, FIXED_NOW), undefined);
});
