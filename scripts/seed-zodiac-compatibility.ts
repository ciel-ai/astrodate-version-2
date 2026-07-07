/**
 * scripts/seed-zodiac-compatibility.ts
 *
 * One-time seed: precomputes all 144 Western zodiac sign-pair compatibility
 * scores via astrologyapi.com's zodiac_compatibility endpoint, and stores
 * them in western_compatibility_cache.
 *
 * SAFE TO RE-RUN: it checks the DB before calling the API for each pair,
 * so a partial run (crash, rate limit, etc.) can just be re-run and it will
 * only fetch whatever's still missing. It will never re-fetch a pair that's
 * already cached, and it will never need to run again after a successful
 * full pass — sign pairs don't change.
 *
 * Run once with: npx tsx scripts/seed-zodiac-compatibility.ts
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (service role, not anon — this writes directly to the table)
 *   ASTROLOGY_API_USER_ID
 *   ASTROLOGY_API_KEY
 */

import { createClient } from "@supabase/supabase-js";

// supabase-js always constructs a realtime client, which requires a global
// WebSocket constructor even though this script never opens a realtime
// subscription (only plain REST select/insert). Node <22 has no native
// WebSocket, so stub one just to satisfy the constructor check.
if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = class {} as unknown as typeof WebSocket;
}

const SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

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

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AUTH = Buffer.from(
  `${process.env.ASTROLOGY_API_USER_ID}:${process.env.ASTROLOGY_API_KEY}`
).toString("base64");

// Small delay between calls to be a polite API citizen — this is a one-time
// script, not a hot path, so there's no reason to hammer the endpoint.
const DELAY_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchCompatibility(signA: string, signB: string) {
  // A live GET call 404'd ("check your api name/url or HTTP method type"),
  // disproving the assumption that this matches astro-compatibility/index.ts's
  // (untested) GET usage of the same endpoint — that code path is dead/ported,
  // never actually exercised. POST is what astrologyapi.com's other endpoints
  // in this codebase use, and what actually works for this endpoint.
  const res = await fetch(
    `https://json.astrologyapi.com/v1/zodiac_compatibility/${signA}/${signB}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${AUTH}`,
        "Content-Type": "application/json",
        "Accept-Language": "en",
      },
      body: JSON.stringify({}),
    }
  );

  if (!res.ok) {
    throw new Error(`API error for ${signA}/${signB}: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();

  // The API's exact field name for the numeric score isn't fully confirmed
  // from public docs at the time this script was written — log the raw
  // response on the first call so you can confirm the field name before
  // trusting the parsed value for the remaining 143 calls.
  return data;
}

function extractPercentage(raw: any): number {
  // Try the most likely field names; fall back loudly rather than silently
  // storing a wrong/zero value.
  const candidate =
    raw.compatibility_percentage ??
    raw.percentage ??
    raw.score ??
    raw.compatibility_score;

  if (typeof candidate !== "number") {
    throw new Error(
      `Could not find a numeric compatibility field in response: ${JSON.stringify(raw)}`
    );
  }
  return candidate;
}

function extractReport(raw: any): string | null {
  return raw.compatibility_report ?? raw.report ?? raw.description ?? null;
}

async function alreadyCached(signA: string, signB: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("western_compatibility_cache")
    .select("sign_a")
    .eq("sign_a", signA)
    .eq("sign_b", signB)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

async function main() {
  let fetched = 0;
  let skipped = 0;
  let loggedSample = false;

  for (const signA of SIGNS) {
    for (const signB of SIGNS) {
      if (await alreadyCached(signA, signB)) {
        skipped++;
        continue;
      }

      const raw = await fetchCompatibility(signA, signB);

      if (!loggedSample) {
        console.log("Sample raw response (verify field names before trusting the rest):");
        console.log(JSON.stringify(raw, null, 2));
        loggedSample = true;
      }

      const percentage = extractPercentage(raw);
      const score45 = Math.round((percentage / 100) * 45 * 100) / 100;

      const { error } = await supabase.from("western_compatibility_cache").insert({
        sign_a: signA,
        sign_b: signB,
        compatibility_percentage: percentage,
        compatibility_score_45: score45,
        compatibility_report: extractReport(raw),
      });

      if (error) {
        // Unique violation just means another run/race already inserted it — fine to skip.
        if (error.code === "23505") {
          skipped++;
        } else {
          throw error;
        }
      } else {
        fetched++;
        console.log(`✓ ${signA} × ${signB}: ${percentage}% → ${score45}/45`);
      }

      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone. Fetched ${fetched} new pairs, skipped ${skipped} already cached.`);
  console.log(`Total should now be 144. Verify with: select count(*) from western_compatibility_cache;`);
}

main().catch((err) => {
  console.error("Seed script failed:", err);
  process.exit(1);
});
