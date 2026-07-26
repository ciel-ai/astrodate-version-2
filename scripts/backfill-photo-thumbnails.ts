/**
 * scripts/backfill-photo-thumbnails.ts
 *
 * One-time sweep for existing users: every primary photo uploaded before
 * generate-photo-thumbnail existed has user_photos.blurred_thumbnail_url =
 * NULL, so their locked "who liked me" card would show nothing until they
 * next touch their photos. This calls the edge function once per such row.
 *
 * Not a permanent pg_cron job (unlike synastry-prewarm/push-notification's
 * queue-drain workers) -- this is a genuine one-off catch-up. Every future
 * primary-photo change is already covered by the fire-and-forget triggers in
 * src/lib/user-photos.ts (uploadUserPhoto, setPrimaryPhoto), so no ongoing
 * worker is needed once this has run.
 *
 * Authenticates to generate-photo-thumbnail the same way its "trusted
 * internal caller" path expects: presents the service-role key itself as the
 * bearer token (matching the function's own admin client's trust level),
 * rather than provisioning a separate one-time-use worker secret in Vault.
 *
 * Idempotent: generate-photo-thumbnail short-circuits on rows that already
 * have blurred_thumbnail_url, so re-running this is always safe.
 *
 * Run with: npx tsx --env-file=.env scripts/backfill-photo-thumbnails.ts
 *
 * Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js';
// supabase-js always constructs a realtime client under the hood, which
// needs a WebSocket constructor -- unused here, but Node 20 (unlike 22+) has
// no native `WebSocket` global, so createClient() throws without this.
import ws from 'ws';

const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  realtime: { transport: ws as any },
});

async function backfill() {
  const { data: photos, error } = await supabase
    .from('user_photos')
    .select('id')
    .eq('is_primary', true)
    .is('blurred_thumbnail_url', null);

  if (error) {
    console.error('Failed to list primary photos needing a thumbnail:', error);
    process.exit(1);
  }

  if (!photos || photos.length === 0) {
    console.log('Nothing to backfill -- every primary photo already has a blurred thumbnail.');
    return;
  }

  console.log(`Backfilling ${photos.length} primary photo(s)...`);

  let succeeded = 0;
  let failed = 0;

  for (const [index, photo] of photos.entries()) {
    const { data, error: invokeError } = await supabase.functions.invoke('generate-photo-thumbnail', {
      body: { photo_id: photo.id },
    });

    if (invokeError || !data?.success) {
      failed++;
      console.error(`[${index + 1}/${photos.length}] FAILED photo_id=${photo.id}:`, invokeError ?? data);
    } else {
      succeeded++;
      if ((index + 1) % 10 === 0 || index + 1 === photos.length) {
        console.log(`[${index + 1}/${photos.length}] processed (${succeeded} ok, ${failed} failed so far)`);
      }
    }
  }

  console.log(`Done. ${succeeded} succeeded, ${failed} failed out of ${photos.length}.`);
  if (failed > 0) process.exit(1);
}

backfill();
