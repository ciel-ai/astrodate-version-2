import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://json.astrologyapi.com/v1';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = Deno.env.get('ASTROLOGY_API_USER_ID');
    const apiKey = Deno.env.get('ASTROLOGY_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!userId || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing Astrology API credentials" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Requires a real signed-in user -- this proxies a paid external API with
    // no rate limiting of its own, so without this check anyone holding the
    // bundled (effectively public) anon key could drive unlimited billed
    // calls (the gateway's own JWT check accepts the anon key, not just a
    // real user session).
    const reqAuthHeader = req.headers.get('Authorization');
    if (!reqAuthHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    const userAuthClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: reqAuthHeader } },
    });
    const { data: userAuthData, error: userAuthError } = await userAuthClient.auth.getUser();
    if (userAuthError || !userAuthData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const authHeader = 'Basic ' + btoa(userId + ':' + apiKey);
    const commonHeaders = {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      'Accept-Language': 'en'
    };

    // Separate admin client (service role key, no user JWT override) for the
    // cache table and quota RPC -- userAuthClient above carries the caller's
    // own JWT in its Authorization header, which resolves to the
    // `authenticated` role, not service_role. increment_ai_usage is locked to
    // service_role only (20260710160000_function_grant_lockdown.sql), and
    // place_search_cache has no client-facing policy at all.
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const payload = await req.json();
    const { type } = payload;

    if (type === 'search') {
      const { place } = payload;

      // Place-name search results are static (a place's coordinates don't
      // change), so cache indefinitely keyed on the normalized query --
      // place names repeat heavily across a whole user base, so this avoids
      // paying for the same lookup over and over. Collapsed whitespace +
      // lowercase so "New York", " new york ", and "new  york" all hit the
      // same cache row.
      const queryKey = String(place ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
      if (!queryKey) {
        return new Response(JSON.stringify({ results: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cached } = await serviceClient
        .from('place_search_cache')
        .select('results')
        .eq('query_key', queryKey)
        .maybeSingle();

      if (cached) {
        return new Response(JSON.stringify({ results: cached.results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only a cache miss actually spends quota -- repeated searches for
      // already-cached places (the common case) stay free.
      const { data: withinQuota, error: quotaError } = await serviceClient.rpc(
        'increment_ai_usage',
        { p_user: userAuthData.user.id, p_endpoint: 'astro-geo-search', p_limit: 60 },
      );
      if (!quotaError && !withinQuota) {
        return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      const body = JSON.stringify({
        place,
        maxRows: 10
      });

      const res = await fetchWithTimeout(`${BASE_URL}/geo_details`, {
        method: 'POST',
        headers: commonHeaders,
        body
      }, 15000);

      if (!res.ok) {
        let apiErrorBody = '';
        try { apiErrorBody = await res.text(); } catch {}
        console.error(`[astro-geo] geo_details ${res.status}:`, apiErrorBody);
        return new Response(JSON.stringify({ error: "Failed to fetch geo details", status: res.status, detail: apiErrorBody }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();

      // The frontend expects { results: [{ place_name, latitude, longitude, timezone_id }] }
      // AstrologyAPI returns { geonames: [...] }
      const results = (data.geonames || []).map((geo: any) => ({
        place_name: geo.place_name,
        latitude: parseFloat(geo.latitude),
        longitude: parseFloat(geo.longitude),
        timezone_id: geo.timezone_id
      }));

      // Best-effort -- a cache write failure shouldn't fail the request the
      // user is actually waiting on.
      if (results.length > 0) {
        await serviceClient
          .from('place_search_cache')
          .upsert({ query_key: queryKey, results }, { onConflict: 'query_key' })
          .then(({ error: cacheError }) => {
            if (cacheError) console.error('[astro-geo] cache write failed', cacheError);
          });
      }

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (type === 'timezone') {
      const { latitude, longitude, date } = payload;

      // Not cached -- unlike place search, this is called at most once or
      // twice per user (birth-details submit, occasional cosmic-identity
      // recompute), so there's no repeat-call waste to eliminate, and
      // rounding lat/lon for a cache key risks shifting the DST-sensitive
      // result for anyone near a timezone boundary. Still quota-capped like
      // every other paid-API path.
      const { data: withinQuota, error: quotaError } = await serviceClient.rpc(
        'increment_ai_usage',
        { p_user: userAuthData.user.id, p_endpoint: 'astro-geo-timezone', p_limit: 15 },
      );
      if (!quotaError && !withinQuota) {
        return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 429,
        });
      }

      const body = JSON.stringify({
        latitude,
        longitude,
        date, // Expected DD-MM-YYYY
      });

      const res = await fetchWithTimeout(`${BASE_URL}/timezone_with_dst`, {
        method: 'POST',
        headers: commonHeaders,
        body
      }, 15000);

      if (!res.ok) {
        let apiErrorBody = '';
        try { apiErrorBody = await res.text(); } catch {}
        console.error(`[astro-geo] timezone_with_dst ${res.status}:`, apiErrorBody);
        return new Response(JSON.stringify({ error: "Failed to fetch timezone", status: res.status, detail: apiErrorBody }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();

      // Frontend expects data?.tzone
      return new Response(JSON.stringify({ tzone: data.timezone }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid type" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Invalid request' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
