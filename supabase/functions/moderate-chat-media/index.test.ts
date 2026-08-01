import { assertEquals } from "jsr:@std/assert@1";
import { classifyChatMedia } from "./index.ts";

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

const MEDIA_BYTES = new Uint8Array([1, 2, 3, 4]);

Deno.test("classifyChatMedia - fails open to SAFE with a logged outage when GEMINI_API_KEY is missing", async () => {
  const inserts: Array<{ table: string; row: unknown }> = [];
  await withEnv("GEMINI_API_KEY", undefined, async () => {
    const result = await classifyChatMedia(
      fakeServiceClient((table, row) => inserts.push({ table, row })),
      "image",
      MEDIA_BYTES,
      "image/jpeg",
    );
    assertEquals(result.status, "SAFE");
  });
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].table, "moderation_outages");
});

Deno.test("classifyChatMedia - passes through a HARASSMENT classification for an image", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(geminiResponse("HARASSMENT")),
      async () => {
        const result = await classifyChatMedia(fakeServiceClient(), "image", MEDIA_BYTES, "image/jpeg");
        assertEquals(result.status, "HARASSMENT");
      },
    );
  });
});

Deno.test("classifyChatMedia - passes through an ILLEGAL classification for audio", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(geminiResponse("ILLEGAL")),
      async () => {
        const result = await classifyChatMedia(fakeServiceClient(), "audio", MEDIA_BYTES, "audio/mp4");
        assertEquals(result.status, "ILLEGAL");
      },
    );
  });
});

Deno.test("classifyChatMedia - treats anything outside the four valid categories as SAFE", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(geminiResponse("unsure, possibly unsafe but not certain")),
      async () => {
        const result = await classifyChatMedia(fakeServiceClient(), "image", MEDIA_BYTES, "image/jpeg");
        assertEquals(result.status, "SAFE");
      },
    );
  });
});

Deno.test("classifyChatMedia - fails open to SAFE on a non-OK Gemini response", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => Promise.resolve(new Response("rate limited", { status: 429 })),
      async () => {
        const result = await classifyChatMedia(fakeServiceClient(), "audio", MEDIA_BYTES, "audio/mp4");
        assertEquals(result.status, "SAFE");
      },
    );
  });
});

Deno.test("classifyChatMedia - fails open to SAFE when fetch itself throws (e.g. the timeout abort)", async () => {
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      () => {
        throw new Error("network unreachable");
      },
      async () => {
        const result = await classifyChatMedia(fakeServiceClient(), "image", MEDIA_BYTES, "image/jpeg");
        assertEquals(result.status, "SAFE");
      },
    );
  });
});

Deno.test("classifyChatMedia - uses the audio-specific prompt and mime type for voice notes", async () => {
  let capturedBody: any = null;
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      (_url, init) => {
        capturedBody = JSON.parse(init!.body as string);
        return Promise.resolve(geminiResponse("SAFE"));
      },
      async () => {
        await classifyChatMedia(fakeServiceClient(), "audio", MEDIA_BYTES, "audio/mp4");
      },
    );
  });
  const inlineData = capturedBody.contents[0].parts[0].inline_data;
  assertEquals(inlineData.mime_type, "audio/mp4");
  assertEquals(typeof inlineData.data, "string");
  assertEquals(inlineData.data.length > 0, true);
  assertEquals(capturedBody.system_instruction.parts[0].text.includes("voice messages"), true);
});

Deno.test("classifyChatMedia - uses the image-specific prompt for photos", async () => {
  let capturedBody: any = null;
  await withEnv("GEMINI_API_KEY", "test-key", async () => {
    await withFetch(
      (_url, init) => {
        capturedBody = JSON.parse(init!.body as string);
        return Promise.resolve(geminiResponse("SAFE"));
      },
      async () => {
        await classifyChatMedia(fakeServiceClient(), "image", MEDIA_BYTES, "image/png");
      },
    );
  });
  assertEquals(capturedBody.system_instruction.parts[0].text.includes("chat photos"), true);
});
