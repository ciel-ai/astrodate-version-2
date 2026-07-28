import { assertEquals } from "jsr:@std/assert@1";
import { timingSafeEqual } from "./index.ts";

Deno.test("timingSafeEqual - equal strings", () => {
  assertEquals(timingSafeEqual("secret123", "secret123"), true);
});

Deno.test("timingSafeEqual - different strings same length", () => {
  assertEquals(timingSafeEqual("secret123", "secret124"), false);
});

Deno.test("timingSafeEqual - different lengths", () => {
  assertEquals(timingSafeEqual("short", "a-much-longer-secret"), false);
});

Deno.test("timingSafeEqual - empty vs empty", () => {
  assertEquals(timingSafeEqual("", ""), true);
});

Deno.test("timingSafeEqual - empty vs non-empty", () => {
  assertEquals(timingSafeEqual("", "x"), false);
});
