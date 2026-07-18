# AstroDate — Recovery Runbook

What to do when something specific breaks in production. This covers the failure modes this app has known defenses (or known gaps) for — not a generic checklist. If you hit something not covered here, add it once you've resolved it.

Project ref: `frgckqxfkfjacrutcobg` (Seoul). All commands below assume you're in the repo root with the Supabase CLI linked (`npx supabase projects list` should show a `●` next to `Astrodate`).

## First principle: check live state, not migration files

Migration files tell you what was *intended* at some point in history — not what's actually true on the running database. Grants get silently re-added by Supabase's default-privilege auto-grant, functions get `CREATE OR REPLACE`d by later migrations, and arity changes can drop a `REVOKE` without anyone noticing. Every incident below is diagnosed by querying the **live** database, not by grepping `supabase/migrations/`.

```bash
npx supabase db query --linked -f path/to/query.sql
```

Multi-statement files only return the last statement's result — one query per file/run if you need more than one answer.

---

## Moderation service outage (Gemini API down or misconfigured)

**Symptom:** messages are going through unmoderated, or users report seeing content that should've been blocked.

`moderate-message` (`supabase/functions/moderate-message/index.ts`) fails open to `SAFE` on three paths: missing `GEMINI_API_KEY`, a non-2xx Gemini response, or an unhandled exception. This is deliberate — a moderation outage must never block every message in the app — but every fail-open now writes a row to `moderation_outages` (`reason`, `detail`, `occurred_at`).

**Diagnose:**
```sql
SELECT * FROM public.moderation_outages ORDER BY occurred_at DESC LIMIT 50;
```
`reason` is one of `missing_api_key`, `gemini_api_error`, or `exception`. `detail` has the Gemini status code/body or exception message.

**Fix by reason:**
- `missing_api_key` — the secret isn't set. Check with `npx supabase secrets list`, set with `npx supabase secrets set GEMINI_API_KEY=<key>`.
- `gemini_api_error` — check the status code in `detail`. 429/5xx usually means a Gemini-side rate limit or outage; check [Gemini's status page]. 401/403 means the key is invalid or revoked.
- `exception` — read the message; likely a malformed response shape from a Gemini API change. Check `supabase/functions/moderate-message/index.ts`'s parsing of `geminiData.candidates[0].content.parts[0].text`.

**Floor beneath this:** even during a full outage, `moderation_blocklist_terms` (a DB-level `BEFORE INSERT` trigger, `check_message_moderation_backstop`) still rejects messages containing severe blocklisted terms via `ILIKE` substring match. It's a small, static list — not a substitute for Gemini, just a backstop. Check/update it directly:
```sql
SELECT * FROM public.moderation_blocklist_terms WHERE active = true;
```

**View function logs:** Supabase Dashboard → Edge Functions → `moderate-message` → Logs (this CLI version has no `functions logs` subcommand — dashboard is the only path).

---

## RevenueCat webhook / subscription sync issues

**Symptom:** a user paid but doesn't have AstroX/Astro+ access, or a cancelled subscription is still showing as active.

Two independent write paths, both going through `_shared/subscription-sync.ts`:
- `confirm-purchase` — client calls this immediately after a purchase, for instant activation.
- `revenuecat-webhook` — the **only** source of truth for renewals, cancellations, billing issues, and expirations. Server-to-server only, auth'd by a shared secret in the `Authorization` header (constant-time compared — see `timingSafeEqual` in `supabase/functions/revenuecat-webhook/index.ts`).

**Important:** the webhook always returns `200` even on internal errors — this is deliberate, so RevenueCat doesn't retry and duplicate-activate a subscription. That means **a 200 in RevenueCat's dashboard delivery log does not mean the sync actually succeeded.** Check function logs, not just delivery status.

**Diagnose:**
1. Supabase Dashboard → Edge Functions → `revenuecat-webhook` → Logs. Every event logs `revenuecat-webhook: received <TYPE> (<STORE>) for user <ID>` on receipt, and `handleInitialPurchase:`/`handleRenewal:` on success, or `UPDATE error:`/a caught exception on failure.
2. Check the actual row:
   ```sql
   SELECT * FROM public.user_subscriptions WHERE user_id = '<uuid>' ORDER BY created_at DESC;
   ```
3. If the webhook secret itself might be wrong: RevenueCat dashboard → your webhook's configured "Authorization header value" must match `REVENUECAT_WEBHOOK_SECRET` exactly (`npx supabase secrets list` won't show the value, only that it's set — if in doubt, rotate it in both places together via `npx supabase secrets set REVENUECAT_WEBHOOK_SECRET=<new value>`, then update the RevenueCat dashboard to match).
4. `handleRenewal` has a fallback path for an unresolvable `product_id`/`entitlement_ids` — it still extends the existing row's period rather than dropping access, but logs `handleRenewal: no subscription row found for user <id>` if there's no row to extend at all (meaning `confirm-purchase` never ran for this user — check the client-side purchase flow).

**Manual recovery:** if a specific user is confirmed to have paid (check the RevenueCat dashboard's Customer History directly) but the DB never got the event, you can replay it by re-sending the event from RevenueCat's dashboard (Customer → Event → Resend), rather than hand-writing `user_subscriptions` rows.

---

## Bad migration / need to fix a live schema mistake

**There is no rollback.** Supabase migrations are forward-only and tracked by filename + checksum in a history table on the linked project. Never edit or delete a migration file that's already been pushed — `supabase db push` will detect the mismatch and refuse, or worse, silently diverge local/remote history.

**To fix a mistake:** write a new migration that corrects it — same pattern as `20260718150000_rls_audit_fixes.sql`, which used `CREATE OR REPLACE FUNCTION`/`DROP POLICY` + `CREATE POLICY` to fix problems introduced by earlier migrations, rather than trying to erase them from history.

**Before pushing any migration:**
```bash
npx supabase db push --linked --dry-run   # confirms exactly which files would apply, catches nothing already-applied being re-listed
npx supabase db push --linked             # actually applies; DDL is transactional, so a mid-file error rolls back that whole file cleanly
```

**After pushing, verify live** — don't trust the file, query the actual result (grants, policy definitions, `pg_get_functiondef`, whatever the migration touched). This session's audit found two real cases where a function's *written* grant (`GRANT ... TO authenticated`) didn't match its *live* grant (`anon` also had access, via Supabase's default-privilege auto-grant) — the file alone would have said everything was fine.

**If migration history itself gets out of sync** (e.g. a migration was applied via the dashboard SQL editor instead of the CLI, or a local/remote mismatch):
```bash
npx supabase migration list --linked      # compare local vs remote
npx supabase migration repair --status applied <version>   # mark a specific version as applied without re-running it
```
Use `repair` carefully — it edits the history table, not the schema. Confirm what actually changed live before deciding a migration should be marked as applied.

---

## Sentry alert / crash spike triage

Crash reporting was wired in `src/lib/sentry.ts`, gated on `EXPO_PUBLIC_SENTRY_DSN` and disabled whenever `__DEV__` is true (so local dev never pollutes the project). DSN was verified live via a direct envelope POST during setup, but the actual React Native SDK crash-capture path (native module → Sentry, on a real device) was **not** end-to-end verified — only the network/DSN path was.

**If Sentry seems silent during a known crash:**
1. Confirm the build isn't Expo Go — `@sentry/react-native` has native modules and requires a dev build or EAS build, same constraint as `expo-notifications`.
2. Confirm `EXPO_PUBLIC_SENTRY_DSN` was actually baked into that build (it's read at build time via Expo's env loader, not runtime) — a build made before the DSN was set won't have it.
3. Check `metro.config.js` is being used (it wraps Expo's default config with `getSentryExpoConfig` for source-map annotation) — without it, you'd still get crash reports, just with unreadable minified stack traces instead of real file/line.

**Triage a real spike:**
1. Sentry dashboard → Issues, sort by event count / first seen.
2. Cross-reference the release/build version against recent EAS builds — a spike right after a build going out usually means a regression in that build, not an infra issue.
3. `logger: 'claude-code-dsn-verification'` events are the one-off setup verification ping — safe to ignore/resolve, not a real signal.

---

## Local dev: Docker broken / `supabase start` fails

**This machine specifically:** the `C:` drive backing Docker Desktop's WSL2 engine has repeatedly filled to near-zero free space, which breaks the Docker daemon entirely (`docker info` fails with a pipe/connection error, not a disk-specific one — easy to misdiagnose as a Docker bug). `supabase start` / `supabase db reset` will fail the same way.

**Check first:** `df -h /` (via Git Bash) or `Get-PSDrive C` (PowerShell) before spending time debugging migration SQL — if it's disk space, no amount of migration fixing will help.

**Don't** run `docker system prune` or delete anything to free space without asking — what else is using the disk isn't known, and it's not this project's call to make.

**Workaround — throwaway native Postgres** (separate from the machine's existing native Postgres service at `C:\Program Files\PostgreSQL\18\bin`, which is password-protected and not to be touched):
```bash
initdb -D <scratch>/pgtest_data -U postgres -A trust --no-locale -E UTF8
pg_ctl -D <scratch>/pgtest_data -o "-p 5544" -l <scratch>/pgtest_log.txt start
psql -h localhost -p 5544 -U postgres -d postgres -f <migration-or-test>.sql
pg_ctl -D <scratch>/pgtest_data stop   # cleanup when done
```
This gives real functional verification of a migration's SQL without touching Docker. It won't replay the *full* migration chain (that needs `supabase db reset` against a real Supabase-shaped Postgres) — for a full-chain check, either fix the disk space and use Docker, or cross-check the specific tables/functions the migration touches against the live linked project directly (`supabase db query --linked`), which catches most of what a full local replay would.

**If testing several migrations in a row:** don't `supabase db reset` after every single one — batch the fixes, verify each directly against a running instance (local or scratch), and only do one full-chain reset at the end. Repeated resets churn through Docker's image/container layers fast and are a direct contributor to the disk-full failure mode above.
