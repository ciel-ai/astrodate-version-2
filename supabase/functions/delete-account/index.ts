/**
 * delete-account Edge Function
 *
 * Permanently deletes the calling user's account and everything that
 * references it.
 *
 * Every FK to auth.users across the schema is declared ON DELETE CASCADE
 * (see supabase/migrations/20260630120000_baseline_tables.sql onward), so
 * calling auth.admin.deleteUser() is enough to remove every DB row owned by
 * the user -- profile, photos rows, prompts, messages, matches, likes,
 * swipes, reports, subscriptions, push tokens, synastry cache, everything.
 * Storage objects are NOT covered by that cascade (Supabase Storage isn't a
 * foreign-keyed table), so this explicitly purges the user's own folder in
 * the user-photos and messages buckets first. Both buckets are namespaced
 * `${userId}/...` (see storage RLS policies in the same migration), so this
 * only ever touches files the deleting user uploaded themselves.
 *
 * Does NOT cancel any active RevenueCat/App Store/Play Store subscription --
 * store billing is managed by the store, not by this backend (same boundary
 * documented in confirm-purchase and revenuecat-webhook). The client is
 * responsible for telling the user to cancel their subscription separately
 * if they don't want to keep being billed.
 *
 * Required Edge Function secrets:
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
 *
 * Request: POST, Authorization: Bearer <user JWT>, no body required.
 * Response: { success: boolean }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

async function purgeUserStorage(
  supabase: ReturnType<typeof createClient>,
  bucket: string,
  userId: string,
) {
  const { data: files, error } = await supabase.storage.from(bucket).list(userId);
  if (error) {
    console.error(`delete-account: listing ${bucket}/${userId} failed:`, error.message);
    return;
  }
  if (!files || files.length === 0) return;

  const paths = files.map((f) => `${userId}/${f.name}`);
  const { error: removeError } = await supabase.storage.from(bucket).remove(paths);
  if (removeError) {
    console.error(`delete-account: removing ${bucket}/${userId} objects failed:`, removeError.message);
  }
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

  if (!supabaseUrl || !serviceKey) {
    console.error("delete-account: missing required environment variables");
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Never trust a client-supplied userId -- resolve it from the caller's own
  // verified JWT, same pattern as confirm-purchase.
  const authClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData.user) {
    return json({ error: "Unauthorized" }, 401);
  }
  const userId = authData.user.id;

  const supabase = createClient(supabaseUrl, serviceKey);

  await purgeUserStorage(supabase, "user-photos", userId);
  await purgeUserStorage(supabase, "messages", userId);

  const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error(`delete-account: failed to delete user ${userId}:`, deleteError.message);
    return json({ error: "Failed to delete account" }, 500);
  }

  console.log(`delete-account: deleted user ${userId}`);
  return json({ success: true });
});
