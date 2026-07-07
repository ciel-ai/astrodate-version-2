/**
 * Pure, zero-API-cost helpers for the daily-insights Edge Function. Every
 * function here is a deterministic function of (nakshatra, date) or
 * (date, lat, lon) — nothing here calls the Astrology API or touches the DB,
 * so it's always cheap to recompute per request rather than cache.
 */

export type DailyPrediction = {
  health: string;
  emotions: string;
  profession: string;
  luck: string;
  personal_life: string;
  travel: string;
};

export type PlanetaryHour = {
  start: Date;
  end: Date;
  planet: string;
};

// ─── Day ruler ────────────────────────────────────────────────────────────────

const DAY_RULER_BY_WEEKDAY: Record<number, string> = {
  0: "Sun", // Sunday
  1: "Moon", // Monday
  2: "Mars", // Tuesday
  3: "Mercury", // Wednesday
  4: "Jupiter", // Thursday
  5: "Venus", // Friday
  6: "Saturn", // Saturday
};

/** Fixed weekday->ruling-planet lookup. Uses the UTC weekday of `date`
 * (the same UTC date used as the shared cache key), independent of location. */
export function dayRuler(date: Date): string {
  return DAY_RULER_BY_WEEKDAY[date.getUTCDay()];
}

// ─── Moon phase ───────────────────────────────────────────────────────────────

const SYNODIC_MONTH_DAYS = 29.53058867;
// A known new moon: 2000-01-06 18:14 UTC. Pure date arithmetic from here —
// no ephemeris API needed, accurate enough for a phase *name* (not exact
// illumination percentage).
const KNOWN_NEW_MOON_UTC_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

const MOON_PHASE_NAMES = [
  "New Moon",
  "Waxing Crescent",
  "First Quarter",
  "Waxing Gibbous",
  "Full Moon",
  "Waning Gibbous",
  "Last Quarter",
  "Waning Crescent",
];

export function moonPhase(date: Date): string {
  const daysSinceNew = (date.getTime() - KNOWN_NEW_MOON_UTC_MS) / 86400000;
  const cycles = daysSinceNew / SYNODIC_MONTH_DAYS;
  const fraction = ((cycles % 1) + 1) % 1;
  const index = Math.min(7, Math.floor(fraction * 8));
  return MOON_PHASE_NAMES[index];
}

// ─── Lucky color / number ─────────────────────────────────────────────────────

const LUCKY_COLORS = [
  "Lavender",
  "Coral",
  "Teal",
  "Gold",
  "Rose Pink",
  "Sky Blue",
  "Emerald",
  "Ivory",
  "Amber",
  "Lilac",
  "Turquoise",
  "Crimson",
];

/** Deterministic FNV-1a string hash (32-bit, unsigned). */
function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * There is no external astrological standard for "lucky color/number per
 * nakshatra per day" — this is v1's own arbitrary-but-stable definition, not
 * a citation of any traditional system: a deterministic hash of
 * `nakshatra + date` picks a color from a fixed palette and a 1-9 number.
 * Same (nakshatra, date) always produces the same result; it changes daily.
 */
export function luckyAttributes(
  nakshatra: string,
  dateStr: string
): { luckyColor: string; luckyNumber: number } {
  const hash = fnv1aHash(`${nakshatra}|${dateStr}`);
  const luckyColor = LUCKY_COLORS[hash % LUCKY_COLORS.length];
  const luckyNumber = (Math.floor(hash / LUCKY_COLORS.length) % 9) + 1;
  return { luckyColor, luckyNumber };
}

// ─── Cosmic weather score ──────────────────────────────────────────────────────

const POSITIVE_WORDS = [
  "good", "great", "favorable", "favourable", "success", "successful", "luck",
  "lucky", "positive", "harmony", "joy", "happy", "happiness", "gain", "gains",
  "progress", "improve", "improvement", "strong", "strength", "love", "romance",
  "opportunity", "opportunities", "growth", "pleasant", "smooth", "confidence",
  "energetic", "blessing",
];

const CAUTION_WORDS = [
  "avoid", "caution", "careful", "risk", "risky", "stress", "trouble", "delay",
  "delays", "difficult", "difficulty", "conflict", "tension", "loss", "losses",
  "unfavorable", "unfavourable", "negative", "illness", "worry", "anxious",
  "anxiety", "obstacle", "obstacles", "setback", "argument", "disagreement",
];

function countOccurrences(text: string, words: string[]): number {
  return words.reduce((sum, w) => sum + (text.split(w).length - 1), 0);
}

/**
 * v1 "cosmic weather" score: a keyword-counting pass over the six prediction
 * category texts — NOT real sentiment analysis. Documented placeholder, good
 * enough for a single 0-100 dial in the UI; revisit if it needs to be smarter.
 */
export function cosmicWeatherScore(prediction: DailyPrediction): number {
  const text = Object.values(prediction).join(" ").toLowerCase();
  const positive = countOccurrences(text, POSITIVE_WORDS);
  const caution = countOccurrences(text, CAUTION_WORDS);
  const score = 50 + (positive - caution) * 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// ─── Sunrise/sunset (standard public-domain approximation) ────────────────────

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

const sinDeg = (deg: number) => Math.sin(deg * DEG2RAD);
const cosDeg = (deg: number) => Math.cos(deg * DEG2RAD);
const tanDeg = (deg: number) => Math.tan(deg * DEG2RAD);
const asinDeg = (x: number) => Math.asin(x) * RAD2DEG;
const acosDeg = (x: number) => Math.acos(x) * RAD2DEG;
const atanDeg = (x: number) => Math.atan(x) * RAD2DEG;

function normalizeDegrees(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

function dayOfYearUTC(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  const cur = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((cur - start) / 86400000) + 1;
}

/**
 * Standard sunrise/sunset approximation ("Sunrise/Sunset Algorithm", Almanac
 * for Computers 1990 — widely reused, e.g. edwilliams.org/sunrise_sunset_algorithm.html).
 * Returns the UTC time of day as decimal hours [0,24), or null if the sun
 * doesn't rise/set at this latitude on this date (polar day/night). Accurate
 * to within a few minutes — plenty for a "best time today" UI flourish, not
 * claimed as precision ephemeris.
 */
function sunEventUTCHours(
  date: Date,
  lat: number,
  lon: number,
  isSunrise: boolean
): number | null {
  const N = dayOfYearUTC(date);
  const lngHour = lon / 15;
  const t = isSunrise ? N + (6 - lngHour) / 24 : N + (18 - lngHour) / 24;

  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * sinDeg(M) + 0.02 * sinDeg(2 * M) + 282.634;
  L = normalizeDegrees(L);

  let RA = atanDeg(0.91764 * tanDeg(L));
  RA = normalizeDegrees(RA);
  const lQuadrant = Math.floor(L / 90) * 90;
  const raQuadrant = Math.floor(RA / 90) * 90;
  RA = (RA + (lQuadrant - raQuadrant)) / 15;

  const sinDec = 0.39782 * sinDeg(L);
  const cosDec = cosDeg(asinDeg(sinDec));

  const zenith = 90.833; // official sunrise/sunset (includes refraction + solar disk radius)
  const cosH =
    (cosDeg(zenith) - sinDec * sinDeg(lat)) / (cosDec * cosDeg(lat));
  if (cosH > 1 || cosH < -1) return null; // polar day/night at this lat/date

  let H = isSunrise ? 360 - acosDeg(cosH) : acosDeg(cosH);
  H = H / 15;

  const T = H + RA - 0.06571 * t - 6.622;
  const UT = ((T - lngHour) % 24 + 24) % 24;
  return UT;
}

function utcHoursToDate(date: Date, utcHours: number): Date {
  const base = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(base + utcHours * 3600000);
}

// ─── Planetary hours ───────────────────────────────────────────────────────────

const CHALDEAN_ORDER = ["Saturn", "Jupiter", "Mars", "Sun", "Venus", "Mercury", "Moon"];

/**
 * Splits today (sunrise->sunset->tomorrow's sunrise) into 24 planetary hours
 * (12 day + 12 night, each 1/12 of its half's actual length), cycling through
 * the classical Chaldean order starting from today's day-ruler. Returns null
 * for polar day/night, where "sunrise"/"sunset" aren't well-defined.
 */
export function computePlanetaryHours(
  today: Date,
  lat: number,
  lon: number
): PlanetaryHour[] | null {
  const tomorrow = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1)
  );

  const sunriseUT = sunEventUTCHours(today, lat, lon, true);
  const sunsetUT = sunEventUTCHours(today, lat, lon, false);
  const nextSunriseUT = sunEventUTCHours(tomorrow, lat, lon, true);
  if (sunriseUT === null || sunsetUT === null || nextSunriseUT === null) return null;

  const sunrise = utcHoursToDate(today, sunriseUT);
  const sunset = utcHoursToDate(today, sunsetUT);
  const nextSunrise = utcHoursToDate(tomorrow, nextSunriseUT);

  const startIndex = CHALDEAN_ORDER.indexOf(dayRuler(today));
  const dayLenMs = sunset.getTime() - sunrise.getTime();
  const nightLenMs = nextSunrise.getTime() - sunset.getTime();

  const hours: PlanetaryHour[] = [];
  for (let i = 0; i < 12; i++) {
    hours.push({
      start: new Date(sunrise.getTime() + (dayLenMs / 12) * i),
      end: new Date(sunrise.getTime() + (dayLenMs / 12) * (i + 1)),
      planet: CHALDEAN_ORDER[(startIndex + i) % 7],
    });
  }
  for (let i = 0; i < 12; i++) {
    hours.push({
      start: new Date(sunset.getTime() + (nightLenMs / 12) * i),
      end: new Date(sunset.getTime() + (nightLenMs / 12) * (i + 1)),
      planet: CHALDEAN_ORDER[(startIndex + 12 + i) % 7],
    });
  }
  return hours;
}

/** Longitude-based local-hour approximation (same lon/15 convention already
 * used elsewhere in this codebase, e.g. compute-synastry's timezone fallback). */
function approxLocalHourOfDay(d: Date, lon: number): number {
  const utcHour = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return ((utcHour + lon / 15) % 24 + 24) % 24;
}

/**
 * "Best time today" heuristic: the first Venus- or Mercury-ruled hour
 * (romance / communication) at or after 4pm local, falling back to the first
 * such hour anywhere in the day. This is a deliberate app-specific heuristic
 * for a dating app, not astrological canon.
 */
export function pickBestTime(
  hours: PlanetaryHour[],
  lon: number
): PlanetaryHour | null {
  const candidates = hours.filter((h) => h.planet === "Venus" || h.planet === "Mercury");
  if (candidates.length === 0) return null;
  const evening = candidates.find((h) => approxLocalHourOfDay(h.start, lon) >= 16);
  return evening ?? candidates[0];
}
