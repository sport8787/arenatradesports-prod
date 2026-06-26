-- Fix: get_live_sinais_summary — adiciona filtro de verdict ao WHERE principal.
-- Antes: contava TODOS os registros em live_sinais no período (inclusive não aprovados).
-- Depois: conta apenas verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA'),
--         consistente com get_live_sinais_ia_summary e com o comportamento esperado.

CREATE OR REPLACE FUNCTION public.get_live_sinais_summary(_period text DEFAULT 'today')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end   timestamptz;
  v_summary jsonb;
  v_signals jsonb;
BEGIN
  CASE _period
    WHEN 'today' THEN
      v_start := date_trunc('day', now());
      v_end   := now() + interval '1 second';
    WHEN 'yesterday' THEN
      v_start := date_trunc('day', now()) - interval '1 day';
      v_end   := date_trunc('day', now());
    WHEN '7d' THEN
      v_start := now() - interval '7 days';
      v_end   := now() + interval '1 second';
    WHEN '14d' THEN
      v_start := now() - interval '14 days';
      v_end   := now() + interval '1 second';
    WHEN '30d' THEN
      v_start := now() - interval '30 days';
      v_end   := now() + interval '1 second';
    ELSE
      v_start := date_trunc('day', now());
      v_end   := now() + interval '1 second';
  END CASE;

  -- Summary: apenas sinais aprovados (filtro de verdict agora no WHERE principal)
  SELECT jsonb_build_object(
    'total',          count(*),
    'approved_total', count(*),
    'pending_total',  count(*) filter (where result is null),
    'settled_total',  count(*) filter (where result in ('GREEN','RED','VOID','HALF_GREEN','HALF_RED')),
    'greens',         count(*) filter (where result = 'GREEN'),
    'reds',           count(*) filter (where result = 'RED'),
    'voids',          count(*) filter (where result in ('VOID','HALF_GREEN','HALF_RED')),
    'win_rate',       round(
                        (count(*) filter (where result = 'GREEN')::numeric
                          / nullif(count(*) filter (where result in ('GREEN','RED')), 0)
                        ) * 100, 1),
    'roi_percent',    round(
                        (coalesce(sum(profit_loss) filter (where result in ('GREEN','RED')), 0)
                          / nullif(sum(stake) filter (where result in ('GREEN','RED')), 0)
                        ) * 100, 2),
    'profit_total',   round(coalesce(sum(profit_loss) filter (where result in ('GREEN','RED')), 0), 2),
    'stake_total',    round(coalesce(sum(stake)       filter (where result in ('GREEN','RED')), 0), 2)
  )
  INTO v_summary
  FROM public.live_sinais
  WHERE match_date >= v_start
    AND match_date  < v_end
    AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA');  -- ← fix

  -- Lista de sinais: mesmo filtro de verdict
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.match_date DESC), '[]'::jsonb)
  INTO v_signals
  FROM (
    SELECT
      id, match_id, home_team, away_team, championship,
      market, market_key, odd, stake,
      confidence, verdict,
      approved_at_minute, approved_at_period, approved_at_score,
      match_date, result, goals_home, goals_away, profit_loss, settled_at
    FROM public.live_sinais
    WHERE match_date >= v_start
      AND match_date  < v_end
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')  -- ← fix
    ORDER BY match_date DESC
    LIMIT 1000
  ) x;

  RETURN jsonb_build_object('summary', v_summary, 'signals', v_signals);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_sinais_summary(text) TO anon, authenticated;
