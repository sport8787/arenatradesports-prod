-- Performance por mercado: PRÉ-LIVE (Arena Punter)
CREATE OR REPLACE VIEW public.v_performance_por_mercado_punter AS
SELECT
  COALESCE(NULLIF(TRIM(market), ''), 'N/A') AS mercado,
  COUNT(*) FILTER (WHERE LOWER(resultado) = 'green') AS greens,
  COUNT(*) FILTER (WHERE LOWER(resultado) = 'red') AS reds,
  ROUND(
    COUNT(*) FILTER (WHERE LOWER(resultado) = 'green')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE LOWER(resultado) IN ('green','red')), 0) * 100, 1
  ) AS win_rate_pct,
  ROUND(
    COALESCE(SUM(profit_loss) FILTER (WHERE LOWER(resultado) IN ('green','red')), 0) /
    NULLIF(SUM(COALESCE(stake_amount, 0)) FILTER (WHERE LOWER(resultado) IN ('green','red')), 0) * 100,
    2
  ) AS roi_pct,
  COUNT(*) FILTER (WHERE LOWER(resultado) IN ('green','red')) AS total_sinais,
  MAX(COALESCE(settled_at, resulted_at, commence_time)) AS last_settled_at,
  MIN(COALESCE(match_date, commence_time::date)) AS first_match_date,
  MAX(COALESCE(match_date, commence_time::date)) AS last_match_date
FROM public.punter_sinais
WHERE LOWER(COALESCE(resultado, '')) IN ('green','red')
GROUP BY COALESCE(NULLIF(TRIM(market), ''), 'N/A');

-- Performance por mercado: AO VIVO (Arena Trader Sports / mycroft_analyses)
CREATE OR REPLACE VIEW public.v_performance_por_mercado_trader AS
SELECT
  COALESCE(NULLIF(TRIM(market), ''), 'N/A') AS mercado,
  COUNT(*) FILTER (WHERE LOWER(result) = 'green') AS greens,
  COUNT(*) FILTER (WHERE LOWER(result) = 'red') AS reds,
  ROUND(
    COUNT(*) FILTER (WHERE LOWER(result) = 'green')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE LOWER(result) IN ('green','red')), 0) * 100, 1
  ) AS win_rate_pct,
  -- ROI estimado: assume stake unitária = 1 (mycroft_analyses não tem stake)
  -- GREEN: +(odd-1), RED: -1
  ROUND(
    (
      SUM(CASE WHEN LOWER(result) = 'green' THEN (COALESCE(odd,1) - 1) ELSE 0 END)
      - COUNT(*) FILTER (WHERE LOWER(result) = 'red')
    )::numeric /
    NULLIF(COUNT(*) FILTER (WHERE LOWER(result) IN ('green','red')), 0) * 100,
    2
  ) AS roi_pct,
  COUNT(*) FILTER (WHERE LOWER(result) IN ('green','red')) AS total_sinais,
  MAX(settled_at) AS last_settled_at,
  MIN(created_at::date) AS first_match_date,
  MAX(created_at::date) AS last_match_date
FROM public.mycroft_analyses
WHERE LOWER(COALESCE(result, '')) IN ('green','red')
  AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
GROUP BY COALESCE(NULLIF(TRIM(market), ''), 'N/A');

-- RPC com filtro de período (em dias; 0 ou NULL = todos os tempos) - PUNTER
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
  SELECT
    COALESCE(NULLIF(TRIM(market), ''), 'N/A') AS mercado,
    COUNT(*) FILTER (WHERE LOWER(resultado) = 'green') AS greens,
    COUNT(*) FILTER (WHERE LOWER(resultado) = 'red') AS reds,
    ROUND(
      COUNT(*) FILTER (WHERE LOWER(resultado) = 'green')::numeric /
      NULLIF(COUNT(*) FILTER (WHERE LOWER(resultado) IN ('green','red')), 0) * 100, 1
    ) AS win_rate_pct,
    ROUND(
      COALESCE(SUM(profit_loss) FILTER (WHERE LOWER(resultado) IN ('green','red')), 0) /
      NULLIF(SUM(COALESCE(stake_amount, 0)) FILTER (WHERE LOWER(resultado) IN ('green','red')), 0) * 100,
      2
    ) AS roi_pct,
    COUNT(*) FILTER (WHERE LOWER(resultado) IN ('green','red')) AS total_sinais
  FROM public.punter_sinais
  WHERE LOWER(COALESCE(resultado, '')) IN ('green','red')
    AND (p_days IS NULL OR p_days = 0
         OR COALESCE(match_date, commence_time::date) >= (CURRENT_DATE - (p_days || ' days')::interval)::date)
  GROUP BY COALESCE(NULLIF(TRIM(market), ''), 'N/A')
  ORDER BY win_rate_pct DESC NULLS LAST, total_sinais DESC;
$$;

-- RPC com filtro de período (em dias) - TRADER (ao vivo)
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
  SELECT
    COALESCE(NULLIF(TRIM(market), ''), 'N/A') AS mercado,
    COUNT(*) FILTER (WHERE LOWER(result) = 'green') AS greens,
    COUNT(*) FILTER (WHERE LOWER(result) = 'red') AS reds,
    ROUND(
      COUNT(*) FILTER (WHERE LOWER(result) = 'green')::numeric /
      NULLIF(COUNT(*) FILTER (WHERE LOWER(result) IN ('green','red')), 0) * 100, 1
    ) AS win_rate_pct,
    ROUND(
      (
        SUM(CASE WHEN LOWER(result) = 'green' THEN (COALESCE(odd,1) - 1) ELSE 0 END)
        - COUNT(*) FILTER (WHERE LOWER(result) = 'red')
      )::numeric /
      NULLIF(COUNT(*) FILTER (WHERE LOWER(result) IN ('green','red')), 0) * 100,
      2
    ) AS roi_pct,
    COUNT(*) FILTER (WHERE LOWER(result) IN ('green','red')) AS total_sinais
  FROM public.mycroft_analyses
  WHERE LOWER(COALESCE(result, '')) IN ('green','red')
    AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
    AND (p_days IS NULL OR p_days = 0
         OR created_at >= now() - (p_days || ' days')::interval)
  GROUP BY COALESCE(NULLIF(TRIM(market), ''), 'N/A')
  ORDER BY win_rate_pct DESC NULLS LAST, total_sinais DESC;
$$;

GRANT SELECT ON public.v_performance_por_mercado_punter TO authenticated, anon;
GRANT SELECT ON public.v_performance_por_mercado_trader TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_punter(INT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_performance_trader(INT) TO authenticated, anon;