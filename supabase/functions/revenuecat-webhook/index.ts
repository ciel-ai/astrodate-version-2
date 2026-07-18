/**
 * revenuecat-webhook Edge Function
 *
 * Server-to-server webhook called exclusively by RevenueCat (both App Store
 * and Play Store events arrive here in the same normalised shape). This is
 * the async, event-driven half of subscription sync — the other half is
 * confirm-purchase, which the client calls right after a purchase for
 * immediate activation (see that function's docstring). Both write through
 * the same _shared/subscription-sync.ts helpers, so a slightly-late webhook
 * event for a purchase confirm-purchase already activated is a harmless
 * no-op update, not a duplicate.
 *
 * This is the ONLY event source for renewals, cancellations, billing issues,
 * and expirations — confirm-purchase only ever handles the initial purchase
 * moment. There is deliberately no client-callable RPC that can write
 * user_subscriptions / user_profiles.plan_type directly any more (the old
 * sync_ios_subscription RPC let any signed-in user self-grant AstroX with no
 * purchase at all — see supabase/migrations/20260710150000_lockdown_sync_ios_subscription.sql).
 *
 * No CORS headers — server-to-server only. The Authorization header secret
 * below is the sole access control.
 *
 * Required Edge Function secrets:
 *   REVENUECAT_WEBHOOK_SECRET  (set as the "Authorization header value" for
 *                               this webhook in the RevenueCat dashboard)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { activateSubscription, normalisePlanSlug, setSubscriptionStatus } from "../_shared/subscription-sync.ts";

// Constant-time string compare (defense-in-depth -- HTTPS already removes any
// practical timing side-channel here, but this costs nothing). Walks the
// longer of the two byte arrays so the loop length never itself leaks which
// input was shorter.
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

type RevenueCatEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "CANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "SUBSCRIBER_ALIAS"
  | "TRANSFER"
  | "UNCANCELLATION"
  | string;

interface RevenueCatEvent {
  type: RevenueCatEventType;
  app_user_id: string;           // maps to our auth.users.id (set as RevenueCat appUserID via Purchases.logIn)
  product_id: string;            // e.g. "astrodate_astroplus_monthly"
  entitlement_ids?: string[];    // e.g. ["astro_x"]
  expiration_at_ms?: number | null;
  purchased_at_ms?: number;
  period_type?: string;          // "NORMAL" | "TRIAL" | "INTRO"
  store?: string;                // "APP_STORE" | "PLAY_STORE"
  is_family_share?: boolean;
}

interface RevenueCatWebhookBody {
  event: RevenueCatEvent;
  api_version: string;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!webhookSecret || !supabaseUrl || !supabaseServiceKey) {
      console.error("revenuecat-webhook: missing required environment variables");
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // RevenueCat sends: Authorization: <the secret configured in its dashboard>
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !timingSafeEqual(authHeader, webhookSecret)) {
      console.warn("revenuecat-webhook: invalid or missing Authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const bodyText = await req.text();
    let body: RevenueCatWebhookBody;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const event = body?.event;
    if (!event || !event.type || !event.app_user_id) {
      return new Response(JSON.stringify({ error: "Malformed event" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`revenuecat-webhook: received ${event.type} (${event.store ?? "unknown store"}) for user ${event.app_user_id}`);

    const supabase = createClient<any, any, any>(supabaseUrl, supabaseServiceKey);
    const userId = event.app_user_id; // we configure RevenueCat's appUserID to our auth UID via Purchases.logIn

    switch (event.type) {
      case "INITIAL_PURCHASE":
        await handleInitialPurchase(supabase, userId, event);
        break;

      case "RENEWAL":
      case "UNCANCELLATION":
        await handleRenewal(supabase, userId, event);
        break;

      case "CANCELLATION":
        await setSubscriptionStatus(supabase, userId, "canceled");
        break;

      case "EXPIRATION":
        await setSubscriptionStatus(supabase, userId, "expired");
        break;

      case "BILLING_ISSUE":
        await setSubscriptionStatus(supabase, userId, "past_due");
        break;

      default:
        // PRODUCT_CHANGE, TRANSFER, SUBSCRIBER_ALIAS, etc.
        console.log(`revenuecat-webhook: unhandled event type ${event.type} — skipping`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("revenuecat-webhook error:", err);
    // Return 200 so RevenueCat does not retry — retries on non-transient
    // errors would cause duplicate subscription activations. Investigate
    // via function logs.
    return new Response(JSON.stringify({ error: "Internal error", detail: String(err) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});

async function handleInitialPurchase(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient<any, any, any>>,
  userId: string,
  event: RevenueCatEvent,
): Promise<void> {
  const planSlug = normalisePlanSlug(event.product_id, event.entitlement_ids);
  if (!planSlug) {
    console.error(`handleInitialPurchase: cannot resolve plan slug for product=${event.product_id}`);
    return;
  }

  const periodStart = event.purchased_at_ms
    ? new Date(event.purchased_at_ms).toISOString()
    : new Date().toISOString();

  const periodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await activateSubscription(supabase, userId, planSlug, periodStart, periodEnd);
  console.log(`handleInitialPurchase: activated ${planSlug} for user ${userId}`);
}

async function handleRenewal(
  // deno-lint-ignore no-explicit-any
  supabase: ReturnType<typeof createClient<any, any, any>>,
  userId: string,
  event: RevenueCatEvent,
): Promise<void> {
  const newPeriodEnd = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const planSlug = normalisePlanSlug(event.product_id, event.entitlement_ids);

  if (planSlug) {
    // Renewal always refreshes plan_id too, in case the user changed products
    // between billing cycles (handled the same way as an initial purchase).
    await activateSubscription(supabase, userId, planSlug, new Date().toISOString(), newPeriodEnd);
    console.log(`handleRenewal: extended subscription to ${newPeriodEnd} for user ${userId}`);
    return;
  }

  // Can't resolve a plan (unexpected product_id/entitlement) — still extend
  // the existing row's period so access doesn't lapse on a data hiccup.
  const { data: rowToUpdate } = await supabase
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rowToUpdate) {
    console.error("handleRenewal: no subscription row found for user", userId);
    return;
  }

  const { error } = await supabase
    .from("user_subscriptions")
    .update({
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: newPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowToUpdate.id);

  if (error) console.error("handleRenewal UPDATE error:", error);
}
