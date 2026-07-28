import { assertEquals } from "jsr:@std/assert@1";
import { activateSubscription, normalisePlanSlug, setSubscriptionStatus } from "./subscription-sync.ts";

Deno.test("normalisePlanSlug - resolves astro_x from entitlement_ids in various shapes", () => {
  assertEquals(normalisePlanSlug("whatever_product", ["astro_x"]), "astro_x");
  assertEquals(normalisePlanSlug("whatever_product", ["AstroX"]), "astro_x");
  assertEquals(normalisePlanSlug("whatever_product", ["com.app.astrox_entitlement"]), "astro_x");
});

Deno.test("normalisePlanSlug - resolves astro_plus from entitlement_ids in various shapes", () => {
  assertEquals(normalisePlanSlug("whatever_product", ["astro_plus"]), "astro_plus");
  assertEquals(normalisePlanSlug("whatever_product", ["AstroPlus"]), "astro_plus");
});

Deno.test("normalisePlanSlug - falls back to a direct entitlement match when it's neither known plan", () => {
  assertEquals(normalisePlanSlug("whatever_product", ["some_custom_entitlement"]), "some_custom_entitlement");
});

Deno.test("normalisePlanSlug - only reads the first entitlement id, ignoring the rest", () => {
  assertEquals(normalisePlanSlug("whatever_product", ["astro_x", "astro_plus"]), "astro_x");
});

Deno.test("normalisePlanSlug - falls back to product_id when entitlement_ids is absent or empty", () => {
  assertEquals(normalisePlanSlug("astrodate_astrox_monthly", []), "astro_x");
  assertEquals(normalisePlanSlug("astrodate_astroplus_monthly", undefined), "astro_plus");
});

Deno.test("normalisePlanSlug - returns null when neither entitlement nor product_id resolve to a known plan", () => {
  assertEquals(normalisePlanSlug("some_unrelated_product", undefined), null);
  assertEquals(normalisePlanSlug("some_unrelated_product", []), null);
});

// -- activateSubscription / setSubscriptionStatus ---------------------------
// A hand-rolled fake mirroring just the chained shape these functions use
// (.from().select().eq()... / .update()... / .insert()), recording every
// call so tests can assert on exactly what was written without touching a
// real database.
function fakeSupabase(opts: {
  planRow?: { id: string; plan_slug: string } | null;
  existingSubscription?: { id: string } | null;
}) {
  const calls: { table: string; op: string; args: unknown }[] = [];

  function builder(table: string) {
    return {
      select: () => builder(table),
      eq: () => builder(table),
      order: () => builder(table),
      limit: () => builder(table),
      single: () => {
        if (table === "plan_catalog") {
          return Promise.resolve(
            opts.planRow
              ? { data: opts.planRow, error: null }
              : { data: null, error: { message: "not found" } },
          );
        }
        throw new Error(`unexpected .single() on ${table}`);
      },
      maybeSingle: () => {
        if (table === "user_subscriptions") {
          return Promise.resolve({ data: opts.existingSubscription ?? null, error: null });
        }
        throw new Error(`unexpected .maybeSingle() on ${table}`);
      },
      update: (row: unknown) => {
        calls.push({ table, op: "update", args: row });
        return builder(table);
      },
      insert: (row: unknown) => {
        calls.push({ table, op: "insert", args: row });
        return Promise.resolve({ error: null });
      },
    };
  }

  return { client: { from: builder }, calls };
}

Deno.test("activateSubscription - inserts a new row and syncs plan_type when there is no existing subscription", async () => {
  const { client, calls } = fakeSupabase({
    planRow: { id: "plan-astro-plus", plan_slug: "astro_plus" },
    existingSubscription: null,
  });

  await activateSubscription(client as any, "user-1", "astro_plus", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z");

  const subscriptionInsert = calls.find((c) => c.table === "user_subscriptions" && c.op === "insert");
  assertEquals(subscriptionInsert !== undefined, true);
  assertEquals((subscriptionInsert!.args as any).plan_id, "plan-astro-plus");
  assertEquals((subscriptionInsert!.args as any).status, "active");

  const profileUpdate = calls.find((c) => c.table === "user_profiles" && c.op === "update");
  assertEquals((profileUpdate!.args as any).plan_type, "Astro+");
});

Deno.test("activateSubscription - updates the existing row instead of inserting a duplicate", async () => {
  const { client, calls } = fakeSupabase({
    planRow: { id: "plan-astro-x", plan_slug: "astro_x" },
    existingSubscription: { id: "existing-sub-1" },
  });

  await activateSubscription(client as any, "user-1", "astro_x", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z");

  assertEquals(calls.some((c) => c.table === "user_subscriptions" && c.op === "insert"), false);
  const update = calls.find((c) => c.table === "user_subscriptions" && c.op === "update");
  assertEquals((update!.args as any).plan_id, "plan-astro-x");

  const profileUpdate = calls.find((c) => c.table === "user_profiles" && c.op === "update");
  assertEquals((profileUpdate!.args as any).plan_type, "AstroX");
});

Deno.test("activateSubscription - writes nothing when the plan slug doesn't exist in plan_catalog", async () => {
  const { client, calls } = fakeSupabase({ planRow: null, existingSubscription: null });

  await activateSubscription(client as any, "user-1", "nonexistent_plan", "2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z");

  assertEquals(calls.length, 0);
});

Deno.test("setSubscriptionStatus - downgrades plan_type to Free only on expiration, not on cancellation", async () => {
  const cancelled = fakeSupabase({ existingSubscription: { id: "sub-1" } });
  await setSubscriptionStatus(cancelled.client as any, "user-1", "canceled");
  assertEquals(cancelled.calls.some((c) => c.table === "user_profiles"), false);

  const expired = fakeSupabase({ existingSubscription: { id: "sub-1" } });
  await setSubscriptionStatus(expired.client as any, "user-1", "expired");
  const profileUpdate = expired.calls.find((c) => c.table === "user_profiles");
  assertEquals((profileUpdate!.args as any).plan_type, "Free");
});

Deno.test("setSubscriptionStatus - is a no-op when there is no subscription row for the user", async () => {
  const { client, calls } = fakeSupabase({ existingSubscription: null });
  await setSubscriptionStatus(client as any, "user-1", "past_due");
  assertEquals(calls.length, 0);
});
