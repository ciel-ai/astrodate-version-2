/**
 * Shared subscription-activation logic used by both:
 *  - revenuecat-webhook (async, event-driven — renewals/cancellations/expirations)
 *  - confirm-purchase (synchronous, called right after a client purchase —
 *    verifies against RevenueCat's own servers before writing, see that
 *    function's docstring for why this exists instead of trusting the client)
 *
 * Both call the exact same write path so there is only one place that ever
 * touches user_subscriptions / user_profiles.plan_type for purchased plans.
 */
// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof import("jsr:@supabase/supabase-js@2").createClient<any, any, any>>;

// Maps RevenueCat product_id / entitlement_id → our plan_catalog.plan_slug.
// Store-agnostic: RevenueCat sends the same entitlement_ids regardless of
// whether the underlying purchase came from the App Store or Play Store.
export function normalisePlanSlug(productId: string, entitlementIds?: string[]): string | null {
  if (entitlementIds && entitlementIds.length > 0) {
    const ent = entitlementIds[0].toLowerCase();
    if (ent.includes("astro_x") || ent.includes("astrox")) return "astro_x";
    if (ent.includes("astro_plus") || ent.includes("astroplus")) return "astro_plus";
    return ent; // attempt direct match against plan_catalog slugs
  }

  const pid = productId.toLowerCase();
  if (pid.includes("astrox") || pid.includes("astro_x")) return "astro_x";
  if (pid.includes("astroplus") || pid.includes("astro_plus")) return "astro_plus";

  return null;
}

export async function activateSubscription(
  supabase: SupabaseClient,
  userId: string,
  planSlug: string,
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  const { data: plan, error: planErr } = await supabase
    .from("plan_catalog")
    .select("id, plan_slug")
    .eq("plan_slug", planSlug)
    .single();

  if (planErr || !plan) {
    console.error(`activateSubscription: plan not found for slug=${planSlug}`, planErr);
    return;
  }

  const { data: existing } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_subscriptions")
      .update({
        plan_id: plan.id,
        status: "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) console.error("activateSubscription UPDATE error:", error);
  } else {
    const { error } = await supabase.from("user_subscriptions").insert({
      user_id: userId,
      plan_id: plan.id,
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });

    if (error) console.error("activateSubscription INSERT error:", error);
  }

  await syncProfilePlanType(supabase, userId, planSlug);
}

export async function setSubscriptionStatus(
  supabase: SupabaseClient,
  userId: string,
  status: "canceled" | "expired" | "past_due",
): Promise<void> {
  const { data: rowToUpdate } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rowToUpdate) {
    console.error(`setSubscriptionStatus(${status}): no subscription row found for user`, userId);
    return;
  }

  const { error } = await supabase
    .from("user_subscriptions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", rowToUpdate.id);

  if (error) console.error(`setSubscriptionStatus(${status}) UPDATE error:`, error);

  // CANCELLATION means the user turned off auto-renew but keeps access until
  // current_period_end — only downgrade the display tier on actual EXPIRATION.
  if (status === "expired") {
    await supabase.from("user_profiles").update({ plan_type: "Free" }).eq("user_id", userId);
  }
}

export async function syncProfilePlanType(
  supabase: SupabaseClient,
  userId: string,
  planSlug: string,
): Promise<void> {
  const planType = planSlug === "astro_x" ? "AstroX" : "Astro+";

  const { error } = await supabase
    .from("user_profiles")
    .update({ plan_type: planType })
    .eq("user_id", userId);

  if (error) console.error("syncProfilePlanType error:", error);
}
