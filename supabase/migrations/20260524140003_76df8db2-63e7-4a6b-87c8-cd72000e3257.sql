CREATE OR REPLACE FUNCTION public.compare_det_vs_ia_export(_period text DEFAULT '30d')
RETURNS TABLE (
  fonte text,
  data_evento timestamptz,
  league text,
  home_team text,
  away_team text,
  market text,
  odd numeric,
  result text,
  profit_loss numeric,
  verdict text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_today_br date;
BEGIN
  v_today_br := (now() AT TIME ZONE 'America/Sao_Paulo')::date;

  CASE _period
    WHEN 'today' THEN
      v_start := (v_today_br::timestamp AT TIME ZONE 'America/Sao_Paulo');
      v_end := now() + interval '1 second';
    WHEN 'yesterday' THEN
      v_start := ((v_today_br - 1)::timestamp AT TIME ZONE 'America/Sao_Paulo');
      v_end := (v_today_br::timestamp AT TIME ZONE 'America/Sao_Paulo');
    WHEN '7d' THEN
      v_start := now() - interval '7 days';
      v_end := now() + interval '1 second';
    WHEN '14d' THEN
      v_start := now() - interval '14 days';
      v_end := now() + interval '1 second';
    WHEN '30d' THEN
      v_start := now() - interval '30 days';
      v_end := now() + interval '1 second';
    ELSE
      v_start := now() - interval '30 days';
      v_end := now() + interval '1 second';
  END CASE;

  RETURN QUERY
  WITH ia_markets AS (
    SELECT DISTINCT public.normalize_market(market) AS nm
    FROM public.mycroft_analyses_shadow_ai
    WHERE created_at >= v_start AND created_at < v_end
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND market IS NOT NULL
  )
  -- Determinístico: cada sinal individual filtrado pelos mercados da IA
  SELECT
    'deterministico'::text AS fonte,
    ls.match_date AS data_evento,
    ls.league,
    ls.home_team,
    ls.away_team,
    public.normalize_market(ls.market)::text AS market,
    ls.odd,
    UPPER(ls.result)::text AS result,
    ls.profit_loss,
    NULL::text AS verdict
  FROM public.live_sinais ls
  WHERE ls.match_date >= v_start AND ls.match_date < v_end
    AND public.normalize_market(ls.market) IN (SELECT nm FROM ia_markets)

  UNION ALL

  -- IA: cada análise individual (com stake unitária)
  SELECT
    'ia'::text AS fonte,
    ai.created_at AS data_evento,
    ai.league,
    ai.home_team,
    ai.away_team,
    public.normalize_market(ai.market)::text AS market,
    ai.odd,
    UPPER(ai.result)::text AS result,
    CASE
      WHEN UPPER(ai.result) = 'GREEN' THEN ROUND((COALESCE(ai.odd, 1) - 1)::numeric, 2)
      WHEN UPPER(ai.result) = 'RED'  THEN -1.0
      ELSE NULL
    END AS profit_loss,
    ai.verdict::text
  FROM public.mycroft_analyses_shadow_ai ai
  WHERE ai.created_at >= v_start AND ai.created_at < v_end
    AND ai.verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')

  ORDER BY 2 DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compare_det_vs_ia_export(text) TO authenticated;