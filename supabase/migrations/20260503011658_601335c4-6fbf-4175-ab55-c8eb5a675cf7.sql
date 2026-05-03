CREATE OR REPLACE FUNCTION public.get_performance_punter(p_days INT DEFAULT NULL)
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
      LOWER(resultado) AS r,
      profit_loss,
      stake_amount
    FROM public.punter_sinais
    WHERE LOWER(COALESCE(resultado, '')) IN ('green','red')
      AND (p_days IS NULL OR p_days = 0
           OR COALESCE(match_date, commence_time::date) >= (CURRENT_DATE - (p_days || ' days')::interval)::date)
  ),
  agg AS (
    SELECT
      mercado_key,
      (SELECT mercado_label
         FROM base b2
        WHERE b2.mercado_key = b.mercado_key
        GROUP BY mercado_label
        ORDER BY COUNT(*) DESC, mercado_label
        LIMIT 1) AS mercado,
      COUNT(*) FILTER (WHERE r = 'green') AS greens,
      COUNT(*) FILTER (WHERE r = 'red') AS reds,
      ROUND(
        COUNT(*) FILTER (WHERE r = 'green')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE r IN ('green','red')), 0) * 100, 1
      ) AS win_rate_pct,
      ROUND(
        COALESCE(SUM(profit_loss), 0) /
        NULLIF(SUM(COALESCE(stake_amount, 0)), 0) * 100, 2
      ) AS roi_pct,
      COUNT(*) AS total_sinais
    FROM base b
    GROUP BY mercado_key
  )
  SELECT mercado, greens, reds, win_rate_pct, roi_pct, total_sinais
  FROM agg
  ORDER BY win_rate_pct DESC NULLS LAST, total_sinais DESC;
$$;

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
      odd
    FROM public.mycroft_analyses
    WHERE LOWER(COALESCE(result, '')) IN ('green','red')
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND (p_days IS NULL OR p_days = 0
           OR created_at >= now() - (p_days || ' days')::interval)
  ),
  agg AS (
    SELECT
      mercado_key,
      (SELECT mercado_label
         FROM base b2
        WHERE b2.mercado_key = b.mercado_key
        GROUP BY mercado_label
        ORDER BY COUNT(*) DESC, mercado_label
        LIMIT 1) AS mercado,
      COUNT(*) FILTER (WHERE r = 'green') AS greens,
      COUNT(*) FILTER (WHERE r = 'red') AS reds,
      ROUND(
        COUNT(*) FILTER (WHERE r = 'green')::numeric /
        NULLIF(COUNT(*) FILTER (WHERE r IN ('green','red')), 0) * 100, 1
      ) AS win_rate_pct,
      ROUND(
        (
          SUM(CASE WHEN r = 'green' THEN (COALESCE(odd,1) - 1) ELSE 0 END)
          - COUNT(*) FILTER (WHERE r = 'red')
        )::numeric /
        NULLIF(COUNT(*) FILTER (WHERE r IN ('green','red')), 0) * 100, 2
      ) AS roi_pct,
      COUNT(*) AS total_sinais
    FROM base b
    GROUP BY mercado_key
  )
  SELECT mercado, greens, reds, win_rate_pct, roi_pct, total_sinais
  FROM agg
  ORDER BY win_rate_pct DESC NULLS LAST, total_sinais DESC;
$$;