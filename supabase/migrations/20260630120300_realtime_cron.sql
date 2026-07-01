-- ============================================================================
-- AstroDate — Realtime Publication, pg_cron Jobs, Synastry Cache, Ashtakoota
-- (squashed from legacy migrations 001-103)
-- ============================================================================
-- Covers: realtime publication setup (025), pg_cron jobs (042 activity-decay +
-- daily-picks, 063/100/101 push-notification drain worker), synastry cache
-- tables (037 synastry_cache, 044 synastry_cache_details, 053 prewarm jobs +
-- staleness tracking) and ashtakoota (Vedic synastry) columns (073).
-- ============================================================================


-- ============================================================================
-- EXTENSIONS required for cron + outbound HTTP from cron jobs
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ============================================================================
-- REALTIME PUBLICATION  (025 create)
-- (user_subscriptions realtime add lives in the subscriptions migration file)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_online_status'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_online_status;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END
$$;


-- ============================================================================
-- TABLE: synastry_cache  (033 create, 036 +signal_score, 053 +is_stale,
-- western_score/indian_score/personality_score NEW — not in legacy source)
-- ----------------------------------------------------------------------------
-- astro_score remains the combined total (what Free tier sees — "Total score
-- only" per the subscription plan). The three breakdown columns below are
-- added so the upcoming 45/45/10 scoring rewrite has somewhere to cache the
-- per-component split that Astro+/AstroX's "Full 45/45/10 breakdown" feature
-- reads from. Columns only — no scoring logic populates them yet.
-- NOTE: RLS on this table currently allows any authenticated user to read
-- ALL columns, including these new breakdown ones. That needs tightening
-- (same RPC-gating pattern as synastry_cache_details / daily_nakshatra_cache)
-- before the breakdown columns actually go live with real tier-gated data —
-- flagged for the scoring-rewrite phase, not fixed here.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.synastry_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  astro_score NUMERIC NOT NULL,
  western_score NUMERIC,
  indian_score NUMERIC,
  personality_score NUMERIC,
  signal_score NUMERIC DEFAULT 0,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_a_id, user_b_id),
  CHECK (user_a_id < user_b_id)
);

ALTER TABLE public.synastry_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read synastry cache" ON public.synastry_cache;
CREATE POLICY "Authenticated users read synastry cache" ON public.synastry_cache
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_synastry_cache_lookup ON public.synastry_cache(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_synastry_cache_user_a_id ON public.synastry_cache (user_a_id);
CREATE INDEX IF NOT EXISTS idx_synastry_cache_user_b_id ON public.synastry_cache (user_b_id);
CREATE INDEX IF NOT EXISTS idx_synastry_cache_fresh_lookup
  ON public.synastry_cache (user_a_id, user_b_id, computed_at DESC)
  WHERE is_stale = false;


-- ============================================================================
-- TABLE: synastry_cache_details  (044 create, 053 +is_stale, 073 +ashtakoota_*)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.synastry_cache_details (
  user_a_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Planet-level scores (0-10, NULL means insufficient chart data)
  sun_score              NUMERIC(4,2),
  moon_score             NUMERIC(4,2),
  venus_score            NUMERIC(4,2),
  mars_score             NUMERIC(4,2),
  mercury_score          NUMERIC(4,2),

  -- Composite flag
  dominant_element_match BOOLEAN,

  -- Human-readable output for the UI
  compatibility_summary  TEXT,
  badges                 JSONB,

  -- Ashtakoota (Vedic) synastry — added 073. Computed by the compute-synastry
  -- Edge Function (not by get_synastry_detail itself); NULL until that job runs.
  ashtakoota_score        NUMERIC(5,2),   -- 0-36 gunas
  ashtakoota_detail       JSONB,          -- full koota breakdown

  is_stale                BOOLEAN NOT NULL DEFAULT false,
  computed_at             TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (user_a_id, user_b_id),
  CONSTRAINT check_user_order CHECK (user_a_id < user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_lookup
  ON public.synastry_cache_details (user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_user_a_id ON public.synastry_cache_details (user_a_id);
CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_user_b_id ON public.synastry_cache_details (user_b_id);
CREATE INDEX IF NOT EXISTS idx_synastry_cache_details_fresh_lookup
  ON public.synastry_cache_details (user_a_id, user_b_id, computed_at DESC)
  WHERE is_stale = false;

ALTER TABLE public.synastry_cache_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read synastry cache" ON public.synastry_cache_details;
CREATE POLICY "Authenticated users can read synastry cache"
  ON public.synastry_cache_details
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can write synastry cache" ON public.synastry_cache_details;
CREATE POLICY "Service role can write synastry cache"
  ON public.synastry_cache_details
  FOR ALL
  USING (auth.role() = 'service_role');


-- ============================================================================
-- TABLE: synastry_prewarm_jobs  (053 create — async prewarm queue)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.synastry_prewarm_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  candidate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pair_a_id UUID GENERATED ALWAYS AS (LEAST(user_id, candidate_user_id)) STORED,
  pair_b_id UUID GENERATED ALWAYS AS (GREATEST(user_id, candidate_user_id)) STORED,
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  CONSTRAINT synastry_prewarm_jobs_no_self CHECK (user_id <> candidate_user_id),
  CONSTRAINT synastry_prewarm_jobs_status_check
    CHECK (status IN ('pending', 'processing', 'processed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_synastry_prewarm_jobs_active_pair
  ON public.synastry_prewarm_jobs (pair_a_id, pair_b_id)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_synastry_prewarm_jobs_status_created
  ON public.synastry_prewarm_jobs (status, created_at);

CREATE INDEX IF NOT EXISTS idx_synastry_prewarm_jobs_user_status
  ON public.synastry_prewarm_jobs (user_id, status, created_at DESC);

ALTER TABLE public.synastry_prewarm_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages synastry prewarm jobs" ON public.synastry_prewarm_jobs;
CREATE POLICY "Service role manages synastry prewarm jobs"
  ON public.synastry_prewarm_jobs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================================
-- get_sign_compatibility(sign_a, sign_b)  (044 create — unchanged thereafter)
-- Simple element-based 0-10 compatibility score, distinct from the
-- compute_astro_score helper get_western_sign_score (which returns 0-1 and
-- factors in modality). Used by get_synastry_detail for the planet-by-planet
-- breakdown shown in the synastry detail screen.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_sign_compatibility(sign_a TEXT, sign_b TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  a TEXT := lower(coalesce(sign_a, ''));
  b TEXT := lower(coalesce(sign_b, ''));
  elem_a TEXT;
  elem_b TEXT;
  score NUMERIC := NULL;
BEGIN
  IF a = '' OR b = '' THEN
    RETURN NULL;
  END IF;

  CASE a
    WHEN 'aries' THEN elem_a := 'fire';
    WHEN 'leo' THEN elem_a := 'fire';
    WHEN 'sagittarius' THEN elem_a := 'fire';
    WHEN 'taurus' THEN elem_a := 'earth';
    WHEN 'virgo' THEN elem_a := 'earth';
    WHEN 'capricorn' THEN elem_a := 'earth';
    WHEN 'gemini' THEN elem_a := 'air';
    WHEN 'libra' THEN elem_a := 'air';
    WHEN 'aquarius' THEN elem_a := 'air';
    WHEN 'cancer' THEN elem_a := 'water';
    WHEN 'scorpio' THEN elem_a := 'water';
    WHEN 'pisces' THEN elem_a := 'water';
    ELSE elem_a := NULL;
  END CASE;

  CASE b
    WHEN 'aries' THEN elem_b := 'fire';
    WHEN 'leo' THEN elem_b := 'fire';
    WHEN 'sagittarius' THEN elem_b := 'fire';
    WHEN 'taurus' THEN elem_b := 'earth';
    WHEN 'virgo' THEN elem_b := 'earth';
    WHEN 'capricorn' THEN elem_b := 'earth';
    WHEN 'gemini' THEN elem_b := 'air';
    WHEN 'libra' THEN elem_b := 'air';
    WHEN 'aquarius' THEN elem_b := 'air';
    WHEN 'cancer' THEN elem_b := 'water';
    WHEN 'scorpio' THEN elem_b := 'water';
    WHEN 'pisces' THEN elem_b := 'water';
    ELSE elem_b := NULL;
  END CASE;

  IF elem_a IS NULL OR elem_b IS NULL THEN
    RETURN NULL;
  END IF;

  IF a = b THEN
    score := 10.00;
  ELSIF elem_a = elem_b THEN
    score := 8.00;
  ELSIF (elem_a = 'fire' AND elem_b = 'air') OR (elem_a = 'air' AND elem_b = 'fire') THEN
    score := 6.00;
  ELSIF (elem_a = 'earth' AND elem_b = 'water') OR (elem_a = 'water' AND elem_b = 'earth') THEN
    score := 6.00;
  ELSE
    score := 2.00;
  END IF;

  RETURN score;
END;
$$;


-- ============================================================================
-- get_synastry_detail(user_x, user_y)  (044 create, 053 search_path hardening +
-- is_stale check, 073 FINAL — adds ashtakoota_score/ashtakoota_detail to the
-- return shape; ashtakoota values are always NULL from this function itself,
-- populated separately by the compute-synastry Edge Function)
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_synastry_detail(UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_synastry_detail(user_x UUID, user_y UUID)
RETURNS TABLE (
  sun_score              NUMERIC,
  moon_score             NUMERIC,
  venus_score            NUMERIC,
  mars_score             NUMERIC,
  mercury_score          NUMERIC,
  dominant_element_match BOOLEAN,
  compatibility_summary  TEXT,
  badges                 JSONB,
  computed_at            TIMESTAMPTZ,
  ashtakoota_score       NUMERIC,
  ashtakoota_detail      JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_a UUID;
  v_b UUID;
  v_cached public.synastry_cache_details%ROWTYPE;
  a_rec public.astro_details%ROWTYPE;
  b_rec public.astro_details%ROWTYPE;
  v_sun     NUMERIC(4,2) := 5;
  v_moon    NUMERIC(4,2) := 5;
  v_venus   NUMERIC(4,2) := 5;
  v_mars    NUMERIC(4,2) := 5;
  v_mercury NUMERIC(4,2) := 5;
  v_elem    BOOLEAN      := false;
  v_summary TEXT;
  v_badges  JSONB        := '[]'::JSONB;
BEGIN
  IF user_x < user_y THEN
    v_a := user_x; v_b := user_y;
  ELSE
    v_a := user_y; v_b := user_x;
  END IF;

  SELECT * INTO v_cached
  FROM public.synastry_cache_details
  WHERE user_a_id = v_a
    AND user_b_id = v_b
    AND is_stale = false;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_cached.sun_score, v_cached.moon_score, v_cached.venus_score,
      v_cached.mars_score, v_cached.mercury_score,
      v_cached.dominant_element_match, v_cached.compatibility_summary,
      v_cached.badges, v_cached.computed_at,
      v_cached.ashtakoota_score, v_cached.ashtakoota_detail;
    RETURN;
  END IF;

  SELECT * INTO a_rec FROM public.astro_details WHERE user_id = v_a LIMIT 1;
  SELECT * INTO b_rec FROM public.astro_details WHERE user_id = v_b LIMIT 1;

  IF a_rec IS NOT NULL AND b_rec IS NOT NULL THEN
    v_sun     := COALESCE(public.get_sign_compatibility(a_rec.western_sign, b_rec.western_sign), 5);
    v_moon    := COALESCE(public.get_sign_compatibility(a_rec.indian_sign,  b_rec.indian_sign),  5);
    v_venus   := COALESCE(public.get_sign_compatibility(a_rec.venus_sign,   b_rec.venus_sign),   5);
    v_mars    := COALESCE(public.get_sign_compatibility(a_rec.mars_sign,    b_rec.mars_sign),    5);
    v_mercury := COALESCE(public.get_sign_compatibility(a_rec.mercury_sign, b_rec.mercury_sign), 5);
    v_elem    := COALESCE(a_rec.dominant_element = b_rec.dominant_element, false);

    v_summary := CASE
      WHEN v_venus >= 8 THEN 'Your Venus signs suggest strong romantic reassurance and deep love language alignment.'
      WHEN v_moon  >= 8 THEN 'Your Moon signs indicate exceptional emotional understanding and intuitive connection.'
      WHEN v_sun   >= 8 THEN 'Your Sun signs reflect a powerful core identity match — you naturally inspire each other.'
      WHEN v_mars  >= 8 THEN 'Your Mars signs show high physical chemistry and shared drive.'
      WHEN v_mercury >= 8 THEN 'Your Mercury signs promise effortless communication and lively intellectual exchange.'
      WHEN v_elem       THEN 'Matching dominant elements create a natural rhythm and elemental harmony between you.'
      ELSE 'Your charts reveal a unique blend of contrasts and complementary energies worth exploring.'
    END;

    IF v_sun >= 9 AND v_moon >= 9 THEN
      v_badges := v_badges || '["Twin Flames"]'::JSONB;
    END IF;
    IF v_venus >= 8 AND v_mars >= 8 THEN
      v_badges := v_badges || '["Fiery Passion"]'::JSONB;
    END IF;
    IF v_mercury >= 8 THEN
      v_badges := v_badges || '["Cosmic Conversationalists"]'::JSONB;
    END IF;
    IF v_elem THEN
      v_badges := v_badges || '["Elemental Match"]'::JSONB;
    END IF;
  ELSE
    v_summary := 'Complete your birth chart to unlock full compatibility insights.';
  END IF;

  INSERT INTO public.synastry_cache_details (
    user_a_id, user_b_id,
    sun_score, moon_score, venus_score, mars_score, mercury_score,
    dominant_element_match, compatibility_summary, badges,
    computed_at, is_stale
  ) VALUES (
    v_a, v_b,
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges,
    now(), false
  )
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
    sun_score              = EXCLUDED.sun_score,
    moon_score             = EXCLUDED.moon_score,
    venus_score            = EXCLUDED.venus_score,
    mars_score             = EXCLUDED.mars_score,
    mercury_score          = EXCLUDED.mercury_score,
    dominant_element_match = EXCLUDED.dominant_element_match,
    compatibility_summary  = EXCLUDED.compatibility_summary,
    badges                 = EXCLUDED.badges,
    computed_at            = now(),
    is_stale               = false;

  RETURN QUERY SELECT
    v_sun, v_moon, v_venus, v_mars, v_mercury,
    v_elem, v_summary, v_badges, now()::TIMESTAMPTZ,
    NULL::NUMERIC, NULL::JSONB;
END;
$$;


-- ============================================================================
-- Synastry cache staleness trigger  (053 create — marks cache rows stale
-- instead of deleting them when a user's astro_details change)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_synastry_cache_stale_for_astro_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  UPDATE public.synastry_cache
  SET is_stale = true
  WHERE user_a_id = v_user_id OR user_b_id = v_user_id;

  UPDATE public.synastry_cache_details
  SET is_stale = true
  WHERE user_a_id = v_user_id OR user_b_id = v_user_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_synastry_cache_stale_on_astro_change ON public.astro_details;
CREATE TRIGGER trg_mark_synastry_cache_stale_on_astro_change
AFTER INSERT OR UPDATE OR DELETE ON public.astro_details
FOR EACH ROW
EXECUTE FUNCTION public.mark_synastry_cache_stale_for_astro_change();


-- ============================================================================
-- Synastry prewarm queue helpers  (053 create — unchanged thereafter)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.synastry_location_priority(
  viewer_location TEXT,
  candidate_location TEXT
)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN viewer_location IS NULL OR candidate_location IS NULL THEN 1
    WHEN lower(trim(viewer_location)) = lower(trim(candidate_location)) THEN 0
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_synastry_prewarm(p_user_id UUID)
RETURNS TABLE(enqueued_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Cannot enqueue prewarm for another user';
  END IF;

  WITH viewer AS (
    SELECT
      up.user_id,
      up.gender,
      up.location,
      EXTRACT(YEAR FROM AGE(CURRENT_DATE, ad.birth_date))::INT AS age,
      COALESCE(pref.min_age, 18) AS min_age,
      COALESCE(pref.max_age, 65) AS max_age,
      NULLIF(lower(trim(COALESCE(pref.gender_preference, ''))), '') AS gender_preference
    FROM public.user_profiles up
    LEFT JOIN public.astro_details ad ON ad.user_id = up.user_id
    LEFT JOIN public.user_preferences pref ON pref.user_id = up.user_id
    WHERE up.user_id = p_user_id
  ),
  candidate_activity AS (
    SELECT us.user_id, MAX(us.created_at) AS last_signal_at
    FROM public.user_signals us
    GROUP BY us.user_id
  ),
  ranked_candidates AS (
    SELECT
      c.user_id AS candidate_user_id
    FROM viewer v
    JOIN public.user_profiles c ON c.user_id <> v.user_id
    LEFT JOIN public.astro_details cad ON cad.user_id = c.user_id
    LEFT JOIN public.user_preferences cpref ON cpref.user_id = c.user_id
    LEFT JOIN public.user_online_status os ON os.user_id = c.user_id
    LEFT JOIN candidate_activity ca ON ca.user_id = c.user_id
    LEFT JOIN public.synastry_cache sc
      ON sc.user_a_id = LEAST(v.user_id, c.user_id)
     AND sc.user_b_id = GREATEST(v.user_id, c.user_id)
     AND sc.is_stale = false
     AND sc.computed_at >= now() - INTERVAL '7 days'
    WHERE cad.user_id IS NOT NULL
      AND sc.user_a_id IS NULL
      AND c.user_id NOT IN (
        SELECT ul.liked_user_id
        FROM public.user_likes ul
        WHERE ul.user_id = v.user_id
      )
      AND (
        v.gender_preference IS NULL
        OR v.gender_preference IN ('any', 'all', 'everyone')
        OR lower(COALESCE(c.gender, '')) = v.gender_preference
      )
      AND (
        cpref.gender_preference IS NULL
        OR lower(trim(cpref.gender_preference)) IN ('any', 'all', 'everyone', '')
        OR lower(COALESCE(v.gender, '')) = lower(trim(cpref.gender_preference))
      )
      AND (
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, cad.birth_date))::INT
          BETWEEN v.min_age AND v.max_age
      )
      AND (
        v.age IS NULL
        OR v.age BETWEEN COALESCE(cpref.min_age, 18) AND COALESCE(cpref.max_age, 65)
      )
    ORDER BY
      CASE WHEN os.is_online THEN 0 ELSE 1 END,
      public.synastry_location_priority(v.location, c.location),
      COALESCE(os.last_seen, ca.last_signal_at, c.created_at) DESC
    LIMIT 25
  ),
  inserted AS (
    INSERT INTO public.synastry_prewarm_jobs (user_id, candidate_user_id)
    SELECT p_user_id, candidate_user_id
    FROM ranked_candidates
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted;

  RETURN QUERY SELECT v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_synastry_prewarm_jobs(p_limit INTEGER DEFAULT 10)
RETURNS TABLE(id UUID, user_id UUID, candidate_user_id UUID, retry_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT j.id
    FROM public.synastry_prewarm_jobs j
    WHERE j.status = 'pending'
       OR (j.status = 'failed' AND j.retry_count < 3)
    ORDER BY j.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 10)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.synastry_prewarm_jobs j
  SET status = 'processing',
      last_error = NULL
  FROM picked
  WHERE j.id = picked.id
  RETURNING j.id, j.user_id, j.candidate_user_id, j.retry_count;
END;
$$;

-- NOTE: process_synastry_prewarm_job() calls compute_astro_score() (out of
-- scope — see migration-squash-report.md) in addition to get_signal_score()
-- and get_synastry_detail() (both in scope, defined above/below). Its full
-- body is included here since it is itself in-scope cron/cache plumbing; only
-- the inner compute_astro_score call is a forward-reference to an
-- out-of-scope function body.
CREATE OR REPLACE FUNCTION public.process_synastry_prewarm_job(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.synastry_prewarm_jobs%ROWTYPE;
  v_a UUID;
  v_b UUID;
  v_existing public.synastry_cache%ROWTYPE;
  v_astro_score NUMERIC;
BEGIN
  SELECT * INTO v_job
  FROM public.synastry_prewarm_jobs
  WHERE id = p_job_id
    AND status = 'processing';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'skipped', 'reason', 'job_not_processing');
  END IF;

  v_a := LEAST(v_job.user_id, v_job.candidate_user_id);
  v_b := GREATEST(v_job.user_id, v_job.candidate_user_id);

  SELECT * INTO v_existing
  FROM public.synastry_cache
  WHERE user_a_id = v_a
    AND user_b_id = v_b
    AND is_stale = false
    AND computed_at >= now() - INTERVAL '7 days';

  IF FOUND THEN
    UPDATE public.synastry_prewarm_jobs
    SET status = 'processed',
        processed_at = now()
    WHERE id = p_job_id;

    RETURN jsonb_build_object('status', 'cache_fresh', 'astro_score', v_existing.astro_score);
  END IF;

  v_astro_score := public.compute_astro_score(v_job.user_id, v_job.candidate_user_id);

  INSERT INTO public.synastry_cache (
    user_a_id,
    user_b_id,
    astro_score,
    signal_score,
    computed_at,
    is_stale
  )
  VALUES (
    v_a,
    v_b,
    v_astro_score,
    public.get_signal_score(v_job.user_id, v_job.candidate_user_id),
    now(),
    false
  )
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE SET
    astro_score = EXCLUDED.astro_score,
    signal_score = GREATEST(
      COALESCE(public.synastry_cache.signal_score, 0),
      COALESCE(EXCLUDED.signal_score, 0)
    ),
    computed_at = now(),
    is_stale = false;

  PERFORM *
  FROM public.get_synastry_detail(v_job.user_id, v_job.candidate_user_id);

  UPDATE public.synastry_cache_details
  SET is_stale = false,
      computed_at = now()
  WHERE user_a_id = v_a
    AND user_b_id = v_b;

  UPDATE public.synastry_prewarm_jobs
  SET status = 'processed',
      processed_at = now()
  WHERE id = p_job_id;

  RETURN jsonb_build_object('status', 'processed', 'astro_score', v_astro_score);
EXCEPTION WHEN OTHERS THEN
  UPDATE public.synastry_prewarm_jobs
  SET status = CASE WHEN retry_count + 1 >= 3 THEN 'failed' ELSE 'pending' END,
      retry_count = retry_count + 1,
      last_error = left(SQLERRM, 1000),
      processed_at = CASE WHEN retry_count + 1 >= 3 THEN now() ELSE processed_at END
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'status', 'retry_scheduled',
    'error', SQLERRM
  );
END;
$$;


-- ============================================================================
-- TABLE: user_signals  (037 final — recreated as event log, replacing the 033
-- summary-style version which was DROPped; signal_weight_config + seed weights)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  signal_weight NUMERIC NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own signals" ON public.user_signals;
CREATE POLICY "Users read own signals" ON public.user_signals
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_signals_pair ON public.user_signals(user_id, target_user_id);
CREATE INDEX IF NOT EXISTS idx_user_signals_created ON public.user_signals(created_at DESC);

CREATE TABLE IF NOT EXISTS public.signal_weight_config (
  signal_type TEXT PRIMARY KEY,
  base_weight NUMERIC NOT NULL,
  description TEXT
);

ALTER TABLE public.signal_weight_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read signal config" ON public.signal_weight_config;
CREATE POLICY "Authenticated users read signal config" ON public.signal_weight_config
  FOR SELECT USING (auth.role() = 'authenticated');

INSERT INTO public.signal_weight_config (signal_type, base_weight, description) VALUES
  ('view_profile',   0.5,  'User viewed a profile card'),
  ('view_long',      1.5,  'User viewed a profile for more than 5 seconds'),
  ('like',           3.0,  'User liked a profile'),
  ('super_like',     6.0,  'User super-liked a profile'),
  ('dislike',       -1.0,  'User disliked a profile'),
  ('message_sent',   5.0,  'User sent the first message'),
  ('message_replied',4.0,  'User replied to a message in session')
ON CONFLICT (signal_type) DO NOTHING;


-- ============================================================================
-- get_signal_score / record_signal  (036 create — unchanged thereafter)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_signal_score(p_viewer_id UUID, p_target_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  score NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(
    s.signal_weight *
    CASE
      WHEN s.created_at >= now() - INTERVAL '7 days'  THEN 1.0
      WHEN s.created_at >= now() - INTERVAL '30 days' THEN 0.5
      ELSE 0.2
    END
  ), 0)
  INTO score
  FROM public.user_signals s
  WHERE s.user_id = p_viewer_id
    AND s.target_user_id = p_target_id;
  RETURN ROUND(score::NUMERIC, 4);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_signal(
  p_user_id UUID,
  p_target_id UUID,
  p_signal_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_weight NUMERIC;
  v_a UUID;
  v_b UUID;
  v_new_signal_score NUMERIC;
BEGIN
  SELECT base_weight INTO v_weight
  FROM public.signal_weight_config
  WHERE signal_type = p_signal_type;

  IF v_weight IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.user_signals (user_id, target_user_id, signal_type, signal_weight)
  VALUES (p_user_id, p_target_id, p_signal_type, v_weight);

  v_a := LEAST(p_user_id, p_target_id);
  v_b := GREATEST(p_user_id, p_target_id);

  v_new_signal_score := public.get_signal_score(p_user_id, p_target_id);

  INSERT INTO public.synastry_cache (user_a_id, user_b_id, astro_score, signal_score, computed_at)
  VALUES (v_a, v_b, 0, v_new_signal_score, now())
  ON CONFLICT (user_a_id, user_b_id) DO UPDATE
    SET signal_score = EXCLUDED.signal_score,
        computed_at  = now();
END;
$$;


-- ============================================================================
-- TABLE: daily_nakshatra_cache  (NEW — not in legacy source)
-- ----------------------------------------------------------------------------
-- Shared cache keyed by (nakshatra, date), NOT per-user. There are ~27
-- nakshatras, so this caps the astrology API's daily_nakshatra_prediction
-- endpoint to ~27 calls/day for the entire user base (per the build plan's
-- caching strategy), regardless of how many users share a nakshatra.
--
-- Populated by the refresh-daily-nakshatra-cache cron job below, which calls
-- a new "daily-insights-refresh" Edge Function (not part of these SQL
-- migrations — that function makes the actual HTTPS call to the astrology
-- API and upserts rows here via service_role).
--
-- Always stores the FULL forecast. Tier-gating (Free = basic, Astro+/AstroX =
-- full) happens at READ time in get_my_daily_insight() below, not at write
-- time — this table itself is locked down so no client can read it directly
-- and bypass the gate (same RLS-as-source-of-truth principle as the rest of
-- this schema).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.daily_nakshatra_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nakshatra       TEXT NOT NULL,
  forecast_date   DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Basic fields — shown to ALL tiers (Free included)
  headline        TEXT,
  mood_summary    TEXT,
  lucky_color     TEXT,
  lucky_number    TEXT,

  -- Full fields — Astro+/AstroX only
  full_prediction TEXT,
  love_focus      TEXT,
  career_focus    TEXT,

  raw_response    JSONB,
  computed_at     TIMESTAMPTZ DEFAULT now(),

  UNIQUE (nakshatra, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_nakshatra_cache_lookup
  ON public.daily_nakshatra_cache (nakshatra, forecast_date);

ALTER TABLE public.daily_nakshatra_cache ENABLE ROW LEVEL SECURITY;

-- No SELECT policy for authenticated/anon — direct table reads are denied by
-- default once RLS is enabled with no matching policy. Only service_role
-- (the Edge Function writer) and the SECURITY DEFINER RPC below can read it.
DROP POLICY IF EXISTS "Service role manages daily nakshatra cache" ON public.daily_nakshatra_cache;
CREATE POLICY "Service role manages daily nakshatra cache"
  ON public.daily_nakshatra_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');


-- ============================================================================
-- get_my_daily_insight()  (NEW — not in legacy source)
-- ----------------------------------------------------------------------------
-- Tier-gated read of today's cached forecast for the caller's nakshatra.
-- Free → basic fields only. Astro+/AstroX → full fields too. Matches the
-- build plan's subscription table: "Daily Insights — Free: Basic forecast;
-- Astro+/AstroX: Full report."
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_my_daily_insight()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID := auth.uid();
  v_nakshatra   TEXT;
  v_cache       public.daily_nakshatra_cache%ROWTYPE;
  v_plan_slug   TEXT;
  v_is_paid     BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT nakshatra_name INTO v_nakshatra
  FROM public.astro_details
  WHERE user_id = v_user_id;

  IF v_nakshatra IS NULL THEN
    RETURN jsonb_build_object('status', 'no_birth_chart');
  END IF;

  SELECT * INTO v_cache
  FROM public.daily_nakshatra_cache
  WHERE nakshatra = v_nakshatra
    AND forecast_date = CURRENT_DATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'pending', 'nakshatra', v_nakshatra);
  END IF;

  SELECT pc.plan_slug INTO v_plan_slug
  FROM public.user_subscriptions us
  JOIN public.plan_catalog pc ON pc.id = us.plan_id
  WHERE us.user_id = v_user_id
    AND us.status = 'active'
    AND (us.current_period_end IS NULL OR us.current_period_end > now())
  ORDER BY us.created_at DESC
  LIMIT 1;

  v_plan_slug := COALESCE(v_plan_slug, 'free');
  v_is_paid := (v_plan_slug <> 'free');

  IF v_is_paid THEN
    RETURN jsonb_build_object(
      'status',          'ready',
      'tier',            'full',
      'nakshatra',       v_nakshatra,
      'headline',        v_cache.headline,
      'mood_summary',    v_cache.mood_summary,
      'lucky_color',     v_cache.lucky_color,
      'lucky_number',    v_cache.lucky_number,
      'full_prediction', v_cache.full_prediction,
      'love_focus',      v_cache.love_focus,
      'career_focus',    v_cache.career_focus
    );
  ELSE
    RETURN jsonb_build_object(
      'status',       'ready',
      'tier',         'basic',
      'nakshatra',    v_nakshatra,
      'headline',     v_cache.headline,
      'mood_summary', v_cache.mood_summary,
      'lucky_color',  v_cache.lucky_color,
      'lucky_number', v_cache.lucky_number
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_daily_insight() TO authenticated;


-- ============================================================================
-- PG_CRON JOBS
-- ============================================================================

-- ─── activity-decay-nightly  (042 create — unchanged thereafter) ─────────────
-- NOTE on ambiguous final state: this job's body (`SET updated_at = updated_at`)
-- is a no-op write that does not actually change the value — it only exists to
-- update the row's xmin/trigger any update-time triggers. This looks like
-- either dead/placeholder logic or an incomplete decay implementation in the
-- legacy codebase. Flagged for human review — kept verbatim since changing the
-- behavior would be a functional change beyond a pure squash.
DO $outer$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    PERFORM cron.unschedule('activity-decay-nightly')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'activity-decay-nightly');

    PERFORM cron.schedule(
      'activity-decay-nightly',
      '0 2 * * *',
      $cron$
        UPDATE public.user_profiles
        SET updated_at = updated_at
        WHERE updated_at < now() - INTERVAL '48 hours';
      $cron$
    );

    PERFORM cron.unschedule('daily-picks-midnight')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-picks-midnight');

    PERFORM cron.schedule(
      'daily-picks-midnight',
      '0 0 * * *',
      $cron$
        INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
        SELECT DISTINCT ON (sc.user_a_id)
          sc.user_a_id, sc.user_b_id, sc.astro_score, CURRENT_DATE
        FROM public.synastry_cache sc
        JOIN public.user_profiles up ON up.user_id = sc.user_b_id
        WHERE up.updated_at > now() - INTERVAL '7 days'
          AND sc.astro_score IS NOT NULL
        ORDER BY sc.user_a_id, sc.astro_score DESC
        ON CONFLICT (user_id, pick_date) DO NOTHING;

        INSERT INTO public.daily_picks (user_id, picked_user_id, astro_score, pick_date)
        SELECT DISTINCT ON (sc.user_b_id)
          sc.user_b_id, sc.user_a_id, sc.astro_score, CURRENT_DATE
        FROM public.synastry_cache sc
        JOIN public.user_profiles up ON up.user_id = sc.user_a_id
        WHERE up.updated_at > now() - INTERVAL '7 days'
          AND sc.astro_score IS NOT NULL
        ORDER BY sc.user_b_id, sc.astro_score DESC
        ON CONFLICT (user_id, pick_date) DO NOTHING;
      $cron$
    );

  END IF;
END
$outer$;


-- ─── drain-push-notification-queue  (063 create, 100 remove broken
-- online-status skip from the trigger it depends on, 101 FINAL — reads the
-- worker secret from Supabase Vault instead of a DB setting requiring
-- superuser) ───────────────────────────────────────────────────────────────
-- IMPORTANT: before this cron job can authenticate successfully, store the
-- secret in Vault once via the Supabase SQL editor:
--   SELECT vault.create_secret(
--     'YOUR_PUSH_WORKER_SECRET_VALUE',
--     'push_worker_secret',
--     'Auth secret for send-push-notification edge function cron drain'
--   );
-- The value must match PUSH_WORKER_SECRET set on the send-push-notification
-- edge function's own secrets.
SELECT cron.unschedule('drain-push-notification-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'drain-push-notification-queue'
);

SELECT cron.schedule(
  'drain-push-notification-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://frgckqxfkfjacrutcobg.supabase.co/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type',         'application/json',
      'x-push-worker-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'push_worker_secret'
        LIMIT 1
      )
    ),
    body    := '{"batch_size": 50}'::jsonb
  );
  $$
);


-- ─── refresh-daily-nakshatra-cache  (NEW — not in legacy source) ─────────────
-- Runs once a day, shortly after daily-picks-midnight, and calls the
-- "daily-insights-refresh" Edge Function, which loops over all ~27 nakshatras,
-- calls the astrology API's daily_nakshatra_prediction endpoint once per
-- nakshatra, and upserts the results into daily_nakshatra_cache via
-- service_role. This is what keeps the Daily Insights tab's API usage at
-- ~27 calls/day regardless of user count.
--
-- IMPORTANT: before this job can authenticate successfully, store its secret
-- in Vault once via the Supabase SQL editor (separate from push_worker_secret
-- so the two jobs' credentials can be rotated independently):
--   SELECT vault.create_secret(
--     'YOUR_DAILY_INSIGHTS_WORKER_SECRET_VALUE',
--     'daily_insights_worker_secret',
--     'Auth secret for daily-insights-refresh edge function cron job'
--   );
-- The value must match a secret of the same name set on the
-- daily-insights-refresh edge function's own secrets.
SELECT cron.unschedule('refresh-daily-nakshatra-cache')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-daily-nakshatra-cache'
);

SELECT cron.schedule(
  'refresh-daily-nakshatra-cache',
  '5 0 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://frgckqxfkfjacrutcobg.supabase.co/functions/v1/daily-insights-refresh',
    headers := jsonb_build_object(
      'Content-Type',              'application/json',
      'x-daily-insights-secret',   (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'daily_insights_worker_secret'
        LIMIT 1
      )
    ),
    body    := '{}'::jsonb
  );
  $$
);


-- ============================================================================
-- Match + message push-notification triggers  (054 create, 063 copy/text fix,
-- 100 FINAL — message trigger: removed the online-status skip that was
-- silently dropping notifications for users on a different in-app screen)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_match_push_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user1_name TEXT;
  v_user2_name TEXT;
BEGIN
  SELECT COALESCE(full_name, 'Someone') INTO v_user1_name
  FROM public.user_profiles
  WHERE user_id = NEW.user1_id;

  SELECT COALESCE(full_name, 'Someone') INTO v_user2_name
  FROM public.user_profiles
  WHERE user_id = NEW.user2_id;

  INSERT INTO public.notification_delivery_logs (
    user_id, notification_type, reference_id, dedupe_key, title, body, payload
  )
  VALUES
  (
    NEW.user1_id,
    'new_match',
    NEW.id::TEXT,
    'match:' || NEW.id::TEXT || ':' || NEW.user1_id::TEXT,
    'You and ' || v_user2_name || ' matched! ✨',
    'Say hello — don''t keep them waiting 💫',
    jsonb_build_object(
      'type',      'match',
      'chat_id',   NEW.channel_id,
      'match_id',  NEW.id,
      'sender_id', NEW.user2_id
    )
  ),
  (
    NEW.user2_id,
    'new_match',
    NEW.id::TEXT,
    'match:' || NEW.id::TEXT || ':' || NEW.user2_id::TEXT,
    'You and ' || v_user1_name || ' matched! ✨',
    'Say hello — don''t keep them waiting 💫',
    jsonb_build_object(
      'type',      'match',
      'chat_id',   NEW.channel_id,
      'match_id',  NEW.id,
      'sender_id', NEW.user1_id
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_match_push_notifications ON public.user_matches;
CREATE TRIGGER trg_enqueue_match_push_notifications
AFTER INSERT ON public.user_matches
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_match_push_notifications();


CREATE OR REPLACE FUNCTION public.enqueue_message_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name     TEXT;
  v_cooldown_bucket BIGINT;
BEGIN
  IF NEW.sender_id IS NULL
     OR NEW.receiver_id IS NULL
     OR NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  -- Final state (100): the online-status skip that previously lived here was
  -- removed — it was silently dropping notifications for recipients who were
  -- online but on a different screen. The 2-minute dedupe key below is
  -- sufficient to prevent notification spam.

  SELECT COALESCE(full_name, 'Someone') INTO v_sender_name
  FROM public.user_profiles
  WHERE user_id = NEW.sender_id;

  v_cooldown_bucket := floor(extract(epoch from now()) / 120);

  INSERT INTO public.notification_delivery_logs (
    user_id, notification_type, reference_id, dedupe_key, title, body, payload
  )
  VALUES (
    NEW.receiver_id,
    'new_message',
    NEW.id::TEXT,
    'message:' || NEW.receiver_id::TEXT || ':' || COALESCE(NEW.channel_id, 'unknown') || ':' || v_cooldown_bucket::TEXT,
    COALESCE(v_sender_name, 'Someone') || ' sent you a message',
    'Open AstroDate to reply',
    jsonb_build_object(
      'type',      'message',
      'chat_id',   NEW.channel_id,
      'message_id', NEW.id,
      'sender_id', NEW.sender_id
    )
  )
  ON CONFLICT (dedupe_key) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_message_push_notification ON public.messages;
CREATE TRIGGER trg_enqueue_message_push_notification
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_message_push_notification();


-- ============================================================================
-- Push token / notification preference management RPCs  (054 create —
-- unchanged thereafter)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.register_push_token(
  p_expo_push_token TEXT,
  p_platform TEXT DEFAULT 'unknown',
  p_device_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_token_id UUID;
  v_platform TEXT := COALESCE(NULLIF(lower(trim(p_platform)), ''), 'unknown');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_expo_push_token IS NULL OR length(trim(p_expo_push_token)) < 16 THEN
    RAISE EXCEPTION 'Invalid Expo push token';
  END IF;

  IF v_platform NOT IN ('ios', 'android', 'web', 'unknown') THEN
    v_platform := 'unknown';
  END IF;

  IF p_device_id IS NOT NULL THEN
    UPDATE public.user_push_tokens
    SET is_active = false,
        updated_at = now()
    WHERE user_id = v_user_id
      AND device_id = p_device_id
      AND expo_push_token <> p_expo_push_token
      AND is_active = true;
  END IF;

  INSERT INTO public.user_push_tokens (
    user_id, expo_push_token, platform, device_id, last_seen_at, updated_at, is_active
  )
  VALUES (
    v_user_id, trim(p_expo_push_token), v_platform, p_device_id, now(), now(), true
  )
  ON CONFLICT (expo_push_token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    device_id = EXCLUDED.device_id,
    last_seen_at = now(),
    updated_at = now(),
    is_active = true
  RETURNING id INTO v_token_id;

  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_token_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_push_token(
  p_expo_push_token TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.user_push_tokens
  SET is_active = false,
      updated_at = now()
  WHERE user_id = v_user_id
    AND (
      (p_expo_push_token IS NOT NULL AND expo_push_token = p_expo_push_token)
      OR (p_device_id IS NOT NULL AND device_id = p_device_id)
      OR (p_expo_push_token IS NULL AND p_device_id IS NULL)
    )
    AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_notification_preferences(
  p_new_matches_enabled BOOLEAN DEFAULT NULL,
  p_new_messages_enabled BOOLEAN DEFAULT NULL,
  p_marketing_enabled BOOLEAN DEFAULT NULL,
  p_quiet_hours_start TIME DEFAULT NULL,
  p_quiet_hours_end TIME DEFAULT NULL
)
RETURNS public.user_notification_preferences
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_row public.user_notification_preferences%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_notification_preferences (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  UPDATE public.user_notification_preferences
  SET new_matches_enabled = COALESCE(p_new_matches_enabled, new_matches_enabled),
      new_messages_enabled = COALESCE(p_new_messages_enabled, new_messages_enabled),
      marketing_enabled = COALESCE(p_marketing_enabled, marketing_enabled),
      quiet_hours_start = COALESCE(p_quiet_hours_start, quiet_hours_start),
      quiet_hours_end = COALESCE(p_quiet_hours_end, quiet_hours_end),
      updated_at = now()
  WHERE user_id = v_user_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_notification_delivery_logs(p_limit INTEGER DEFAULT 50)
RETURNS TABLE(
  id UUID,
  user_id UUID,
  notification_type TEXT,
  reference_id TEXT,
  title TEXT,
  body TEXT,
  payload JSONB,
  attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT l.id
    FROM public.notification_delivery_logs l
    WHERE (
        l.status IN ('pending', 'failed')
        OR (l.status = 'processing' AND l.updated_at < now() - INTERVAL '5 minutes')
      )
      AND l.attempt_count < 3
      AND l.next_attempt_at <= now()
    ORDER BY l.created_at
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.notification_delivery_logs l
  SET status = 'processing',
      updated_at = now(),
      error_message = NULL
  FROM picked
  WHERE l.id = picked.id
  RETURNING
    l.id, l.user_id, l.notification_type, l.reference_id, l.title, l.body, l.payload, l.attempt_count;
END;
$$;
