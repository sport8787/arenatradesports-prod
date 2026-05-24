
-- Função interna que resolve sinais pendentes a partir do placar final
CREATE OR REPLACE FUNCTION public.settle_user_plan_signals()
RETURNS TABLE(settled integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  v_total_goals integer;
  v_won boolean;
  v_count integer := 0;
  v_uid uuid := auth.uid();
  v_is_admin boolean := has_role(auth.uid(), 'admin'::app_role);
BEGIN
  FOR rec IN
    SELECT s.id, s.market, s.outcome, s.line, s.selected_odd,
           lm.score_home, lm.score_away
    FROM public.user_trader_plan_signals s
    JOIN public.live_matches lm ON lm.match_id = s.match_id
    WHERE s.status = 'pending'
      AND lm.status = 'finished'
      AND lm.score_home IS NOT NULL
      AND lm.score_away IS NOT NULL
      AND (v_is_admin OR s.user_id = v_uid)
      AND s.market IN ('1x2','over_under','btts')
  LOOP
    v_total_goals := COALESCE(rec.score_home,0) + COALESCE(rec.score_away,0);
    v_won := false;
    IF rec.market = '1x2' THEN
      IF rec.outcome = 'home' AND rec.score_home > rec.score_away THEN v_won := true;
      ELSIF rec.outcome = 'away' AND rec.score_away > rec.score_home THEN v_won := true;
      ELSIF rec.outcome = 'draw' AND rec.score_home = rec.score_away THEN v_won := true;
      END IF;
    ELSIF rec.market = 'over_under' THEN
      IF rec.outcome = 'over'  AND v_total_goals > COALESCE(rec.line, 2.5) THEN v_won := true;
      ELSIF rec.outcome = 'under' AND v_total_goals < COALESCE(rec.line, 2.5) THEN v_won := true;
      END IF;
    ELSIF rec.market = 'btts' THEN
      IF rec.outcome = 'yes' AND rec.score_home > 0 AND rec.score_away > 0 THEN v_won := true;
      ELSIF rec.outcome = 'no'  AND (rec.score_home = 0 OR rec.score_away = 0) THEN v_won := true;
      END IF;
    END IF;

    UPDATE public.user_trader_plan_signals
       SET status = CASE WHEN v_won THEN 'green' ELSE 'red' END,
           profit_loss = CASE WHEN v_won THEN (COALESCE(selected_odd,1)::numeric - 1) ELSE -1 END,
           settled_at = now()
     WHERE id = rec.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_user_plan_signals() TO authenticated;

-- Resultado agregado por plano para a aba RESULTADOS
CREATE OR REPLACE FUNCTION public.get_user_plan_results(_period text DEFAULT '30d')
RETURNS TABLE(
  plan_id uuid,
  plan_name text,
  market text,
  total bigint,
  greens bigint,
  reds bigint,
  pending bigint,
  hit_rate numeric,
  profit_loss numeric,
  roi numeric,
  avg_odd numeric,
  last_signal_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz := now();
  v_uid uuid := auth.uid();
  v_is_admin boolean := has_role(auth.uid(), 'admin'::app_role);
BEGIN
  v_start := CASE _period
    WHEN 'today'     THEN (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo'
    WHEN 'yesterday' THEN (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') - interval '1 day') AT TIME ZONE 'America/Sao_Paulo'
    WHEN '7d'        THEN now() - interval '7 days'
    WHEN '14d'       THEN now() - interval '14 days'
    WHEN '30d'       THEN now() - interval '30 days'
    ELSE now() - interval '30 days'
  END;

  IF _period = 'yesterday' THEN
    v_end := (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo')) AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  RETURN QUERY
  SELECT
    s.plan_id,
    COALESCE(MAX(s.plan_name), 'Plano') AS plan_name,
    MAX(s.market) AS market,
    COUNT(*)::bigint AS total,
    COUNT(*) FILTER (WHERE s.status = 'green')::bigint AS greens,
    COUNT(*) FILTER (WHERE s.status = 'red')::bigint AS reds,
    COUNT(*) FILTER (WHERE s.status = 'pending')::bigint AS pending,
    CASE WHEN COUNT(*) FILTER (WHERE s.status IN ('green','red')) > 0
         THEN ROUND( 100.0 * COUNT(*) FILTER (WHERE s.status='green')::numeric
                    / NULLIF(COUNT(*) FILTER (WHERE s.status IN ('green','red'))::numeric,0), 2)
         ELSE 0 END AS hit_rate,
    ROUND(COALESCE(SUM(s.profit_loss) FILTER (WHERE s.status IN ('green','red')), 0)::numeric, 2) AS profit_loss,
    CASE WHEN COUNT(*) FILTER (WHERE s.status IN ('green','red')) > 0
         THEN ROUND( 100.0 * COALESCE(SUM(s.profit_loss) FILTER (WHERE s.status IN ('green','red')),0)::numeric
                    / NULLIF(COUNT(*) FILTER (WHERE s.status IN ('green','red'))::numeric,0), 2)
         ELSE 0 END AS roi,
    ROUND(AVG(s.selected_odd)::numeric, 2) AS avg_odd,
    MAX(s.placed_at) AS last_signal_at
  FROM public.user_trader_plan_signals s
  WHERE s.placed_at >= v_start
    AND s.placed_at <  v_end
    AND (v_is_admin OR s.user_id = v_uid)
  GROUP BY s.plan_id
  ORDER BY total DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_plan_results(text) TO authenticated;
