/**
 * confirm-purchase Edge Function
 *
 * Called by the client immediately after react-native-purchases reports a
 * successful purchase, so the buyer's account activates within the request
 * instead of waiting on the async revenuecat-webhook (which is still the
 * source of truth for renewals/cancellations/expirations — this function
 * only ever handles the "I just bought this" moment).
 *
 * This does NOT trust anything the client says about what it purchased. It:
 *   1. Verifies the caller's Supabase JWT (authClient.auth.getUser()) to get
 *      a real, server-attested userId — never a client-supplied string.
 *   2. Independently asks RevenueCat's own servers (GET /v1/subscribers/{id}
 *      with the project's secret key) which entitlements are active for
 *      that userId right now.
 *   3. Only activates a plan_catalog row that matches an entitlement
 *      RevenueCat itself reports as active (expires_date null or in the future).
 *
 * This is the replacement for the legacy sync_ios_subscription RPC, which
 * did none of the above — it took a client-supplied entitlement_id string on
 * blind trust and activated it, letting any signed-in user self-grant AstroX
 * with zero purchase. That RPC is now locked to service_role only (see
 * supabase/migrations/20260710150000_lockdown_sync_ios_subscription.sql).
 * Do not add a path back to trusting client-supplied plan/entitlement data.
 *
 * If RevenueCat's API is unreachable or reports nothing active yet (e.g. a
 * few seconds of replication lag on their end), this returns success:false
 * without writing anything — the async webhook will still land shortly after
 * and activate the account then. Nothing here can activate a plan that
 * RevenueCat hasn't confirmed.
 *
 * Required Edge Function secrets:
 *   REVENUECAT_SECRET_API_KEY  (Project settings > API keys > Secret key,
 *                               RevenueCat dashboard)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
 *
 * Request: POST, Authorization: Bearer <user JWT>, no body required.
 * Response: { success: boolean, plan_slug?: string }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { activateSubscription } from "../_shared/subscription-sync.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ENTITLEMENT_TO_PLAN_SLUG: Record<string, string> = {
  astro_x: "astro_x",
  astro_plus: "astro_plus",
};

interface RevenueCatSubscriberResponse {
  subscriber?: {
    entitlements?: Record<string, { expires_date: string | null }>;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const revenueCatSecretKey = Deno.env.get("REVENUECAT_SECRET_API_KEY");

  if (!supabaseUrl || !serviceKey || !revenueCatSecretKey) {
    console.error("confirm-purchase: missing required environment variables");
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  const authClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = authData.user.id;

  let rcResponse: Response;
  try {
    rcResponse = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${revenueCatSecretKey}` },
    });
  } catch (err) {
    console.error("confirm-purchase: RevenueCat API request failed:", err);
    return json({ success: false, error: "RevenueCat lookup failed — the webhook will sync shortly" });
  }

  if (!rcResponse.ok) {
    console.error(`confirm-purchase: RevenueCat API returned ${rcResponse.status} for user ${userId}`);
    return json({ success: false, error: "RevenueCat lookup failed — the webhook will sync shortly" });
  }

  const rcData: RevenueCatSubscriberResponse = await rcResponse.json();
  const entitlements = rcData.subscriber?.entitlements ?? {};

  const now = Date.now();
  // AstroX outranks Astro+ if a user somehow holds both active entitlements.
  const activeSlugs = Object.entries(entitlements)
    .filter(([, e]) => e.expires_date === null || new Date(e.expires_date).getTime() > now)
    .map(([entitlementId]) => ENTITLEMENT_TO_PLAN_SLUG[entitlementId])
    .filter((slug): slug is string => Boolean(slug));

  const planSlug = activeSlugs.includes("astro_x") ? "astro_x" : activeSlugs[0];

  if (!planSlug) {
    console.log(`confirm-purchase: no active entitlement found yet for user ${userId} — deferring to webhook`);
    return json({ success: false });
  }

  const entitlementId = planSlug;
  const expiresDate = entitlements[entitlementId]?.expires_date;
  const periodEnd = expiresDate ?? new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = createClient<any, any, any>(supabaseUrl, serviceKey);
  await activateSubscription(supabase, userId, planSlug, new Date().toISOString(), periodEnd);

  console.log(`confirm-purchase: activated ${planSlug} for user ${userId}`);
  return json({ success: true, plan_slug: planSlug });
});
