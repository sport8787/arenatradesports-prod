CREATE OR REPLACE FUNCTION public.normalize_market(m text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN m IS NULL THEN NULL
    WHEN m ILIKE 'Próximo Gol%' OR m ILIKE 'Proximo Gol%' THEN 'Próximo Gol'
    ELSE TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(m, '\s*(—|-)\s*SAIR\s*$', '', 'i'),
      '\s+(Total|FT|Gols)\s*$', '', 'i'
    ))
  END;
$$;

CREATE OR REPLACE VIEW public.v_comparativo_ao_vivo AS
WITH ia_markets AS (
  SELECT DISTINCT public.normalize_market(market) AS nm
  FROM public.mycroft_analyses_shadow_ai
  WHERE created_at >= now() - interval '30 days'
    AND verdict IN ('APROVADO','APROVADO_SITUACIONAL')
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
    ROUND(COALESCE(SUM(profit_loss), 0)::numeric, 2) AS pl_total,
    ROUND(COALESCE(SUM(stake), 0)::numeric, 2) AS stake_total
  FROM public.live_sinais ls
  WHERE created_at >= now() - interval '30 days'
    AND public.normalize_market(ls.market) IN (SELECT nm FROM ia_markets)
),
ia_base AS (
  SELECT
    odd, UPPER(result) AS result_u,
    5::numeric AS stake,
    CASE
      WHEN UPPER(result) = 'GREEN' THEN (COALESCE(odd, 1.7) - 1) * 5
      WHEN UPPER(result) = 'RED' THEN -5
      ELSE 0
    END AS profit_loss
  FROM public.mycroft_analyses_shadow_ai
  WHERE created_at >= now() - interval '30 days'
    AND verdict IN ('APROVADO','APROVADO_SITUACIONAL')
),
ia AS (
  SELECT
    'ia'::text AS fonte,
    COUNT(*)::int AS aprovados,
    COUNT(*) FILTER (WHERE result_u = 'GREEN')::int AS green,
    COUNT(*) FILTER (WHERE result_u = 'RED')::int AS red,
    COUNT(*) FILTER (WHERE result_u IS NULL)::int AS pendentes,
    ROUND(AVG(odd)::numeric, 2) AS odd_media,
    ROUND(COALESCE(SUM(profit_loss), 0)::numeric, 2) AS pl_total,
    ROUND(COALESCE(SUM(stake) FILTER (WHERE result_u IS NOT NULL), 0)::numeric, 2) AS stake_total
  FROM ia_base
)
SELECT
  fonte, aprovados, green, red, pendentes, odd_media, pl_total, stake_total,
  CASE WHEN (green + red) > 0 THEN ROUND(green::numeric * 100 / (green + red), 1) ELSE 0 END AS hit_rate_pct,
  CASE WHEN stake_total > 0 THEN ROUND(pl_total * 100 / stake_total, 1) ELSE 0 END AS roi_pct
FROM (SELECT * FROM det UNION ALL SELECT * FROM ia) x;

REVOKE ALL ON public.v_comparativo_ao_vivo FROM anon, authenticated;
GRANT SELECT ON public.v_comparativo_ao_vivo TO authenticated;