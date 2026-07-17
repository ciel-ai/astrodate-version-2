import { createClient } from '@supabase/supabase-js';

const url = 'https://frgckqxfkfjacrutcobg.supabase.co';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyZ2NrcXhma2ZqYWNydXRjb2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MjQxNzAsImV4cCI6MjA5ODMwMDE3MH0.NosXglH1s_s8WgpGXFU5Y4YV1idpo4dqlpFarJaehlg';

const supabase = createClient(url, anonKey);

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
