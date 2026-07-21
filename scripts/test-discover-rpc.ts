/**
 * scripts/test-discover-rpc.ts
 *
 * One-off manual check that get_discover_deck responds for the signed-in
 * anon session. Reads project URL/key from env instead of hardcoding them,
 * same convention as scripts/test-daily-insights.ts.
 *
 * Run with: npx tsx --env-file=.env scripts/test-discover-rpc.ts
 *
 * Required env vars: SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 */
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV = ['SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!);

async function test() {
  console.log('Testing get_discover_deck RPC call...');
  try {
    const { data, error } = await supabase.rpc('get_discover_deck');
    if (error) {
      console.error('RPC Error:', error);
    } else {
      console.log('RPC Success:', data);
    }
  } catch (err) {
    console.error('Exception:', err);
  }
}

test();
