-- Calibração dinâmica por arena
CREATE TABLE IF NOT EXISTS public.arena_calibration_state (
  arena TEXT PRIMARY KEY CHECK (arena IN ('trader_sports','punter')),
  sample_size INT NOT NULL DEFAULT 0,
  greens INT NOT NULL DEFAULT 0,
  reds INT NOT NULL DEFAULT 0,
  hit_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  roi NUMERIC(6,4) NOT NULL DEFAULT 0,
  base_min_confidence INT NOT NULL DEFAULT 70,
  delta INT NOT NULL DEFAULT 0,
  effective_min_confidence INT NOT NULL DEFAULT 70,
  last_settled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_calibration_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calibration read public" ON public.arena_calibration_state;
CREATE POLICY "calibration read public"
  ON public.arena_calibration_state FOR SELECT
  USING (true);

-- Seeds idempotentes
INSERT INTO public.arena_calibration_state (arena) VALUES ('trader_sports')
  ON CONFLICT (arena) DO NOTHING;
INSERT INTO public.arena_calibration_state (arena) VALUES ('punter')
  ON CONFLICT (arena) DO NOTHING;

-- RPC: métricas das últimas N operações liquidadas por arena
CREATE OR REPLACE FUNCTION public.compute_arena_calibration(
  p_arena TEXT,
  p_limit INT DEFAULT 50
)
RETURNS TABLE(
  sample_size INT, greens INT, reds INT,
  hit_rate NUMERIC, roi NUMERIC, last_settled_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total INT := 0; v_g INT := 0; v_r INT := 0;
  v_pnl_sum NUMERIC := 0; v_units NUMERIC := 0;
  v_last TIMESTAMPTZ;
BEGIN
  IF p_arena = 'trader_sports' THEN
    WITH base AS (
      SELECT result, odd, settled_at
      FROM public.mycroft_analyses
      WHERE result IN ('green','red')
        AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      ORDER BY settled_at DESC NULLS LAST
      LIMIT GREATEST(p_limit, 1)
    )
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE result='green'),
      COUNT(*) FILTER (WHERE result='red'),
      COALESCE(SUM(CASE WHEN result='green' THEN COALESCE(odd,1)-1 ELSE -1 END), 0),
      COUNT(*),
      MAX(settled_at)
    INTO v_total, v_g, v_r, v_pnl_sum, v_units, v_last
    FROM base;
  ELSIF p_arena = 'punter' THEN
    WITH base AS (
      SELECT result, odd, profit_loss, stake_amount, resulted_at
      FROM public.punter_signals
      WHERE result IN ('won','green','lost','red')
      ORDER BY resulted_at DESC NULLS LAST
      LIMIT GREATEST(p_limit, 1)
    )
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE result IN ('won','green')),
      COUNT(*) FILTER (WHERE result IN ('lost','red')),
      COALESCE(SUM(
        CASE
          WHEN profit_loss IS NOT NULL AND stake_amount IS NOT NULL AND stake_amount > 0
            THEN profit_loss / stake_amount
          WHEN result IN ('won','green') THEN COALESCE(odd,1)-1
          ELSE -1
        END
      ), 0),
      COUNT(*),
      MAX(resulted_at)
    INTO v_total, v_g, v_r, v_pnl_sum, v_units, v_last
    FROM base;
  ELSE
    RAISE EXCEPTION 'unknown_arena: %', p_arena;
  END IF;

  RETURN QUERY SELECT
    v_total,
    v_g,
    v_r,
    CASE WHEN v_total > 0 THEN ROUND((v_g::numeric / v_total)::numeric, 4) ELSE 0 END,
    CASE WHEN v_units > 0 THEN ROUND((v_pnl_sum / v_units)::numeric, 4) ELSE 0 END,
    v_last;
END;
$$;

-- RPC: recalcula e persiste estado (delta de threshold)
CREATE OR REPLACE FUNCTION public.refresh_arena_calibration(p_arena TEXT, p_limit INT DEFAULT 50)
RETURNS TABLE(
  arena TEXT, sample_size INT, hit_rate NUMERIC, roi NUMERIC,
  effective_min_confidence INT, delta INT
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  m RECORD;
  v_base INT;
  v_delta INT := 0;
  v_eff INT;
BEGIN
  SELECT * INTO m FROM public.compute_arena_calibration(p_arena, p_limit);

  SELECT base_min_confidence INTO v_base
  FROM public.arena_calibration_state WHERE arena = p_arena;
  IF v_base IS NULL THEN v_base := 70; END IF;

  -- Tuning só com amostra mínima de 20 operações
  IF m.sample_size >= 20 THEN
    v_delta := CASE
      WHEN m.hit_rate < 0.50 THEN 10
      WHEN m.hit_rate < 0.60 THEN 5
      WHEN m.hit_rate < 0.70 THEN 0
      ELSE -3
    END;
  END IF;

  v_eff := GREATEST(60, LEAST(85, v_base + v_delta));

  INSERT INTO public.arena_calibration_state AS s
    (arena, sample_size, greens, reds, hit_rate, roi,
     base_min_confidence, delta, effective_min_confidence, last_settled_at, updated_at)
  VALUES (p_arena, m.sample_size, m.greens, m.reds, m.hit_rate, m.roi,
          v_base, v_delta, v_eff, m.last_settled_at, now())
  ON CONFLICT (arena) DO UPDATE SET
    sample_size = EXCLUDED.sample_size,
    greens = EXCLUDED.greens,
    reds = EXCLUDED.reds,
    hit_rate = EXCLUDED.hit_rate,
    roi = EXCLUDED.roi,
    delta = EXCLUDED.delta,
    effective_min_confidence = EXCLUDED.effective_min_confidence,
    last_settled_at = EXCLUDED.last_settled_at,
    updated_at = now();

  RETURN QUERY SELECT p_arena, m.sample_size, m.hit_rate, m.roi, v_eff, v_delta;
END;
$$;

-- Cron 30min: refresh ambas as arenas
SELECT cron.unschedule('arena-calibration-refresh') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname='arena-calibration-refresh'
);
SELECT cron.schedule(
  'arena-calibration-refresh',
  '*/30 * * * *',
  $$
    SELECT public.refresh_arena_calibration('trader_sports', 50);
    SELECT public.refresh_arena_calibration('punter', 50);
  $$
);