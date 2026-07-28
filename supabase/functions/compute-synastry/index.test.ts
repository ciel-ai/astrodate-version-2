import { assertEquals } from "jsr:@std/assert@1";
import { buildBadges, buildSummary, parseDate, parseTime, parseTzNum } from "./index.ts";

Deno.test("parseTzNum - parses UTC+N / UTC-N / bare numeric forms", () => {
  assertEquals(parseTzNum("UTC+5.5"), 5.5);
  assertEquals(parseTzNum("UTC-8"), -8);
  assertEquals(parseTzNum("+5.5"), 5.5);
  assertEquals(parseTzNum("5.5"), 5.5);
  assertEquals(parseTzNum("utc+5.5"), 5.5); // case-insensitive prefix
});

Deno.test("parseTzNum - returns null for missing or unparseable input", () => {
  assertEquals(parseTzNum(null), null);
  assertEquals(parseTzNum(undefined), null);
  assertEquals(parseTzNum(""), null);
  assertEquals(parseTzNum("not-a-timezone"), null);
});

Deno.test("parseDate - splits YYYY-MM-DD into numeric parts", () => {
  assertEquals(parseDate("1995-03-21"), { year: 1995, month: 3, day: 21 });
});

Deno.test("parseTime - splits HH:MM:SS into numeric hour/min", () => {
  assertEquals(parseTime("14:30:00"), { hour: 14, min: 30 });
});

Deno.test("buildSummary - matches each documented score band", () => {
  assertEquals(buildSummary(36, {}).startsWith("Exceptional"), true);
  assertEquals(buildSummary(32, {}).startsWith("Exceptional"), true);
  assertEquals(buildSummary(31, {}).startsWith("Strong"), true);
  assertEquals(buildSummary(27, {}).startsWith("Strong"), true);
  assertEquals(buildSummary(26, {}).startsWith("Good"), true);
  assertEquals(buildSummary(24, {}).startsWith("Good"), true);
  assertEquals(buildSummary(23, {}).startsWith("Compatible"), true);
  assertEquals(buildSummary(18, {}).startsWith("Compatible"), true);
  assertEquals(buildSummary(17, {}).startsWith("Challenging"), true);
  assertEquals(buildSummary(0, {}).startsWith("Challenging"), true);
});

Deno.test("buildBadges - awards Cosmic Soulmates only at the top band, Harmonious Souls just below it", () => {
  assertEquals(buildBadges(32, {}), ["Cosmic Soulmates"]);
  assertEquals(buildBadges(27, {}), ["Harmonious Souls"]);
  assertEquals(buildBadges(26, {}), []);
});

Deno.test("buildBadges - awards Nadi Match at >=8 received points, accepting both raw-number and {received_points} shapes", () => {
  assertEquals(buildBadges(0, { nadi: 8 }).includes("Nadi Match"), true);
  assertEquals(buildBadges(0, { nadi: { received_points: 8 } }).includes("Nadi Match"), true);
  assertEquals(buildBadges(0, { nadi: 7 }).includes("Nadi Match"), false);
});

Deno.test("buildBadges - awards Gana Match at >=6 received points", () => {
  assertEquals(buildBadges(0, { gan: { received_points: 6 } }).includes("Gana Match"), true);
  assertEquals(buildBadges(0, { gan: { received_points: 5 } }).includes("Gana Match"), false);
});

Deno.test("buildBadges - can award multiple badges at once", () => {
  const badges = buildBadges(33, { nadi: { received_points: 8 }, gan: { received_points: 6 } });
  assertEquals(badges.includes("Cosmic Soulmates"), true);
  assertEquals(badges.includes("Nadi Match"), true);
  assertEquals(badges.includes("Gana Match"), true);
});

Deno.test("buildBadges - returns an empty array when nothing qualifies", () => {
  assertEquals(buildBadges(10, {}), []);
});
