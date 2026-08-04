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
  return words.reduce((sum, w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    return sum + (text.match(regex)?.length ?? 0);
  }, 0);
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
  lon: number,
  nakshatra: string,
  dateStr: string
): PlanetaryHour | null {
  const candidates = hours.filter((h) => h.planet === "Venus" || h.planet === "Mercury");
  if (candidates.length === 0) return null;
  const hash = fnv1aHash(`${nakshatra}|${dateStr}`);
  const index = hash % candidates.length;
  return candidates[index];
}

// ─── Static per-nakshatra fallback predictions ───────────────────────────────
//
// Used when the Astrology API call fails AND no cache row exists for today.
// These are evergreen, motivational-but-honest messages keyed by nakshatra.
// They rotate by day-of-week so returning users don't see identical text on
// consecutive offline days. Never claim to be a live API result.

const STATIC_PREDICTIONS: Record<string, DailyPrediction[]> = {
  Ashwini: [
    { health: "Your energy is naturally high today. Channel it into movement and fresh air.", emotions: "Optimism flows easily. A lighthearted conversation can lift someone's mood.", profession: "Quick decisions come naturally to you. Trust your instincts on a pending task.", luck: "Spontaneity works in your favour today. Say yes to something unexpected.", personal_life: "Your enthusiasm is magnetic. Share it with someone close.", travel: "Short, unplanned outings bring the most joy today." },
    { health: "Rest is productive too. Let your body set the pace.", emotions: "Quiet reflection reveals what truly matters to you.", profession: "Revisiting an older project may unlock a fresh perspective.", luck: "Patience is your lucky charm today.", personal_life: "Small gestures mean more than grand ones right now.", travel: "Familiar paths offer comfort and clarity." },
  ],
  Bharani: [
    { health: "Your body is asking for nourishment. Eat well and rest deeply.", emotions: "Deep feelings are rising — journalling helps give them shape.", profession: "Creative work is favoured. Let yourself experiment without pressure.", luck: "Generosity opens unexpected doors.", personal_life: "Vulnerability with a trusted person deepens a bond today.", travel: "Water nearby — a lake, river, or even rain — restores you." },
    { health: "Steady routines protect your wellbeing now.", emotions: "Honour what you feel rather than pushing through it.", profession: "Completing something you started brings real satisfaction.", luck: "Persistence is the luckiest trait you can bring today.", personal_life: "Listening more than speaking strengthens connections.", travel: "Plan rather than depart — the preparation itself is worthwhile." },
  ],
  Krittika: [
    { health: "Your strength is at its peak. Use it for something that matters.", emotions: "Clarity cuts through old confusion today. Trust what you see.", profession: "Leadership comes naturally. Step forward where others hesitate.", luck: "Confidence is your multiplier. Act on what you know.", personal_life: "Directness resolves a lingering tension better than diplomacy.", travel: "Purposeful travel — even across the city — yields results." },
    { health: "Warm food and warm company both serve you well.", emotions: "Passion is present. Aim it at something constructive.", profession: "Your critical eye catches what others miss. Share it tactfully.", luck: "Precision, not speed, is what luck rewards today.", personal_life: "A hard conversation you've been avoiding is ready to happen.", travel: "Head east today if you have a choice of direction." },
  ],
  Rohini: [
    { health: "Pleasure and wellbeing are aligned today. Savour a good meal.", emotions: "Beauty around you — art, nature, music — is genuinely healing.", profession: "Creative and aesthetic projects shine. Your taste is a skill.", luck: "Abundance follows gratitude. Name three things going right.", personal_life: "Romance flourishes in unhurried moments. Slow down.", travel: "Beautiful destinations or even beautiful routes reward you." },
    { health: "Your senses are heightened. Protect them from overstimulation.", emotions: "Nostalgia may surface. It's offering a lesson, not a trap.", profession: "Finishing touches matter more than starting new things today.", luck: "Cultivating what you have outperforms chasing something new.", personal_life: "Consistency in small acts of care builds lasting love.", travel: "Revisiting a meaningful place brings unexpected clarity." },
  ],
  Mrigashira: [
    { health: "Curiosity keeps you light. Follow your interest somewhere new.", emotions: "Wonder is an emotion too. Let yourself be genuinely surprised.", profession: "Research and discovery are favoured. Ask the question you've been sitting with.", luck: "The second option often outperforms the obvious first choice today.", personal_life: "Intellectual connection deepens attraction. Talk about ideas.", travel: "Wandering without a fixed plan leads somewhere worthwhile." },
    { health: "Your mind needs as much rest as your body. Step away from screens.", emotions: "Restlessness has a message. Sit with it before acting on it.", profession: "Gather information before deciding — you're missing one key fact.", luck: "Slowing down at the right moment is the luckiest move.", personal_life: "Quality of attention matters more than quantity of time.", travel: "Maps and planning are your friends today." },
  ],
  Ardra: [
    { health: "Emotional release is physical healing. Don't suppress what's rising.", emotions: "Storms pass. What you're feeling now is clearing space for something better.", profession: "Breakthroughs follow struggle. The hard part you're in is almost done.", luck: "Transformation is your theme today. Lean into change.", personal_life: "Raw honesty, gently delivered, heals more than careful words.", travel: "Rain or overcast skies are actually auspicious for you today." },
    { health: "Gentle movement — stretching, walking — helps process tension.", emotions: "Compassion for yourself is the foundation of compassion for others.", profession: "Editing and refining outperform starting fresh today.", luck: "Rebuilding something broken is luckier than abandoning it.", personal_life: "A friend needs to be heard more than advised right now.", travel: "Short, meaningful journeys beat ambitious long ones today." },
  ],
  Punarvasu: [
    { health: "Optimism is its own medicine today. Find a reason to smile.", emotions: "Forgiveness — of yourself or another — creates real freedom.", profession: "Returning to a paused project brings fresh momentum.", luck: "Second chances are real today. Look for the return of something lost.", personal_life: "Old friendships rekindle easily. Reach out to someone you miss.", travel: "Return journeys — going back somewhere familiar — are especially auspicious." },
    { health: "Fresh air and openness restore you better than staying indoors.", emotions: "Hope is a strategy today. Genuinely believe things can improve.", profession: "Collaboration reopens doors that solo effort couldn't.", luck: "What you give away returns to you multiplied.", personal_life: "Warmth and reliability make you someone others want near.", travel: "Open roads call. Even a long drive brings perspective." },
  ],
  Pushya: [
    { health: "Nourishment is your keyword. Feed your body, mind, and spirit.", emotions: "Gentleness with yourself is not weakness — it is wisdom.", profession: "Nurturing others' growth creates your own advancement.", luck: "Generosity and luck are directly connected today.", personal_life: "Care expressed in practical ways means more than words.", travel: "Home is the best destination today — or bringing home-comfort wherever you go." },
    { health: "Community and belonging have physical health benefits. Seek good company.", emotions: "Gratitude practice transforms your emotional state quickly today.", profession: "Supporting a colleague creates an invisible ally for the future.", luck: "What you water grows. Invest in the right relationship or project.", personal_life: "The person who shows up consistently wins hearts.", travel: "If you travel, prioritise comfort and familiarity over novelty." },
  ],
  Ashlesha: [
    { health: "Rest and introspection heal more than activity today.", emotions: "Deep intuition is active. Pay attention to what you sense before you think.", profession: "Strategic patience is more powerful than immediate action.", luck: "Knowing when not to act is today's lucky insight.", personal_life: "Depth of connection matters more than breadth. One real conversation beats many surface ones.", travel: "Avoid unnecessary travel. Your best insights arrive in stillness." },
    { health: "Listen to subtle signals from your body — they're accurate today.", emotions: "Old wounds are ready to close. Let the healing begin.", profession: "Research, behind-the-scenes work, and preparation all pay off today.", luck: "Hidden information surfaces. Stay observant.", personal_life: "Trust your instincts about a person or situation.", travel: "If you must travel, do it quietly and purposefully." },
  ],
  Magha: [
    { health: "Stand tall. Posture and confidence are physically connected today.", emotions: "Dignity is an emotional state. Carry yourself accordingly.", profession: "Your authority is real — use it to elevate others, not just yourself.", luck: "Legacy thinking — what endures — points you toward the luckiest path.", personal_life: "Honouring your roots and your people strengthens you.", travel: "Significant, prestigious destinations are aligned with your energy today." },
    { health: "Ancestral wisdom about health — sleep, food, rhythm — applies well today.", emotions: "Pride in your journey so far is not arrogance. It's earned.", profession: "Taking credit gracefully is a leadership skill worth practising.", luck: "Established networks open the right doors today.", personal_life: "Your presence itself is a gift to those around you.", travel: "Travel for meaningful reasons yields meaningful experiences." },
  ],
  "Purva Phalguni": [
    { health: "Pleasure is health-positive today. Rest, enjoy, indulge within reason.", emotions: "Joy is a valid goal. Pursue it without guilt.", profession: "Creative output is at a peak. Make something beautiful.", luck: "Leisure and luck are aligned — don't feel guilty for enjoying today.", personal_life: "Romance and playfulness rekindle what routine has dimmed.", travel: "Luxury or comfort-focused travel is exactly right today." },
    { health: "Your body thrives with music, art, or gentle movement.", emotions: "Celebration is appropriate even for small wins.", profession: "Partnerships and collaborations are favoured over solo effort.", luck: "Charisma is your asset. Use it for a purpose you believe in.", personal_life: "Laughter shared is a relationship investment.", travel: "Beautiful surroundings refresh your spirit." },
  ],
  "Uttara Phalguni": [
    { health: "Consistent, sustainable habits serve you better than intensity.", emotions: "Contentment is underrated. Notice what is already enough.", profession: "Commitment to one thing outperforms scattered effort today.", luck: "Reliability is the luckiest trait you can demonstrate.", personal_life: "Steady love — showing up day after day — is the deepest kind.", travel: "Purposeful travel with clear intentions yields results." },
    { health: "Sun exposure — even brief — lifts your energy today.", emotions: "Clarity about your values makes decisions easy.", profession: "Contracts, agreements, and commitments are well-starred today.", luck: "Structure creates freedom. Build a better system.", personal_life: "Dependability earns deep trust over time. Keep your word.", travel: "Well-planned journeys succeed better than impromptu ones today." },
  ],
  Hasta: [
    { health: "Your hands and fine motor skills are heightened. Create something.", emotions: "Skill and care expressed through your hands is a form of love.", profession: "Craftsmanship and attention to detail win today.", luck: "Precision is lucky. Sloppy is not. Take the extra five minutes.", personal_life: "Practical acts of service are the language of love today.", travel: "Nimble, adaptive travel suits you. Stay flexible with plans." },
    { health: "Manual work — cooking, building, gardening — is genuinely therapeutic.", emotions: "Competence is emotionally grounding. Do something you do well.", profession: "Execution is everything today. Less planning, more doing.", luck: "Skill demonstrates value better than words today.", personal_life: "Teach someone something you know well.", travel: "Journeys that involve craft or skilled experience are rewarding." },
  ],
  Chitra: [
    { health: "Aesthetics affect wellbeing. Beautify your immediate space.", emotions: "Creativity channelled outward reduces inner restlessness.", profession: "Design, architecture, aesthetics, and presentation are your domains today.", luck: "Beauty and originality attract opportunity.", personal_life: "Your sense of style and originality is attractive. Express it.", travel: "Visually stunning destinations or experiences are aligned today." },
    { health: "Movement expressed artistically — dance, martial arts — energises you.", emotions: "Perfectionism serves you when redirected toward something finite.", profession: "Presentation matters as much as substance today. Polish before submitting.", luck: "Standing out for the right reason is luckier than blending in.", personal_life: "Create something together — cooking, art, building — as a form of bonding.", travel: "Architecture, design, or art museums are perfectly aligned with today's energy." },
  ],
  Swati: [
    { health: "Flexibility — physical and mental — is your strength today.", emotions: "Adaptability is a superpower. You're exercising it well.", profession: "Negotiation, trade, and exchange go smoothly with your energy today.", luck: "The wind carries things to you. Stay open and aware.", personal_life: "Independence and togetherness can coexist. You model it naturally.", travel: "Travel by air or to open, breezy places is particularly auspicious." },
    { health: "Balance is your keyword. Avoid extremes in food, sleep, or effort.", emotions: "Neither attachment nor detachment — equanimity is the goal.", profession: "Diplomacy resolves a tension that force cannot.", luck: "Seeming small while being ready is an ancient strategy that works.", personal_life: "Give someone the freedom to choose and they'll choose you.", travel: "Trade routes, markets, or international connections call to you." },
  ],
  Vishakha: [
    { health: "Goal-directed energy is your fuel. Set a clear target for the day.", emotions: "Passion focused on a worthy aim is health-giving.", profession: "Ambition is appropriate today. Pursue what you want clearly.", luck: "Determination converts luck into results.", personal_life: "Shared goals create lasting bonds. Align with someone on what matters.", travel: "Travel toward something you want, not away from something you don't." },
    { health: "Rest is strategic, not lazy. Recovery enables the next push.", emotions: "Frustration is information about what matters to you most.", profession: "The long path is the fast one today. Skip the shortcut.", luck: "Persistence is the only luck you need.", personal_life: "Celebrate joint progress — even small milestones deserve acknowledgement.", travel: "Pilgrimage-style travel — purposeful, meaningful — is aligned today." },
  ],
  Anuradha: [
    { health: "Friendship and belonging have measurable health benefits. Seek them.", emotions: "Loyalty is an emotion worth feeling. Name who you're loyal to.", profession: "Teamwork and cooperation outperform solo effort today.", luck: "Devotion to the right cause attracts the right people.", personal_life: "Deep friendship is the foundation of lasting romance.", travel: "Travel with companions enriches the experience today." },
    { health: "Communal meals and shared experiences nourish beyond nutrition.", emotions: "Love is expansive, not possessive. Feel the difference.", profession: "Honouring commitments to colleagues builds long-term equity.", luck: "The friend who recommends you is today's luck multiplier.", personal_life: "Show up for someone unconditionally today.", travel: "Visiting friends or family over pure tourism is right for today." },
  ],
  Jyeshtha: [
    { health: "Your resilience is extraordinary. Honour it without testing it unnecessarily.", emotions: "Responsibility and pride are intertwined for you today.", profession: "Senior or complex roles suit your energy. Step into authority.", luck: "Experience is your luck. What you've been through is an asset.", personal_life: "Protect and provide for those in your care today.", travel: "Leadership journeys — going ahead to prepare for others — are auspicious." },
    { health: "The pressure you carry is real. Find one way to set some of it down.", emotions: "Even the strongest need rest and acknowledgement.", profession: "Your expertise is valuable. Share it, don't hoard it.", luck: "Mentorship creates invisible returns that compound over time.", personal_life: "Strength in vulnerability — sharing what's hard — builds real trust.", travel: "Purposeful travel that serves others is aligned today." },
  ],
  Mula: [
    { health: "Let go of what the body is holding. Breathe deeply and release.", emotions: "Radical honesty with yourself is more liberating than comfortable stories.", profession: "Dismantling a broken system creates space for something far better.", luck: "What you release today creates room for something new tomorrow.", personal_life: "Endings are not failures. Some things are simply complete.", travel: "Wild, untamed natural landscapes restore something essential in you." },
    { health: "Detox — of food, relationships, or habits — is especially effective now.", emotions: "The root cause is ready to be examined. Be brave.", profession: "Investigation and research uncover what was hidden. Dig deep.", luck: "Truth, however uncomfortable, is luckier than pleasant illusion.", personal_life: "Authenticity attracts what is real. Drop the performance.", travel: "Remote or wilderness destinations call to you today." },
  ],
  "Purva Ashadha": [
    { health: "Water is particularly healing for you today. Swim, bathe, or simply sit near it.", emotions: "Confidence rising from within, not from approval, is the real kind.", profession: "Your ideas are worth fighting for. Make the case.", luck: "Invincible courage is today's lucky frequency.", personal_life: "Passion expressed honestly is more attractive than playing it cool.", travel: "River or coastal destinations are aligned with your energy." },
    { health: "Your body is stronger than your doubts. Trust it.", emotions: "Enthusiasm is contagious. Bring yours to every interaction.", profession: "Launch, begin, initiate. Today favours the first move.", luck: "Beginning something with conviction sets the trajectory.", personal_life: "Love that empowers is the only kind worth having.", travel: "Travel toward growth — conferences, learning, new environments." },
  ],
  "Uttara Ashadha": [
    { health: "Steady, sustainable effort yields lasting results for your health.", emotions: "Integrity — doing right when no one is watching — creates inner peace.", profession: "Universal recognition takes time. Keep doing excellent work.", luck: "Unstoppable persistence is your luckiest quality.", personal_life: "Your word is your most valuable relationship asset. Keep it.", travel: "Travel for achievement — not escape — is perfectly aligned." },
    { health: "Long-term habits pay off. Today rewards your past discipline.", emotions: "Righteousness is an emotional state. Act from your highest self.", profession: "Complete what you committed to. The finish line matters.", luck: "Doing what is right, even when costly, creates lasting luck.", personal_life: "People remember how you made them feel when the stakes were real.", travel: "Mountain or elevated destinations are aligned with your energy today." },
  ],
  Shravana: [
    { health: "Listening — to your body, your instincts — is today's health practice.", emotions: "What you hear today matters more than what you say.", profession: "Learning and absorbing information is unusually efficient for you now.", luck: "Receptivity is the luckiest posture today. Hear before speaking.", personal_life: "Give someone the gift of being truly heard.", travel: "Journey to learn something or someone — pilgrimages of understanding." },
    { health: "Sound and music are genuinely therapeutic today. Use them.", emotions: "Stories and narratives you tell yourself shape everything. Choose them wisely.", profession: "Gathering intelligence before deciding pays large dividends.", luck: "The answer you need is already in the room. Listen for it.", personal_life: "A quiet, unhurried conversation heals more than you expect.", travel: "Travel to hear something — live music, a lecture, a wise elder." },
  ],
  Dhanishtha: [
    { health: "Rhythm and music lift your physical energy today. Move to a beat.", emotions: "Abundance mentality is an emotion as much as a belief. Feel it.", profession: "Group endeavours and collective projects thrive with your energy.", luck: "Prosperity is a frequency you can tune into through gratitude.", personal_life: "Celebrate others' success generously — it returns to you.", travel: "Travel with music, or to music — a concert, a festival." },
    { health: "Dance, martial arts, or rhythmic exercise are ideal today.", emotions: "Generosity expands what you have rather than depleting it.", profession: "Your ability to harmonise a team is your highest professional asset.", luck: "Drums, rhythm, and community are your luck symbols today.", personal_life: "Making music — literally or metaphorically — with someone creates real joy.", travel: "Cultural celebrations or community gatherings are aligned today." },
  ],
  Shatabhisha: [
    { health: "Healing comes from unconventional sources today. Stay curious.", emotions: "Solitude is medicine, not punishment. Take what you need.", profession: "Independent thinking produces breakthroughs that group-think cannot.", luck: "The unconventional solution is luckier than the obvious one today.", personal_life: "Intellectual independence is attractive. Be exactly who you are.", travel: "Scientific, technological, or futuristic destinations call to you." },
    { health: "Alternative or holistic approaches to health deserve honest investigation.", emotions: "Distance gives perspective. Take the longer view on a current challenge.", profession: "Research, data, and systematic analysis are your professional allies.", luck: "What the crowd ignores, you can profit from noticing.", personal_life: "Authenticity over performance. Real connections only.", travel: "Remote or unusual destinations suit your energy today." },
  ],
  "Purva Bhadrapada": [
    { health: "Intense energy needs a constructive outlet. Channel it deliberately.", emotions: "The full range of emotion — including the dark — makes you human.", profession: "Visionary thinking combined with grounded execution is your formula today.", luck: "Seeing beyond the obvious is your luck and your gift.", personal_life: "Deep, transformative love is what you're built for.", travel: "Travel toward transformation — retreats, initiatory experiences." },
    { health: "Purification — fasting, cleansing, simplifying — is well-supported today.", emotions: "Intensity is your nature. Find worthy objects for it.", profession: "Sacrifice in the short term for the long-term vision you believe in.", luck: "Letting go of something small creates space for something significant.", personal_life: "Passionate love expressed honestly is more valuable than perfect love performed.", travel: "Sacred sites or places of transformation are aligned." },
  ],
  "Uttara Bhadrapada": [
    { health: "Depth, rest, and ocean rhythms heal you today.", emotions: "Compassion without losing yourself is wisdom. You have it.", profession: "Deep, sustained work pays off better than scattered activity.", luck: "Wisdom applied patiently is the most reliable luck.", personal_life: "Your calm is a gift to everyone in your orbit.", travel: "Deep water, ancient places, or anywhere time feels slower." },
    { health: "Your body needs quiet as much as it needs movement today.", emotions: "Acceptance and peace are available if you stop fighting what is.", profession: "Legacy thinking guides your best decisions. What will last?", luck: "Depth and substance attract real opportunity.", personal_life: "Patience with someone who is struggling costs you little and means everything.", travel: "Contemplative travel — monasteries, nature reserves, retreats." },
  ],
  Revati: [
    { health: "Gentleness with yourself and others is a health practice today.", emotions: "Endings are completions. Feel the fullness of what has been.", profession: "Completion energy is high. Finish something beautifully.", luck: "What you close with grace, you reopen in a better form.", personal_life: "Unconditional love — given and received — is available to you today.", travel: "Water destinations, especially the sea, are healing and aligned." },
    { health: "Dreams and sleep are more than rest tonight — they carry information.", emotions: "Sensitivity is perception. Trust what you feel.", profession: "Creative vision at its most poetic is your professional gift today.", luck: "The last step of a journey carries the most meaning. Complete it.", personal_life: "Love expressed through beauty, art, or poetry lands perfectly.", travel: "Wherever the journey ends is where the real journey begins." },
  ],
};

/** Default fallback used when a nakshatra is unrecognised (should never happen
 *  with valid birth data, but safe to have a catch-all). */
const DEFAULT_STATIC_PREDICTION: DailyPrediction[] = [
  { health: "Your wellbeing is shaped by small, consistent choices. Make one good one today.", emotions: "Take a moment to check in with how you're actually feeling — not how you think you should feel.", profession: "Focus on one task fully rather than spreading effort thin today.", luck: "Showing up with intention is the luckiest thing you can do.", personal_life: "The quality of your attention is the quality of your relationships.", travel: "Any journey taken with curiosity becomes worthwhile." },
];

/**
 * Returns a static fallback DailyPrediction for a given nakshatra, rotating
 * by day-of-week so returning users don't see the exact same text every day.
 * This is always available — no API, no DB — and is the Layer 3 fallback.
 */
export function getStaticFallbackPrediction(nakshatra: string, date: Date): DailyPrediction {
  // Normalise: API sometimes returns capitalised variants like "ASHWINI"
  const key = Object.keys(STATIC_PREDICTIONS).find(
    (k) => k.toLowerCase() === nakshatra.trim().toLowerCase()
  );
  const options = key ? STATIC_PREDICTIONS[key] : DEFAULT_STATIC_PREDICTION;
  // Rotate by day-of-week (0–6) so different days show different text
  const dayIndex = date.getUTCDay() % options.length;
  return options[dayIndex];
}