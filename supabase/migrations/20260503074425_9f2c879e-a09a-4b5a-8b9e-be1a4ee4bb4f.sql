CREATE OR REPLACE FUNCTION public.get_performance_trader(p_days INT DEFAULT NULL)
RETURNS TABLE(
  mercado TEXT,
  greens BIGINT,
  reds BIGINT,
  win_rate_pct NUMERIC,
  roi_pct NUMERIC,
  total_sinais BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      LOWER(TRIM(COALESCE(NULLIF(TRIM(market), ''), 'N/A'))) AS mercado_key,
      COALESCE(NULLIF(TRIM(market), ''), 'N/A') AS mercado_label,
      LOWER(result) AS r,
      analysis_id,
      COALESCE(created_at, now()) AS settled_at,
      ROW_NUMBER() OVER (
        PARTITION BY analysis_id
        ORDER BY created_at DESC, id DESC
      ) AS rn
    FROM public.mycroft_settlement_log
    WHERE LOWER(COALESCE(result, '')) IN ('green', 'red')
      AND analysis_id IS NOT NULL
      AND (p_days IS NULL OR p_days = 0
           OR created_at >= now() - (p_days || ' days')::interval)
  ),
  dedup AS (
    SELECT
      mercado_key,
      mercado_label,
      r,
      analysis_id
    FROM base
    WHERE rn = 1
  ),
  agg AS (
    SELECT
      mercado_key,
      (
        SELECT d2.mercado_label
        FROM dedup d2
        WHERE d2.mercado_key = d.mercado_key
        GROUP BY d2.mercado_label
        ORDER BY COUNT(*) DESC, d2.mercado_label
        LIMIT 1
      ) AS mercado,
      COUNT(*) FILTER (WHERE r = 'green') AS greens,
      COUNT(*) FILTER (WHERE r = 'red') AS reds,
      ROUND(
        COUNT(*) FILTER (WHERE r = 'green')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE r IN ('green', 'red')), 0) * 100,
        1
      ) AS win_rate_pct,
      ROUND(
        (
          COUNT(*) FILTER (WHERE r = 'green') -
          COUNT(*) FILTER (WHERE r = 'red')
        )::numeric /
        NULLIF(COUNT(*) FILTER (WHERE r IN ('green', 'red')), 0) * 100,
        2
      ) AS roi_pct,
      COUNT(*) AS total_sinais
    FROM dedup d
    GROUP BY mercado_key
  )
  SELECT mercado, greens, reds, win_rate_pct, roi_pct, total_sinais
  FROM agg
  ORDER BY win_rate_pct DESC NULLS LAST, total_sinais DESC;
$$;