import { assertEquals } from "jsr:@std/assert@1";
import {
  computePlanetaryHours,
  cosmicWeatherScore,
  dayRuler,
  luckyAttributes,
  moonPhase,
  pickBestTime,
} from "./daily-insights-helpers.ts";
import type { DailyPrediction } from "./daily-insights-helpers.ts";

Deno.test("dayRuler - maps every weekday to its classical ruling planet", () => {
  // 2026-07-26 is a Sunday (UTC)
  assertEquals(dayRuler(new Date("2026-07-26T12:00:00Z")), "Sun");
  assertEquals(dayRuler(new Date("2026-07-27T12:00:00Z")), "Moon");
  assertEquals(dayRuler(new Date("2026-07-28T12:00:00Z")), "Mars");
  assertEquals(dayRuler(new Date("2026-07-29T12:00:00Z")), "Mercury");
  assertEquals(dayRuler(new Date("2026-07-30T12:00:00Z")), "Jupiter");
  assertEquals(dayRuler(new Date("2026-07-31T12:00:00Z")), "Venus");
  assertEquals(dayRuler(new Date("2026-08-01T12:00:00Z")), "Saturn");
});

Deno.test("moonPhase - the known reference new moon itself is New Moon", () => {
  assertEquals(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14, 0))), "New Moon");
});

Deno.test("moonPhase - a bit past a quarter-cycle later is a quarter phase", () => {
  // 0.30 rather than exactly 0.25 -- comfortably inside the First Quarter
  // band rather than sitting on the boundary, where floating-point rounding
  // in the date arithmetic could tip the bucket either way.
  const pastQuarterMs = 29.53058867 * 0.30 * 86400000;
  const date = new Date(Date.UTC(2000, 0, 6, 18, 14, 0) + pastQuarterMs);
  assertEquals(moonPhase(date), "First Quarter");
});

Deno.test("moonPhase - always returns one of the eight known phase names", () => {
  for (let days = 0; days < 60; days++) {
    const date = new Date(Date.UTC(2000, 0, 6, 18, 14, 0) + days * 86400000);
    const phase = moonPhase(date);
    assertEquals(
      ["New Moon", "Waxing Crescent", "First Quarter", "Waxing Gibbous", "Full Moon", "Waning Gibbous", "Last Quarter", "Waning Crescent"].includes(phase),
      true,
    );
  }
});

Deno.test("luckyAttributes - is deterministic for the same (nakshatra, date)", () => {
  const a = luckyAttributes("Ashwini", "2026-07-28");
  const b = luckyAttributes("Ashwini", "2026-07-28");
  assertEquals(a, b);
});

Deno.test("luckyAttributes - changes across different days for the same nakshatra", () => {
  const day1 = luckyAttributes("Ashwini", "2026-07-28");
  const day2 = luckyAttributes("Ashwini", "2026-07-29");
  // Not strictly guaranteed to differ, but for these two specific inputs it
  // does -- pin it as a regression check on the hash function itself.
  assertEquals(day1.luckyColor !== day2.luckyColor || day1.luckyNumber !== day2.luckyNumber, true);
});

Deno.test("luckyAttributes - always returns a number between 1 and 9", () => {
  for (let i = 0; i < 20; i++) {
    const { luckyNumber } = luckyAttributes(`Nakshatra${i}`, "2026-07-28");
    assertEquals(luckyNumber >= 1 && luckyNumber <= 9, true);
  }
});

function prediction(overrides: Partial<DailyPrediction> = {}): DailyPrediction {
  return {
    health: "",
    emotions: "",
    profession: "",
    luck: "",
    personal_life: "",
    travel: "",
    ...overrides,
  };
}

Deno.test("cosmicWeatherScore - neutral text scores exactly 50", () => {
  assertEquals(cosmicWeatherScore(prediction({ luck: "Nothing notable happens today." })), 50);
});

Deno.test("cosmicWeatherScore - positive words push the score above 50", () => {
  const score = cosmicWeatherScore(prediction({ luck: "A great, favorable day full of joy and success." }));
  assertEquals(score > 50, true);
});

Deno.test("cosmicWeatherScore - caution words pull the score below 50", () => {
  const score = cosmicWeatherScore(prediction({ health: "Avoid risky, stressful conflict and difficult obstacles." }));
  assertEquals(score < 50, true);
});

Deno.test("cosmicWeatherScore - clamps to [0, 100] instead of going out of range", () => {
  const veryPositive = prediction({
    luck: "good great favorable success lucky positive harmony joy happy gains progress improve strong love romance opportunity growth pleasant smooth confidence energetic blessing".repeat(3),
  });
  assertEquals(cosmicWeatherScore(veryPositive), 100);

  const veryNegative = prediction({
    health: "avoid caution careful risk stress trouble delay difficult conflict tension loss unfavorable negative illness worry anxiety obstacle setback argument".repeat(3),
  });
  assertEquals(cosmicWeatherScore(veryNegative), 0);
});

Deno.test("cosmicWeatherScore - matches whole words only, not substrings (e.g. 'lossless' shouldn't count as 'loss')", () => {
  const score = cosmicWeatherScore(prediction({ luck: "A lossless, classy day for embossing your goals." }));
  assertEquals(score, 50);
});

Deno.test("computePlanetaryHours - returns 24 hours covering day + night for a normal latitude", () => {
  const hours = computePlanetaryHours(new Date("2026-07-28T00:00:00Z"), 19.076, 72.8777); // Mumbai
  assertEquals(hours?.length, 24);
});

Deno.test("computePlanetaryHours - hours are in chronological order with no gaps", () => {
  const hours = computePlanetaryHours(new Date("2026-07-28T00:00:00Z"), 19.076, 72.8777)!;
  for (let i = 1; i < hours.length; i++) {
    assertEquals(hours[i].start.getTime(), hours[i - 1].end.getTime());
  }
});

Deno.test("computePlanetaryHours - the first day hour's ruling planet is today's day ruler", () => {
  const date = new Date("2026-07-28T00:00:00Z"); // Tuesday -> Mars
  const hours = computePlanetaryHours(date, 19.076, 72.8777)!;
  assertEquals(hours[0].planet, "Mars");
});

Deno.test("computePlanetaryHours - returns null at a polar latitude during polar night/day", () => {
  // Deep into a polar circle at northern-hemisphere winter solstice-adjacent
  // date -- the sun does not rise, so the underlying sunrise/sunset formula
  // has no solution.
  const hours = computePlanetaryHours(new Date("2026-12-21T00:00:00Z"), 80, 20);
  assertEquals(hours, null);
});

Deno.test("pickBestTime - only ever returns a Venus or Mercury hour", () => {
  const hours = computePlanetaryHours(new Date("2026-07-28T00:00:00Z"), 19.076, 72.8777)!;
  const best = pickBestTime(hours, 72.8777, "Ashwini", "2026-07-28");
  assertEquals(best !== null, true);
  assertEquals(best!.planet === "Venus" || best!.planet === "Mercury", true);
});

Deno.test("pickBestTime - is deterministic for the same inputs", () => {
  const hours = computePlanetaryHours(new Date("2026-07-28T00:00:00Z"), 19.076, 72.8777)!;
  const a = pickBestTime(hours, 72.8777, "Ashwini", "2026-07-28");
  const b = pickBestTime(hours, 72.8777, "Ashwini", "2026-07-28");
  assertEquals(a, b);
});

Deno.test("pickBestTime - returns null when there are no Venus/Mercury hours at all", () => {
  const noVenusOrMercury = [
    { start: new Date(), end: new Date(), planet: "Mars" },
    { start: new Date(), end: new Date(), planet: "Saturn" },
  ];
  assertEquals(pickBestTime(noVenusOrMercury, 0, "Ashwini", "2026-07-28"), null);
});
