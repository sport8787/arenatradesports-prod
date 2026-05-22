CREATE OR REPLACE VIEW public.v_comparativo_ao_vivo AS
WITH det AS (
  SELECT
    'deterministico'::text AS fonte,
    COUNT(*)::int AS aprovados,
    COUNT(*) FILTER (WHERE result = 'GREEN')::int AS green,
    COUNT(*) FILTER (WHERE result = 'RED')::int AS red,
    COUNT(*) FILTER (WHERE result IS NULL)::int AS pendentes,
    ROUND(AVG(odd)::numeric, 2) AS odd_media,
    ROUND(COALESCE(SUM(profit_loss), 0)::numeric, 2) AS pl_total,
    ROUND(COALESCE(SUM(stake), 0)::numeric, 2) AS stake_total
  FROM public.live_sinais
  WHERE created_at >= now() - interval '30 days'
),
ia_base AS (
  SELECT
    odd, result,
    5::numeric AS stake,
    CASE
      WHEN result = 'GREEN' THEN (COALESCE(odd, 1.7) - 1) * 5
      WHEN result = 'RED' THEN -5
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
    COUNT(*) FILTER (WHERE result = 'GREEN')::int AS green,
    COUNT(*) FILTER (WHERE result = 'RED')::int AS red,
    COUNT(*) FILTER (WHERE result IS NULL)::int AS pendentes,
    ROUND(AVG(odd)::numeric, 2) AS odd_media,
    ROUND(COALESCE(SUM(profit_loss), 0)::numeric, 2) AS pl_total,
    ROUND(COALESCE(SUM(stake) FILTER (WHERE result IS NOT NULL), 0)::numeric, 2) AS stake_total
  FROM ia_base
)
SELECT
  fonte, aprovados, green, red, pendentes, odd_media, pl_total, stake_total,
  CASE WHEN (green + red) > 0 THEN ROUND(green::numeric * 100 / (green + red), 1) ELSE 0 END AS hit_rate_pct,
  CASE WHEN stake_total > 0 THEN ROUND(pl_total * 100 / stake_total, 1) ELSE 0 END AS roi_pct
FROM (SELECT * FROM det UNION ALL SELECT * FROM ia) x;

REVOKE ALL ON public.v_comparativo_ao_vivo FROM anon, authenticated;
GRANT SELECT ON public.v_comparativo_ao_vivo TO authenticated;