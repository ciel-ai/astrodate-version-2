/**
 * daily-insights Edge Function
 *
 * Returns today's nakshatra-based daily forecast for the calling user, plus a
 * handful of zero-API-cost extras (moon phase, day ruler, lucky color/number,
 * cosmic weather score, best-time-today).
 *
 * BUDGET-CRITICAL: the Astrology API's daily_nakshatra_prediction endpoint
 * must never be called once per user per open. This function looks up the
 * CALLER's own already-known nakshatra (astro_details.nakshatra_name, set at
 * onboarding), checks daily_insights_cache for (nakshatra, today), and only
 * calls the external API on a miss — capping it at ~27 calls/day (one per
 * possible nakshatra) regardless of user count. A UNIQUE(nakshatra,
 * prediction_date) constraint + upsert ignoreDuplicates makes concurrent
 * misses for the same nakshatra safe without a duplicate external call.
 *
 * Required Edge Function secrets:
 *   ASTROLOGY_API_USER_ID
 *   ASTROLOGY_API_KEY
 *
 * Request body: { user_id: string }
 * Trust model matches compute-synastry: requires an Authorization header,
 * trusts user_id in the body, uses the service role for all DB access.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  computePlanetaryHours,
  cosmicWeatherScore,
  dayRuler,
  luckyAttributes,
  moonPhase,
  pickBestTime,
} from "../_shared/daily-insights-helpers.ts";
import type { DailyPrediction } from "../_shared/daily-insights-helpers.ts";

const ASTRO_BASE = "https://json.astrologyapi.com/v1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Parse "UTC+5.5", "+5.5", "5.5" -> numeric offset, or null if unparseable. */
function parseTzNum(tz: string | null | undefined): number | null {
  if (!tz) return null;
  const n = parseFloat(tz.replace(/^UTC/i, ""));
  return isFinite(n) ? n : null;
}

/** Parse "YYYY-MM-DD" -> { year, month, day } */
function parseDate(s: string): { year: number; month: number; day: number } {
  const [year, month, day] = s.split("-").map(Number);
  return { year, month, day };
}

/** Parse "HH:MM:SS" -> { hour, min } */
function parseTime(s: string): { hour: number; min: number } {
  const [hour, min] = s.split(":").map(Number);
  return { hour, min };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const astroUserId = Deno.env.get("ASTROLOGY_API_USER_ID");
  const astroApiKey = Deno.env.get("ASTROLOGY_API_KEY");

  if (!supabaseUrl || !serviceKey || !astroUserId || !astroApiKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { user_id } = body;
  if (!user_id) {
    return json({ error: "user_id is required" }, 400);
  }

  const { data: astroRec } = await db
    .from("astro_details")
    .select("nakshatra_name, birth_date, birth_time, birth_latitude, birth_longitude, birth_timezone")
    .eq("user_id", user_id)
    .maybeSingle();

  if (
    !astroRec ||
    !astroRec.nakshatra_name ||
    !astroRec.birth_date ||
    !astroRec.birth_time ||
    astroRec.birth_latitude == null ||
    astroRec.birth_longitude == null
  ) {
    return json({ error: "incomplete_birth_data" }, 422);
  }

  const nakshatra: string = astroRec.nakshatra_name;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  let moonSign: string | null = null;
  let moonNakshatra: string | null = null;
  let prediction: DailyPrediction | null = null;
  let cached = false;

  const { data: cacheRow } = await db
    .from("daily_insights_cache")
    .select("moon_sign, moon_nakshatra, prediction")
    .eq("nakshatra", nakshatra)
    .eq("prediction_date", todayStr)
    .maybeSingle();

  if (cacheRow) {
    moonSign = cacheRow.moon_sign;
    moonNakshatra = cacheRow.moon_nakshatra;
    prediction = cacheRow.prediction as DailyPrediction;
    cached = true;
  } else {
    const astroAuth = "Basic " + btoa(astroUserId + ":" + astroApiKey);
    const astroHeaders = {
      Authorization: astroAuth,
      "Content-Type": "application/json",
      "Accept-Language": "en",
    };

    const { day, month, year } = parseDate(astroRec.birth_date);
    const { hour, min } = parseTime(astroRec.birth_time);
    const lat = astroRec.birth_latitude;
    const lon = astroRec.birth_longitude;
    const tzone = parseTzNum(astroRec.birth_timezone) ?? Math.round(lon / 15);

    const res = await fetch(`${ASTRO_BASE}/daily_nakshatra_prediction`, {
      method: "POST",
      headers: astroHeaders,
      body: JSON.stringify({ day, month, year, hour, min, lat, lon, tzone }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error("[daily-insights] daily_nakshatra_prediction error", res.status, errBody);
      return json({ error: "astrology_api_error", status: res.status }, 502);
    }

    const data = await res.json();
    moonSign = data.birth_moon_sign ?? null;
    moonNakshatra = data.birth_moon_nakshatra ?? null;
    prediction = data.prediction as DailyPrediction;

    // ON CONFLICT DO NOTHING: if a concurrent request for this same nakshatra
    // already won the race, that's fine — the content is the same for a given
    // (nakshatra, date) regardless of whose birth data triggered the call.
    const { error: upsertError } = await db.from("daily_insights_cache").upsert(
      {
        nakshatra,
        prediction_date: todayStr,
        moon_sign: moonSign,
        moon_nakshatra: moonNakshatra,
        prediction,
      },
      { onConflict: "nakshatra,prediction_date", ignoreDuplicates: true }
    );

    if (upsertError) {
      console.error("[daily-insights] cache upsert failed", upsertError);
    }
  }

  // ── Zero-API-cost extras — always recomputed, never cached ────────────────
  const moon_phase = moonPhase(today);
  const day_ruler = dayRuler(today);
  const { luckyColor, luckyNumber } = luckyAttributes(nakshatra, todayStr);
  const cosmic_weather_score = prediction ? cosmicWeatherScore(prediction) : null;

  let best_time: { start: string; end: string; ruling_planet: string } | null = null;
  let best_time_status: "ready" | "no_location" | "polar" = "no_location";

  const { data: point } = await db.rpc("get_current_point_for_user", {
    p_user_id: user_id,
  });
  const currentPoint = Array.isArray(point) ? point[0] : point;

  if (currentPoint?.lat != null && currentPoint?.lon != null) {
    const hours = computePlanetaryHours(today, currentPoint.lat, currentPoint.lon);
    if (hours) {
      const best = pickBestTime(hours, currentPoint.lon, nakshatra, todayStr);
      if (best) {
        best_time = {
          start: best.start.toISOString(),
          end: best.end.toISOString(),
          ruling_planet: best.planet,
        };
        best_time_status = "ready";
      }
    } else {
      best_time_status = "polar";
    }
  }

  return json({
    nakshatra,
    moon_sign: moonSign,
    moon_nakshatra: moonNakshatra,
    prediction_date: todayStr,
    prediction,
    cached,
    moon_phase,
    day_ruler,
    lucky_color: luckyColor,
    lucky_number: luckyNumber,
    cosmic_weather_score,
    best_time,
    best_time_status,
  });
});
