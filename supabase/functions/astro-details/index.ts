/**
 * Required Secrets in Supabase Dashboard -> Edge Functions -> astro-details -> Secrets:
 * ASTROLOGY_API_USER_ID
 * ASTROLOGY_API_KEY
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetch-with-timeout.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BASE_URL = 'https://json.astrologyapi.com/v1';

type AstroRequestPayload = {
  mode?: 'basic' | 'full';
  day?: number;
  month?: number;
  year?: number;
  hour?: number;
  min?: number;
  lat?: number;
  lon?: number;
  tzone?: number;
};

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
      console.error('❌ MISSING ASTROLOGY API CREDENTIALS');
      return new Response(JSON.stringify({
        error: 'astro_api_not_configured',
        message: 'Set ASTROLOGY_API_USER_ID and ASTROLOGY_API_KEY in Edge Function secrets'
      }), {
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

    const payload = await req.json() as AstroRequestPayload;
    const { mode } = payload;

    // Per-user daily cap on this paid, per-call-billed API. The auth check
    // above only proves the caller is a real signed-in user -- it doesn't
    // stop a single account from driving unbounded billed calls. Separate
    // admin client (service role key, no user JWT override) because
    // increment_ai_usage is locked to service_role only (see
    // 20260710160000_function_grant_lockdown.sql) -- userAuthClient carries
    // the caller's own JWT in its Authorization header, which resolves to
    // the `authenticated` role, not service_role, and would be rejected.
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    const usageLimit = mode === 'full' ? 20 : 15;
    const { data: withinQuota, error: quotaError } = await adminClient.rpc(
      'increment_ai_usage',
      { p_user: userAuthData.user.id, p_endpoint: `astro-details-${mode ?? 'unknown'}`, p_limit: usageLimit },
    );
    if (quotaError) {
      console.error('[astro-details] quota RPC error', quotaError);
    } else if (!withinQuota) {
      return new Response(JSON.stringify({ error: 'quota_exceeded' }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 429,
      });
    }

    if (mode === 'basic') {
      const { day, month, year, hour, min, lat, lon, tzone } = payload;
      const body = JSON.stringify({ day, month, year, hour, min, lat, lon, tzone });

      // `planets/tropical`         → Western sun sign + inner planets (tropical zodiac)
      // `daily_nakshatra_prediction` → sidereal birth Moon sign (Rashi) + birth Nakshatra.
      //   Nakshatra MUST be sidereal, so it comes from this endpoint (never from the
      //   tropical planets). Both are computed from the exact birth day/time/place/tzone,
      //   so accuracy depends entirely on the caller passing a DST-correct `tzone`.
      const [planetsRes, nakshatraRes] = await Promise.all([
        fetchWithTimeout(`${BASE_URL}/planets/tropical`, { method: 'POST', headers: commonHeaders, body }, 15000),
        fetchWithTimeout(`${BASE_URL}/daily_nakshatra_prediction`, { method: 'POST', headers: commonHeaders, body }, 15000)
      ]);

      if (!planetsRes.ok || !nakshatraRes.ok) {
        let planetsBody = '', nakshatraBody = '';
        try { planetsBody = await planetsRes.text(); } catch {}
        try { nakshatraBody = await nakshatraRes.text(); } catch {}
        console.error(`[astro-details] basic mode errors — planets ${planetsRes.status}: ${planetsBody} | nakshatra ${nakshatraRes.status}: ${nakshatraBody}`);
        return new Response(JSON.stringify({
          error: "Failed to fetch from Astrology API",
          status: { planets: planetsRes.status, nakshatra: nakshatraRes.status },
          endpoint: mode
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const planetsData = await planetsRes.json();
      const nakshatraData = await nakshatraRes.json();

      let venus_sign, mars_sign, mercury_sign, rising_sign, western_sign;

      if (Array.isArray(planetsData)) {
        for (const p of planetsData) {
          if (p.name === 'Venus') venus_sign = p.sign;
          if (p.name === 'Mars') mars_sign = p.sign;
          if (p.name === 'Mercury') mercury_sign = p.sign;
          if (p.name === 'Ascendant') rising_sign = p.sign;
          if (p.name === 'Sun') {
            western_sign = p.sign ? p.sign.charAt(0).toUpperCase() + p.sign.slice(1).toLowerCase() : undefined;
          }
        }
      }

      const titleCase = (s: unknown) =>
        typeof s === 'string' && s.length
          ? s.trim().replace(/\b\w/g, (c) => c.toUpperCase())
          : undefined;

      // Sidereal birth Moon data. Field names per AstrologyAPI docs.
      const indian_sign = titleCase(nakshatraData.birth_moon_sign);
      const nakshatra_name = titleCase(nakshatraData.birth_moon_nakshatra);

      // Compute dominant element
      const elements = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
      const mapSignToElement = (sign: string | undefined) => {
        if (!sign) return;
        const s = sign.toLowerCase();
        if (['aries', 'leo', 'sagittarius'].includes(s)) elements.Fire++;
        if (['taurus', 'virgo', 'capricorn'].includes(s)) elements.Earth++;
        if (['gemini', 'libra', 'aquarius'].includes(s)) elements.Air++;
        if (['cancer', 'scorpio', 'pisces'].includes(s)) elements.Water++;
      };

      [western_sign, venus_sign, mars_sign, mercury_sign, rising_sign].forEach(mapSignToElement);

      let dominant_element = 'Fire';
      let max = -1;
      for (const [el, count] of Object.entries(elements)) {
        if (count > max) { max = count; dominant_element = el; }
      }

      return new Response(JSON.stringify({
        western_sign, indian_sign, nakshatra_name,
        venus_sign, mars_sign, mercury_sign, rising_sign,
        dominant_element,
        chart_json: { planets: planetsData, nakshatra: nakshatraData }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (mode === 'full') {
      const { hour, min, lat, lon, tzone } = payload;
      const today = new Date();
      const body = JSON.stringify({
        day: today.getDate(),
        month: today.getMonth() + 1,
        year: today.getFullYear(),
        hour, min, lat, lon, tzone
      });

      const res = await fetchWithTimeout(`${BASE_URL}/daily_nakshatra_prediction`, { method: 'POST', headers: commonHeaders, body }, 15000);

      if (!res.ok) {
        let apiErrorBody = '';
        try { apiErrorBody = await res.text(); } catch {}
        console.error(`[astro-details] daily_nakshatra_prediction ${res.status}:`, apiErrorBody);
        return new Response(JSON.stringify({
          error: "Failed to fetch daily prediction",
          status: res.status,
          detail: apiErrorBody,
          endpoint: 'daily_nakshatra_prediction'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 502,
        });
      }

      const data = await res.json();
      return new Response(JSON.stringify({
        birth_moon_sign: data.birth_moon_sign,
        birth_moon_nakshatra: data.birth_moon_nakshatra,
        prediction: data.prediction
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid mode" }), {
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
