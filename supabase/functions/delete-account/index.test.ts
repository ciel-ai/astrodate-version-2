import { assertEquals } from "jsr:@std/assert@1";
import { purgeUserStorage } from "./index.ts";

function fakeSupabase(opts: { files?: { name: string }[] | null; listError?: { message: string } | null }) {
  const removedPaths: string[][] = [];
  return {
    client: {
      storage: {
        from: (_bucket: string) => ({
          list: (_userId: string) =>
            Promise.resolve({ data: opts.files ?? null, error: opts.listError ?? null }),
          remove: (paths: string[]) => {
            removedPaths.push(paths);
            return Promise.resolve({ error: null });
          },
        }),
      },
    },
    removedPaths,
  };
}

Deno.test("purgeUserStorage - removes every listed file, namespaced under the user's folder", async () => {
  const { client, removedPaths } = fakeSupabase({ files: [{ name: "a.jpg" }, { name: "b.jpg" }] });
  await purgeUserStorage(client as any, "user-photos", "user-1");
  assertEquals(removedPaths, [["user-1/a.jpg", "user-1/b.jpg"]]);
});

Deno.test("purgeUserStorage - does nothing when the user has no files in that bucket", async () => {
  const { client, removedPaths } = fakeSupabase({ files: [] });
  await purgeUserStorage(client as any, "user-photos", "user-1");
  assertEquals(removedPaths.length, 0);
});

Deno.test("purgeUserStorage - does nothing when the listing itself errors, instead of throwing", async () => {
  const { client, removedPaths } = fakeSupabase({ files: null, listError: { message: "bucket unreachable" } });
  await purgeUserStorage(client as any, "user-photos", "user-1");
  assertEquals(removedPaths.length, 0);
});
