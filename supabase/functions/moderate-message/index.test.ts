import { assertEquals } from "jsr:@std/assert@1";
import { classifyMessage } from "./index.ts";

function fakeServiceClient(insertSpy?: (table: string, row: unknown) => void) {
  return {
    from(table: string) {
      return {
        insert: (row: unknown) => {
          insertSpy?.(table, row);
          return Promise.resolve({ error: null });
        },
      };
    },
  };
}

function withEnv(key: string, value: string | undefined, fn: () => Promise<void>) {
  const original = Deno.env.get(key);
  if (value === undefined) Deno.env.delete(key);
  else Deno.env.set(key, value);
  return fn().finally(() => {
    if (original === undefined) Deno.env.delete(key);
    else Deno.env.set(key, original);
  });
}

function withFetch(impl: typeof fetch, fn: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => {
    globalThis.fetch = original;
  });
}

function geminiResponse(text: string): Response {
  return new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200 },
  );
}

Deno.test("classifyMessage - empty/whitespace-only text is SAFE without calling Gemini at all", async () => {
  await withFetch(
    () => {
      throw new Error("fetch should not have been called for empty text");
    },
    async () => {
      const result = await classifyMessage(fakeServiceClient(), "   ");
      assertEquals(result.status, "SAFE");
    },
  );
});

Deno.test("classifyMessage - fails open to SAFE with a warning when GEMINI_API_KEY is missing", async () => {
  await withEnv("GEMINI_API_KEY", undefined, async () => {
    const result = await classifyMessage(fakeServiceClient(), "hello there");
    assertEquals(result.status, "SAFE");
    assertEquals(result.warning, "Moderation service unavailable");
  });
});

Deno.test("classifyMessage - logs a moderation_outages row when the API key is missing", async () => {
  const inserts: Array<{ table: string; row: unknown }> = [];
  await withEnv("GEMINI_API_KEY", undefined, async () => {
    await classifyMessage(
      fakeServiceClient((table, row) => inserts.push({ table, row })),
      "hello there",
    );
  });
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].table, "moderation_outages");
});

Deno.test("classifyMessage - passes through a valid classification from Gemini", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(geminiResponse("HARASSMENT")),
      async () => {
        const result = await classifyMessage(fakeServiceClient(), "you are worthless");
        assertEquals(result.status, "HARASSMENT");
      },
    );
  });
});

Deno.test("classifyMessage - falls back to SAFE when Gemini returns something outside the known categories", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(geminiResponse("UNSURE_MAYBE_SPAM")),
      async () => {
        const result = await classifyMessage(fakeServiceClient(), "buy my course");
        assertEquals(result.status, "SAFE");
      },
    );
  });
});

Deno.test("classifyMessage - fails open to SAFE (with warning) on a non-OK Gemini response", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(new Response("upstream error", { status: 500 })),
      async () => {
        const result = await classifyMessage(fakeServiceClient(), "hello");
        assertEquals(result.status, "SAFE");
        assertEquals(result.warning, "Moderation service error");
      },
    );
  });
});

Deno.test("classifyMessage - fails open to SAFE when fetch itself throws", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => {
        throw new Error("network unreachable");
      },
      async () => {
        const result = await classifyMessage(fakeServiceClient(), "hello");
        assertEquals(result.status, "SAFE");
        assertEquals(result.warning, "Moderation service error");
      },
    );
  });
});

Deno.test("classifyMessage - trims and uppercases Gemini's raw text before matching", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(geminiResponse("  spam \n")),
      async () => {
        const result = await classifyMessage(fakeServiceClient(), "check out my onlyfans link");
        assertEquals(result.status, "SPAM");
      },
    );
  });
});
