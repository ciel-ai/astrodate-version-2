/**
 * scripts/test-daily-insights.ts
 *
 * Phase 4 — live integration tests for the daily-insights Edge Function
 * against the real deployed project (no mocking): cache correctness, the
 * concurrent-cache-miss race, and the incomplete/approximate-birth-data
 * fallback path.
 *
 * Creates temporary throwaway auth users + astro_details rows via the
 * service role, calls the deployed daily-insights function directly over
 * HTTP, and cleans up everything it created afterward (including any
 * daily_insights_cache rows THIS run populated — never touches pre-existing
 * cache rows for other nakshatras).
 *
 * Run with: npx tsx --env-file=.env scripts/test-daily-insights.ts
 *
 * Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * EXPO_PUBLIC_SUPABASE_ANON_KEY, ASTROLOGY_API_USER_ID, ASTROLOGY_API_KEY
 */

import { createClient } from "@supabase/supabase-js";

if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = class {} as unknown as typeof WebSocket;
}

const REQUIRED_ENV = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ASTROLOGY_API_USER_ID",
  "ASTROLOGY_API_KEY",
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ASTRO_AUTH =
  "Basic " +
  Buffer.from(`${process.env.ASTROLOGY_API_USER_ID}:${process.env.ASTROLOGY_API_KEY}`).toString(
    "base64"
  );

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

type BirthData = {
  day: number;
  month: number;
  year: number;
  hour: number;
  min: number;
  lat: number;
  lon: number;
  tzone: number;
};

const NEW_DELHI = { lat: 28.6139, lon: 77.209, tzone: 5.5 };

/** One-off probe call (same endpoint the real onboarding flow uses) to learn
 * which nakshatra a given birth data set resolves to, so the test astro_details
 * row we insert has an internally-consistent nakshatra_name — same as real
 * onboarding computes it once and stores it, rather than recomputing it daily. */
async function probeNakshatra(birth: BirthData): Promise<{ nakshatra: string; moonSign: string }> {
  const res = await fetch("https://json.astrologyapi.com/v1/daily_nakshatra_prediction", {
    method: "POST",
    headers: { Authorization: ASTRO_AUTH, "Content-Type": "application/json", "Accept-Language": "en" },
    body: JSON.stringify(birth),
  });
  if (!res.ok) throw new Error(`probeNakshatra API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { nakshatra: data.birth_moon_nakshatra, moonSign: data.birth_moon_sign };
}

async function createTestUser(label: string): Promise<string> {
  const email = `daily-insights-test-${Date.now()}-${label}@example.test`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createTestUser(${label}) failed: ${error?.message}`);
  return data.user.id;
}

async function insertAstroDetails(
  userId: string,
  birth: BirthData,
  nakshatra: string | null
): Promise<void> {
  const { error } = await db.from("astro_details").insert({
    user_id: userId,
    birth_date: `${birth.year}-${String(birth.month).padStart(2, "0")}-${String(birth.day).padStart(2, "0")}`,
    birth_time: `${String(birth.hour).padStart(2, "0")}:${String(birth.min).padStart(2, "0")}:00`,
    birth_location: "Test City",
    birth_latitude: birth.lat,
    birth_longitude: birth.lon,
    birth_timezone: `UTC+${birth.tzone}`,
    nakshatra_name: nakshatra,
  });
  if (error) throw new Error(`insertAstroDetails failed: ${error.message}`);
}

async function callDailyInsights(userId: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/daily-insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Must match: this project's API-key system rejects an Authorization
      // key and an apikey header that identify different roles ("Conflicting
      // API keys"). The function itself only checks Authorization presence
      // and trusts user_id in the body (same model as compute-synastry), so
      // using the service role key for both is fine for this test harness.
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    json = { _rawStatus: res.status, _rawBody: text };
  }
  json._httpStatus = res.status;
  return json;
}

async function cacheRowExists(nakshatra: string, date: string): Promise<boolean> {
  const { data } = await db
    .from("daily_insights_cache")
    .select("id")
    .eq("nakshatra", nakshatra)
    .eq("prediction_date", date)
    .maybeSingle();
  return !!data;
}

async function cacheRowCount(nakshatra: string, date: string): Promise<number> {
  const { count } = await db
    .from("daily_insights_cache")
    .select("id", { count: "exact", head: true })
    .eq("nakshatra", nakshatra)
    .eq("prediction_date", date);
  return count ?? 0;
}

const today = new Date().toISOString().slice(0, 10);
const createdUserIds: string[] = [];
const cacheRowsToCleanup: string[] = []; // nakshatras this run populated fresh — safe to delete after

let failures = 0;
function report(name: string, pass: boolean, detail: string) {
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}\n       ${detail}`);
  if (!pass) failures++;
}

// ─── Test 1: cache correctness (two users, same nakshatra, one API call) ──────

async function testCacheCorrectness() {
  console.log("\n=== Test 1: cache correctness (shared nakshatra, one call/day) ===");

  // A fixed birth date/time/place — nakshatra depends only on this data, so
  // reusing it for two different user accounts guarantees they share a nakshatra.
  const birth: BirthData = { day: 12, month: 3, year: 1994, hour: 9, min: 15, ...NEW_DELHI };
  const { nakshatra } = await probeNakshatra(birth);
  const alreadyCachedBeforeTest = await cacheRowExists(nakshatra, today);

  const userA = await createTestUser("cache-a");
  const userB = await createTestUser("cache-b");
  createdUserIds.push(userA, userB);
  await insertAstroDetails(userA, birth, nakshatra);
  await insertAstroDetails(userB, birth, nakshatra);

  const resA = await callDailyInsights(userA);
  const resB = await callDailyInsights(userB);

  if (!alreadyCachedBeforeTest) cacheRowsToCleanup.push(nakshatra);

  const rowCount = await cacheRowCount(nakshatra, today);

  report(
    "user A and user B share a nakshatra",
    resA.nakshatra === nakshatra && resB.nakshatra === nakshatra,
    `nakshatra=${nakshatra}`
  );
  report(
    "second user's call was served from cache (no 2nd API call)",
    resB.cached === true,
    `resA.cached=${resA.cached}, resB.cached=${resB.cached}`
  );
  report(
    "exactly one cache row exists for (nakshatra, today) after both calls",
    rowCount === 1,
    `row count=${rowCount}`
  );
}

// ─── Test 2: concurrent cache-miss race ────────────────────────────────────────

async function testRaceCondition() {
  console.log("\n=== Test 2: concurrent requests on a cache miss ===");

  // Sweep a few candidate birth dates (nakshatra shifts by ~1/day) until we
  // find one NOT already cached today, so this is a guaranteed cache miss.
  let birth: BirthData | null = null;
  let nakshatra = "";
  for (let dayOffset = 1; dayOffset <= 31; dayOffset++) {
    const candidate: BirthData = { day: dayOffset, month: 1, year: 2000, hour: 6, min: 0, ...NEW_DELHI };
    const probe = await probeNakshatra(candidate);
    if (!(await cacheRowExists(probe.nakshatra, today))) {
      birth = candidate;
      nakshatra = probe.nakshatra;
      break;
    }
  }
  if (!birth) {
    report("found an uncached nakshatra to test against", false, "all 27 already cached today — cannot test a miss");
    return;
  }

  const userId = await createTestUser("race");
  createdUserIds.push(userId);
  await insertAstroDetails(userId, birth, nakshatra);

  const CONCURRENCY = 6;
  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, () => callDailyInsights(userId))
  );
  cacheRowsToCleanup.push(nakshatra);

  const rowCount = await cacheRowCount(nakshatra, today);
  const cacheMisses = results.filter((r) => r.cached === false).length;
  const errors = results.filter((r) => r._httpStatus && r._httpStatus >= 400);

  report(
    "no duplicate cache rows despite concurrent misses (unique constraint holds)",
    rowCount === 1,
    `${CONCURRENCY} concurrent requests -> row count=${rowCount}`
  );
  report(
    "all concurrent requests returned valid data, none errored",
    errors.length === 0,
    errors.length ? `${errors.length}/${CONCURRENCY} errored: ${JSON.stringify(errors[0])}` : "no errors"
  );
  // This is an honest finding, not just a pass/fail: ON CONFLICT DO NOTHING
  // guarantees no duplicate ROWS, but does NOT by itself prevent multiple
  // concurrent requests from each independently reaching the external API
  // before any of them has committed the first insert.
  console.log(
    `       INFO: ${cacheMisses}/${CONCURRENCY} concurrent requests reported cached:false ` +
      `(each such response corresponds to an independent external API call attempted ` +
      `during the race window — the unique constraint prevents duplicate STORAGE, not ` +
      `necessarily duplicate CALLS during the exact concurrent window).`
  );
}

// ─── Test 3: approximate / missing birth data fallback ─────────────────────────

async function testFallback() {
  console.log("\n=== Test 3: approximate / missing birth data ===");

  // 3a — approximate time (a rough default like noon, not a precise birth time)
  const approxBirth: BirthData = { day: 20, month: 6, year: 1990, hour: 12, min: 0, ...NEW_DELHI };
  const { nakshatra: approxNakshatra } = await probeNakshatra(approxBirth);
  const alreadyCached = await cacheRowExists(approxNakshatra, today);
  const userApprox = await createTestUser("approx-time");
  createdUserIds.push(userApprox);
  await insertAstroDetails(userApprox, approxBirth, approxNakshatra);
  if (!alreadyCached) cacheRowsToCleanup.push(approxNakshatra);

  const resApprox = await callDailyInsights(userApprox);
  report(
    "approximate (rough default) birth time still returns a real prediction",
    resApprox._httpStatus === 200 && !!resApprox.prediction,
    `status=${resApprox._httpStatus}, prediction present=${!!resApprox.prediction}`
  );

  // 3b — missing birth data entirely (no astro_details row at all)
  const userMissing = await createTestUser("missing-data");
  createdUserIds.push(userMissing);
  const resMissing = await callDailyInsights(userMissing);
  report(
    "missing birth data fails cleanly (structured 422, not a crash/500)",
    resMissing._httpStatus === 422 && resMissing.error === "incomplete_birth_data",
    `status=${resMissing._httpStatus}, body=${JSON.stringify(resMissing)}`
  );
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

async function cleanup() {
  console.log("\n=== Cleanup ===");
  for (const nakshatra of cacheRowsToCleanup) {
    const { error } = await db
      .from("daily_insights_cache")
      .delete()
      .eq("nakshatra", nakshatra)
      .eq("prediction_date", today);
    console.log(`  removed test-created cache row for ${nakshatra}/${today}${error ? ` (error: ${error.message})` : ""}`);
  }
  for (const userId of createdUserIds) {
    const { error } = await db.auth.admin.deleteUser(userId);
    console.log(`  deleted test user ${userId}${error ? ` (error: ${error.message})` : ""}`);
  }
}

async function main() {
  try {
    await testCacheCorrectness();
    await testRaceCondition();
    await testFallback();
  } finally {
    await cleanup();
  }

  console.log(`\n${failures === 0 ? "ALL TESTS PASSED" : `${failures} TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  cleanup().finally(() => process.exit(1));
});
