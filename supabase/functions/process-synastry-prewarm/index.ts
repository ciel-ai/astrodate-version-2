/**
 * process-synastry-prewarm Edge Function
 *
 * Drains public.synastry_prewarm_jobs: for each claimed job, computes the
 * SQL-only planet-level synastry scores (process_synastry_prewarm_job RPC)
 * AND the Ashtakoota Guna Milan score (by invoking compute-synastry), so
 * Indian 45 (get_indian_compatibility) actually becomes available for
 * candidate pairs instead of staying "not yet computed" forever.
 *
 * This function was referenced by the client (src/app/cosmic-identity.tsx,
 * fire-and-forget after onboarding) and by an older version of this project
 * (D:\ciel-project\Astrodate) but was missing from this repo -- prewarm jobs
 * were being enqueued and never drained. Recreated here, matching that older
 * implementation's auth model rather than guessing a new one:
 *   - A real authenticated user's JWT (the onboarding fire-and-forget call) --
 *     verified via auth.getUser(), not just checked for presence.
 *   - The "drain-synastry-prewarm-queue" pg_cron job, which instead proves
 *     itself with a scoped secret (PREWARM_FUNCTION_SECRET env var, checked
 *     against an x-prewarm-secret header) -- the same worker-secret-in-Vault
 *     convention this project already uses for its other cron jobs
 *     (push_worker_secret, daily_insights_worker_secret), rather than handing
 *     the cron job the full service-role key.
 *
 * Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PREWARM_FUNCTION_SECRET
 * Request body: { batch_size?: number }  (default 10, matches claim's own default)
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

type ClaimedJob = {
  id: string;
  user_id: string;
  candidate_user_id: string;
  retry_count: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  // Two valid callers: a real authenticated user (onboarding's fire-and-forget
  // call) or the pg_cron drain job, which proves itself via a scoped secret
  // rather than a full JWT -- matches this project's other worker-secret cron
  // jobs (PUSH_WORKER_SECRET / daily_insights_worker_secret convention).
  const authHeader = req.headers.get("Authorization");
  const prewarmSecret = Deno.env.get("PREWARM_FUNCTION_SECRET");
  const providedSecret = req.headers.get("x-prewarm-secret");

  if (!authHeader && (!prewarmSecret || providedSecret !== prewarmSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  if (authHeader) {
    const authClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  let batchSize = 10;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number" && body.batch_size > 0) {
      batchSize = Math.min(body.batch_size, 10); // matches claim_synastry_prewarm_jobs' own cap
    }
  } catch {
    // no body / invalid JSON -> use default batch size
  }

  const { data: jobs, error: claimError } = await db.rpc(
    "claim_synastry_prewarm_jobs",
    { p_limit: batchSize }
  );

  if (claimError) {
    return json({ error: claimError.message }, 500);
  }

  const results: Array<{ job_id: string; status: string; detail?: unknown }> = [];

  for (const job of (jobs ?? []) as ClaimedJob[]) {
    try {
      // Ashtakoota first: if this fails, put the job back for retry rather
      // than finalizing it as "processed" with a permanently missing score
      // (claim_synastry_prewarm_jobs never re-picks a 'processed' job).
      // compute-synastry only checks that *some* Authorization header is
      // present (its own service-role client does the real DB work), so the
      // cron path (no user JWT) forwards the service-role key instead --
      // exactly the "prewarm worker (service role key)" case its docstring
      // already anticipated.
      const synastryRes = await fetch(`${supabaseUrl}/functions/v1/compute-synastry`, {
        method: "POST",
        headers: {
          Authorization: authHeader ?? `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_a_id: job.user_id,
          user_b_id: job.candidate_user_id,
        }),
      });

      if (!synastryRes.ok) {
        const nextRetryCount = job.retry_count + 1;
        await db
          .from("synastry_prewarm_jobs")
          .update({
            status: nextRetryCount >= 3 ? "failed" : "pending",
            retry_count: nextRetryCount,
            last_error: `compute-synastry returned ${synastryRes.status}`,
          })
          .eq("id", job.id);
        results.push({ job_id: job.id, status: "ashtakoota_failed" });
        continue;
      }

      // Planet-level synastry scores + marks synastry_cache_details fresh;
      // finalizes the job's own status/retry bookkeeping on success or failure.
      const { data: processResult, error: processError } = await db.rpc(
        "process_synastry_prewarm_job",
        { p_job_id: job.id }
      );

      results.push({
        job_id: job.id,
        status: processError ? "sql_error" : "processed",
        detail: processError ? processError.message : processResult,
      });
    } catch (err) {
      const nextRetryCount = job.retry_count + 1;
      await db
        .from("synastry_prewarm_jobs")
        .update({
          status: nextRetryCount >= 3 ? "failed" : "pending",
          retry_count: nextRetryCount,
          last_error: err instanceof Error ? err.message : String(err),
        })
        .eq("id", job.id);
      results.push({ job_id: job.id, status: "error" });
    }
  }

  return json({ success: true, claimed: results.length, results });
});
