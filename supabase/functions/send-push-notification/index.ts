/**
 * send-push-notification Edge Function
 *
 * Drains public.notification_delivery_logs and sends each row through Expo's
 * push API. Called every minute by the drain-push-notification-queue pg_cron
 * job (supabase/migrations/20260630120300_realtime_cron.sql) -- this is the
 * half of the pipeline that never existed: the enqueue triggers and the cron
 * job were already live, POSTing to this URL and getting a 404 every minute.
 *
 * No CORS headers -- server-to-server only, called by pg_net from inside
 * Postgres. The x-push-worker-secret header (checked below against
 * PUSH_WORKER_SECRET) is the sole access control, same pattern as
 * revenuecat-webhook's shared-secret header.
 *
 * Flow per claimed row:
 *   1. claim_notification_delivery_logs() atomically grabs a batch (status
 *      pending/failed -> processing, SKIP LOCKED) -- already existed.
 *   2. Skip (status='skipped') if the user has that notification type turned
 *      off in user_notification_preferences.
 *   3. Skip (status='failed', no retry) if the user has no active push
 *      tokens registered.
 *   4. Otherwise send to every active token for that user (a user signed in
 *      on two devices gets notified on both -- send-time behavior, not a bug).
 *
 * Quiet hours (user_notification_preferences.quiet_hours_start/end,
 * interpreted in the .timezone column added alongside 'engagement' in
 * 20260714120000_notification_engagement_tiers.sql) are enforced for
 * 'engagement'/'marketing' only -- 'new_match'/'new_message' stay
 * transactional and always send. A row caught in quiet hours goes back to
 * 'pending' with next_attempt_at pushed to local quiet-hours-end, without
 * consuming one of the 3 real retry attempts.
 *
 * Ticket-level DeviceNotRegistered errors deactivate that specific token so
 * the queue doesn't keep retrying a dead install. This does not poll Expo's
 * receipt endpoint (expo_receipt_ids is written but never followed up) --
 * that's a reasonable follow-up, not required for notifications to be
 * delivered.
 *
 * Required Edge Function secrets:
 *   PUSH_WORKER_SECRET  (must match the 'push_worker_secret' Vault secret
 *                        the cron job reads -- see the migration's comment
 *                        for the `SELECT vault.create_secret(...)` to run)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (provided automatically)
 *
 * Request: POST, x-push-worker-secret: <secret>, body { batch_size?: number }
 * Response: { success: boolean, claimed: number, sent: number, skipped: number, failed: number }
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_LIMIT = 100;

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface ClaimedLog {
  id: string;
  user_id: string;
  notification_type: "new_match" | "new_message" | "marketing" | "engagement";
  reference_id: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  attempt_count: number;
}

interface PreferenceRow {
  user_id: string;
  new_matches_enabled: boolean;
  new_messages_enabled: boolean;
  marketing_enabled: boolean;
  engagement_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string;
}

interface TokenRow {
  id: string;
  user_id: string;
  expo_push_token: string;
}

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

function preferenceAllows(pref: PreferenceRow | undefined, type: ClaimedLog["notification_type"]): boolean {
  if (!pref) return true; // no row yet == defaults, which are all-enabled except marketing
  if (type === "new_match") return pref.new_matches_enabled;
  if (type === "new_message") return pref.new_messages_enabled;
  if (type === "engagement") return pref.engagement_enabled;
  return pref.marketing_enabled;
}

// ---------------------------------------------------------------------------
// Quiet hours: only ever evaluated for 'engagement'/'marketing' -- Tier 1
// (new_match/new_message) is transactional and must never be gated by it.
// quiet_hours_start/end are plain clock times (no date), interpreted in the
// user's own `timezone`. Approximates by comparing local clock time only --
// no offset/DST math needed for the "is it quiet right now" check, and the
// "when does it end" calc works in relative local-minutes-from-now, which is
// DST-transition-agnostic by construction (same tolerance-for-approximation
// already used elsewhere in this codebase, e.g. daily-insights' sunrise/sunset).
// ---------------------------------------------------------------------------
function localMinuteOfDay(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  return (get("hour") % 24) * 60 + get("minute");
}

function parseClockMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isInQuietHours(pref: PreferenceRow | undefined, now: Date): boolean {
  if (!pref?.quiet_hours_start || !pref?.quiet_hours_end) return false;
  const startMin = parseClockMinutes(pref.quiet_hours_start);
  const endMin = parseClockMinutes(pref.quiet_hours_end);
  if (startMin === endMin) return false;
  const nowMin = localMinuteOfDay(pref.timezone || "UTC", now);
  return startMin < endMin
    ? nowMin >= startMin && nowMin < endMin
    : nowMin >= startMin || nowMin < endMin; // wraps past midnight
}

/** Minutes from `now` until quiet hours end, for rescheduling a deferred send. */
function minutesUntilQuietHoursEnd(pref: PreferenceRow, now: Date): number {
  const endMin = parseClockMinutes(pref.quiet_hours_end!);
  const nowMin = localMinuteOfDay(pref.timezone || "UTC", now);
  const delta = endMin - nowMin;
  return delta <= 0 ? delta + 24 * 60 : delta;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const pushWorkerSecret = Deno.env.get("PUSH_WORKER_SECRET");

  if (!supabaseUrl || !serviceKey || !pushWorkerSecret) {
    console.error("send-push-notification: missing required environment variables");
    return json({ error: "Server misconfigured" }, 500);
  }

  const headerSecret = req.headers.get("x-push-worker-secret");
  if (!headerSecret || headerSecret !== pushWorkerSecret) {
    console.warn("send-push-notification: invalid or missing x-push-worker-secret header");
    return json({ error: "Unauthorized" }, 401);
  }

  let batchSize = 50;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number") batchSize = body.batch_size;
  } catch {
    // no body / not JSON -- use default
  }

  const supabase = createClient<any, any, any>(supabaseUrl, serviceKey);

  const { data: claimed, error: claimError } = await supabase.rpc("claim_notification_delivery_logs", {
    p_limit: batchSize,
  });
  if (claimError) {
    console.error("send-push-notification: claim_notification_delivery_logs failed:", claimError.message);
    return json({ error: "Failed to claim queue" }, 500);
  }

  const logs: ClaimedLog[] = claimed ?? [];
  if (logs.length === 0) {
    return json({ success: true, claimed: 0, sent: 0, skipped: 0, failed: 0 });
  }

  const userIds = [...new Set(logs.map((l) => l.user_id))];

  const [{ data: prefRows }, { data: tokenRows }] = await Promise.all([
    supabase
      .from("user_notification_preferences")
      .select(
        "user_id, new_matches_enabled, new_messages_enabled, marketing_enabled, engagement_enabled, quiet_hours_start, quiet_hours_end, timezone"
      )
      .in("user_id", userIds),
    supabase
      .from("user_push_tokens")
      .select("id, user_id, expo_push_token")
      .in("user_id", userIds)
      .eq("is_active", true),
  ]);

  const prefsByUser = new Map<string, PreferenceRow>((prefRows ?? []).map((p: PreferenceRow) => [p.user_id, p]));
  const tokensByUser = new Map<string, TokenRow[]>();
  for (const t of (tokenRows ?? []) as TokenRow[]) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push(t);
    tokensByUser.set(t.user_id, list);
  }

  let skippedCount = 0;
  let noTokenCount = 0;
  let deferredCount = 0;
  const now = new Date();

  // messages to actually send, each tagged with the log + token it belongs to
  // so ticket results can be mapped back after the Expo call.
  const sendQueue: { log: ClaimedLog; token: TokenRow }[] = [];

  for (const log of logs) {
    const pref = prefsByUser.get(log.user_id);

    if (!preferenceAllows(pref, log.notification_type)) {
      skippedCount++;
      await supabase
        .from("notification_delivery_logs")
        .update({ status: "skipped", updated_at: new Date().toISOString() })
        .eq("id", log.id);
      continue;
    }

    // Tier 1 (new_match/new_message) is transactional and always sends,
    // regardless of quiet hours -- only engagement/marketing defer.
    if (
      (log.notification_type === "engagement" || log.notification_type === "marketing") &&
      isInQuietHours(pref, now)
    ) {
      deferredCount++;
      const nextAttempt = new Date(now.getTime() + minutesUntilQuietHoursEnd(pref!, now) * 60000).toISOString();
      // Stays 'pending' with attempt_count untouched -- a quiet-hours deferral
      // is not a failed attempt and must not eat into the 3-retry budget.
      await supabase
        .from("notification_delivery_logs")
        .update({ status: "pending", next_attempt_at: nextAttempt, updated_at: new Date().toISOString() })
        .eq("id", log.id);
      continue;
    }

    const tokens = tokensByUser.get(log.user_id) ?? [];
    if (tokens.length === 0) {
      noTokenCount++;
      // Same backoff as a genuine send failure -- a token can show up a few
      // minutes later (permission granted just after the notification fired),
      // so this still gets a couple of spaced-out retries rather than none,
      // but not one every single minute for 3 minutes straight.
      const nextAttempt = new Date(Date.now() + (log.attempt_count + 1) * 5 * 60 * 1000).toISOString();
      await supabase
        .from("notification_delivery_logs")
        .update({
          status: "failed",
          attempt_count: log.attempt_count + 1,
          error_message: "No active push token for user",
          next_attempt_at: nextAttempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);
      continue;
    }

    for (const token of tokens) {
      sendQueue.push({ log, token });
    }
  }

  let sentLogCount = 0;
  let failedLogCount = 0;
  const deadTokenIds = new Set<string>();
  // per-log results across however many tokens it fanned out to
  const resultsByLog = new Map<string, { ticketIds: string[]; anyOk: boolean; lastError?: string }>();

  for (let i = 0; i < sendQueue.length; i += EXPO_BATCH_LIMIT) {
    const chunk = sendQueue.slice(i, i + EXPO_BATCH_LIMIT);
    const messages = chunk.map(({ log, token }) => ({
      to: token.expo_push_token,
      title: log.title,
      body: log.body,
      data: log.payload,
      sound: "default",
    }));

    let tickets: ExpoTicket[] = [];
    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      const json_ = await resp.json();
      tickets = json_?.data ?? [];
    } catch (err) {
      console.error("send-push-notification: Expo push API request failed:", err);
      // Leave this chunk's logs untouched here; they'll be picked up again
      // (still 'processing' for 5 min, then reclaimed by claim_notification_delivery_logs).
      continue;
    }

    chunk.forEach(({ log, token }, idx) => {
      const ticket = tickets[idx];
      const entry = resultsByLog.get(log.id) ?? { ticketIds: [], anyOk: false };
      if (ticket?.status === "ok") {
        entry.anyOk = true;
        entry.ticketIds.push(ticket.id);
      } else if (ticket?.status === "error") {
        entry.lastError = ticket.message;
        if (ticket.details?.error === "DeviceNotRegistered") {
          deadTokenIds.add(token.id);
        }
      }
      resultsByLog.set(log.id, entry);
    });
  }

  for (const log of logs) {
    const result = resultsByLog.get(log.id);
    if (!result) continue; // already handled as skipped/no-token above

    if (result.anyOk) {
      sentLogCount++;
      await supabase
        .from("notification_delivery_logs")
        .update({
          status: "sent",
          attempt_count: log.attempt_count + 1,
          expo_ticket_ids: result.ticketIds,
          sent_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);
    } else {
      failedLogCount++;
      const nextAttempt = new Date(Date.now() + (log.attempt_count + 1) * 5 * 60 * 1000).toISOString();
      await supabase
        .from("notification_delivery_logs")
        .update({
          status: "failed",
          attempt_count: log.attempt_count + 1,
          error_message: result.lastError ?? "Unknown Expo push error",
          next_attempt_at: nextAttempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", log.id);
    }
  }

  if (deadTokenIds.size > 0) {
    await supabase
      .from("user_push_tokens")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", [...deadTokenIds]);
  }

  console.log(
    `send-push-notification: claimed=${logs.length} sent=${sentLogCount} skipped=${skippedCount} deferred=${deferredCount} failed=${failedLogCount + noTokenCount} deadTokens=${deadTokenIds.size}`
  );

  return json({
    success: true,
    claimed: logs.length,
    sent: sentLogCount,
    skipped: skippedCount,
    deferred: deferredCount,
    failed: failedLogCount + noTokenCount,
  });
});
