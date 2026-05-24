CREATE OR REPLACE FUNCTION public.compare_det_vs_ia(_period text DEFAULT '30d')
RETURNS TABLE (
  fonte text,
  aprovados int,
  green int,
  red int,
  pendentes int,
  odd_media numeric,
  pl_total numeric,
  stake_total numeric,
  hit_rate_pct numeric,
  roi_pct numeric
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
  ),
  det AS (
    SELECT
      'deterministico'::text AS fonte,
      COUNT(*)::int AS aprovados,
      COUNT(*) FILTER (WHERE UPPER(result) = 'GREEN')::int AS green,
      COUNT(*) FILTER (WHERE UPPER(result) = 'RED')::int AS red,
      COUNT(*) FILTER (WHERE result IS NULL)::int AS pendentes,
      ROUND(AVG(odd)::numeric, 2) AS odd_media,
      ROUND(COALESCE(SUM(profit_loss) FILTER (WHERE UPPER(result) IN ('GREEN','RED')), 0)::numeric, 2) AS pl_total,
      ROUND(COALESCE(SUM(stake) FILTER (WHERE UPPER(result) IN ('GREEN','RED')), 0)::numeric, 2) AS stake_total
    FROM public.live_sinais ls
    WHERE match_date >= v_start AND match_date < v_end
      AND public.normalize_market(ls.market) IN (SELECT nm FROM ia_markets)
  ),
  ia_base AS (
    SELECT
      odd, UPPER(result) AS result_u,
      CASE WHEN UPPER(result) IN ('GREEN','RED') THEN 1.0::numeric ELSE NULL END AS stake,
      CASE
        WHEN UPPER(result) = 'GREEN' THEN ROUND((COALESCE(odd, 1) - 1)::numeric, 2)
        WHEN UPPER(result) = 'RED' THEN -1.0
        ELSE NULL
      END AS profit_loss
    FROM public.mycroft_analyses_shadow_ai
    WHERE created_at >= v_start AND created_at < v_end
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
  ),
  ia AS (
    SELECT
      'ia'::text AS fonte,
      COUNT(*)::int AS aprovados,
      COUNT(*) FILTER (WHERE result_u = 'GREEN')::int AS green,
      COUNT(*) FILTER (WHERE result_u = 'RED')::int AS red,
      COUNT(*) FILTER (WHERE result_u IS NULL)::int AS pendentes,
      ROUND(AVG(odd)::numeric, 2) AS odd_media,
      ROUND(COALESCE(SUM(profit_loss) FILTER (WHERE result_u IN ('GREEN','RED')), 0)::numeric, 2) AS pl_total,
      ROUND(COALESCE(SUM(stake) FILTER (WHERE result_u IN ('GREEN','RED')), 0)::numeric, 2) AS stake_total
    FROM ia_base
  ),
  u AS (
    SELECT * FROM det UNION ALL SELECT * FROM ia
  )
  SELECT
    u.fonte, u.aprovados, u.green, u.red, u.pendentes, u.odd_media, u.pl_total, u.stake_total,
    CASE WHEN (u.green + u.red) > 0 THEN ROUND(u.green::numeric * 100 / (u.green + u.red), 1) ELSE 0 END AS hit_rate_pct,
    CASE WHEN u.stake_total > 0 THEN ROUND(u.pl_total * 100 / u.stake_total, 1) ELSE 0 END AS roi_pct
  FROM u;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compare_det_vs_ia(text) TO authenticated;