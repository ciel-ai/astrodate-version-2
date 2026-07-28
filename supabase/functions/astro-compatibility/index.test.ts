import { assertEquals } from "jsr:@std/assert@1";
import { adaptDetailedReport, buildCompatibilityReport, parseKoota } from "./index.ts";

Deno.test("buildCompatibilityReport - matches each documented score band (0-1 scale)", () => {
  assertEquals(buildCompatibilityReport(1.0).startsWith("An exceptionally"), true);
  assertEquals(buildCompatibilityReport(0.80).startsWith("An exceptionally"), true);
  assertEquals(buildCompatibilityReport(0.79).startsWith("A complementary"), true);
  assertEquals(buildCompatibilityReport(0.70).startsWith("A complementary"), true);
  assertEquals(buildCompatibilityReport(0.69).startsWith("A balanced"), true);
  assertEquals(buildCompatibilityReport(0.55).startsWith("A balanced"), true);
  assertEquals(buildCompatibilityReport(0.54).startsWith("A challenging"), true);
  assertEquals(buildCompatibilityReport(0.40).startsWith("A challenging"), true);
  assertEquals(buildCompatibilityReport(0.39).startsWith("A contrasting"), true);
  assertEquals(buildCompatibilityReport(0).startsWith("A contrasting"), true);
});

Deno.test("parseKoota - coerces every field to its declared type, defaulting missing ones", () => {
  const result = parseKoota({
    description: "Test",
    total_points: "2", // API sometimes returns numeric-looking strings
    received_points: 1.5,
  });
  assertEquals(result, {
    description: "Test",
    male_koot_attribute: "",
    female_koot_attribute: "",
    total_points: 2,
    received_points: 1.5,
    male_point: 0,
    female_point: 0,
  });
});

Deno.test("adaptDetailedReport - maps every koota plus manglik/rajju/vedha/conclusion from the raw API shape", () => {
  const kootaFixture = {
    description: "d", male_koot_attribute: "m", female_koot_attribute: "f",
    total_points: 2, received_points: 2, male_point: 1, female_point: 1,
  };
  const raw = {
    ashtakoota: {
      varna: kootaFixture, vashya: kootaFixture, tara: kootaFixture, yoni: kootaFixture,
      maitri: kootaFixture, gan: kootaFixture, bhakut: kootaFixture, nadi: kootaFixture,
      total: { total_points: 36, received_points: 29.5, minimum_required: 18 },
      conclusion: { status: true, report: "Good match" },
    },
    manglik: { status: false, male_percentage: 0, female_percentage: 10 },
    rajju_dosha: { status: true },
    vedha_dosha: { status: false },
    conclusion: { match_report: "Overall favorable" },
  };

  const adapted = adaptDetailedReport(raw);

  assertEquals(adapted.ashtakoota.nadi, kootaFixture);
  assertEquals(adapted.ashtakoota.total, { total_points: 36, received_points: 29.5, minimum_required: 18 });
  assertEquals(adapted.ashtakoota.conclusion, { status: true, report: "Good match" });
  assertEquals(adapted.manglik, { status: false, male_percentage: 0, female_percentage: 10 });
  assertEquals(adapted.rajju_dosha, { status: true });
  assertEquals(adapted.vedha_dosha, { status: false });
  assertEquals(adapted.conclusion, { match_report: "Overall favorable" });
});

Deno.test("adaptDetailedReport - defaults rajju_dosha/vedha_dosha to {status:false} when the API omits them", () => {
  const kootaFixture = {
    description: "", male_koot_attribute: "", female_koot_attribute: "",
    total_points: 0, received_points: 0, male_point: 0, female_point: 0,
  };
  const raw = {
    ashtakoota: {
      varna: kootaFixture, vashya: kootaFixture, tara: kootaFixture, yoni: kootaFixture,
      maitri: kootaFixture, gan: kootaFixture, bhakut: kootaFixture, nadi: kootaFixture,
      total: {},
      conclusion: {},
    },
    manglik: {},
    conclusion: {},
  };

  const adapted = adaptDetailedReport(raw);
  assertEquals(adapted.rajju_dosha, { status: false });
  assertEquals(adapted.vedha_dosha, { status: false });
  assertEquals(adapted.ashtakoota.total, { total_points: 36, received_points: 0, minimum_required: 18 });
});
