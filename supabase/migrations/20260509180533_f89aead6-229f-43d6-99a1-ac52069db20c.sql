
CREATE OR REPLACE FUNCTION public.league_roi_before_after(p_pivot timestamptz, p_window_days int DEFAULT 30)
RETURNS TABLE(
  championship text,
  tier text,
  enabled boolean,
  before_total int,
  before_green int,
  before_red int,
  before_hit_rate numeric,
  before_roi numeric,
  after_total int,
  after_green int,
  after_red int,
  after_hit_rate numeric,
  after_roi numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH base AS (
    SELECT
      COALESCE(lm.championship, 'Desconhecida') AS championship,
      a.result,
      a.odd,
      a.settled_at
    FROM public.mycroft_analyses a
    LEFT JOIN public.live_matches lm ON lm.match_id = a.match_id
    WHERE a.verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND a.result IN ('green','red')
      AND a.settled_at IS NOT NULL
      AND a.settled_at >= (p_pivot - make_interval(days => p_window_days))
      AND a.settled_at <= (p_pivot + make_interval(days => p_window_days))
  ),
  agg AS (
    SELECT
      championship,
      COUNT(*) FILTER (WHERE settled_at < p_pivot) AS before_total,
      COUNT(*) FILTER (WHERE settled_at < p_pivot AND result='green') AS before_green,
      COUNT(*) FILTER (WHERE settled_at < p_pivot AND result='red') AS before_red,
      COALESCE(SUM(CASE WHEN settled_at < p_pivot
                        THEN CASE WHEN result='green' THEN COALESCE(odd,1)-1 ELSE -1 END
                        ELSE 0 END),0) AS before_pnl,
      COUNT(*) FILTER (WHERE settled_at >= p_pivot) AS after_total,
      COUNT(*) FILTER (WHERE settled_at >= p_pivot AND result='green') AS after_green,
      COUNT(*) FILTER (WHERE settled_at >= p_pivot AND result='red') AS after_red,
      COALESCE(SUM(CASE WHEN settled_at >= p_pivot
                        THEN CASE WHEN result='green' THEN COALESCE(odd,1)-1 ELSE -1 END
                        ELSE 0 END),0) AS after_pnl
    FROM base
    GROUP BY championship
  )
  SELECT
    g.championship,
    tl.tier,
    tl.enabled,
    g.before_total, g.before_green, g.before_red,
    CASE WHEN g.before_total>0 THEN ROUND(g.before_green::numeric/g.before_total,4) ELSE 0 END,
    CASE WHEN g.before_total>0 THEN ROUND(g.before_pnl/g.before_total,4) ELSE 0 END,
    g.after_total, g.after_green, g.after_red,
    CASE WHEN g.after_total>0 THEN ROUND(g.after_green::numeric/g.after_total,4) ELSE 0 END,
    CASE WHEN g.after_total>0 THEN ROUND(g.after_pnl/g.after_total,4) ELSE 0 END
  FROM agg g
  LEFT JOIN public.trader_leagues tl ON lower(tl.name) = lower(g.championship)
  ORDER BY (g.before_total + g.after_total) DESC;
$$;

GRANT EXECUTE ON FUNCTION public.league_roi_before_after(timestamptz, int) TO authenticated;
