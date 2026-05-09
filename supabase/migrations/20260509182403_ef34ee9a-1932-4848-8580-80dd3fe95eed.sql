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
    ), priced AS (
      SELECT * FROM base WHERE odd IS NOT NULL AND odd > 1
    )
    SELECT
      (SELECT COUNT(*) FROM base),
      (SELECT COUNT(*) FROM base WHERE result='green'),
      (SELECT COUNT(*) FROM base WHERE result='red'),
      COALESCE((SELECT SUM(CASE WHEN result='green' THEN odd-1 ELSE -1 END) FROM priced), 0),
      (SELECT COUNT(*) FROM priced),
      (SELECT MAX(settled_at) FROM base)
    INTO v_total, v_g, v_r, v_pnl_sum, v_units, v_last;
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
          WHEN result IN ('won','green') AND odd IS NOT NULL AND odd > 1 THEN odd - 1
          WHEN result IN ('lost','red') THEN -1
          ELSE 0
        END
      ), 0),
      COUNT(*) FILTER (
        WHERE (profit_loss IS NOT NULL AND stake_amount IS NOT NULL AND stake_amount > 0)
           OR (result IN ('won','green') AND odd IS NOT NULL AND odd > 1)
           OR result IN ('lost','red')
      ),
      MAX(resulted_at)
    INTO v_total, v_g, v_r, v_pnl_sum, v_units, v_last
    FROM base;
  END IF;

  RETURN QUERY SELECT
    COALESCE(v_total, 0)::INT,
    COALESCE(v_g, 0)::INT,
    COALESCE(v_r, 0)::INT,
    CASE WHEN v_total > 0 THEN ROUND((v_g::NUMERIC / v_total)::NUMERIC, 4) ELSE 0 END,
    CASE WHEN v_units > 0 THEN ROUND((v_pnl_sum / v_units)::NUMERIC, 4) ELSE 0 END,
    v_last;
END;
$$;

SELECT public.refresh_arena_calibration('trader_sports', 50);
SELECT public.refresh_arena_calibration('punter', 50);