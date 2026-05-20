CREATE OR REPLACE FUNCTION public.get_live_sinais_summary(_period text DEFAULT 'today'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_today_br date;
  v_summary jsonb;
  v_signals jsonb;
BEGIN
  -- Sempre fatiar o dia em horário de Brasília (America/Sao_Paulo)
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
      v_start := (v_today_br::timestamp AT TIME ZONE 'America/Sao_Paulo');
      v_end := now() + interval '1 second';
  END CASE;

  SELECT jsonb_build_object(
    'total', count(*),
    'approved_total', count(*) filter (where verdict in ('APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA')),
    'pending_total', count(*) filter (where result is null),
    'settled_total', count(*) filter (where result in ('GREEN', 'RED', 'VOID', 'HALF_GREEN', 'HALF_RED')),
    'greens', count(*) filter (where result = 'GREEN'),
    'reds', count(*) filter (where result = 'RED'),
    'voids', count(*) filter (where result in ('VOID', 'HALF_GREEN', 'HALF_RED')),
    'win_rate', round((count(*) filter (where result = 'GREEN')::numeric / nullif(count(*) filter (where result in ('GREEN', 'RED')), 0)) * 100, 1),
    'roi_percent', round((coalesce(sum(profit_loss) filter (where result in ('GREEN', 'RED')), 0) / nullif(sum(stake) filter (where result in ('GREEN', 'RED')), 0)) * 100, 2),
    'profit_total', round(coalesce(sum(profit_loss) filter (where result in ('GREEN', 'RED')), 0), 2),
    'stake_total', round(coalesce(sum(stake) filter (where result in ('GREEN', 'RED')), 0), 2)
  )
  INTO v_summary
  FROM public.live_sinais
  WHERE match_date >= v_start AND match_date < v_end;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.match_date DESC), '[]'::jsonb)
  INTO v_signals
  FROM (
    SELECT id, match_id, home_team, away_team, championship, market, market_key, odd, stake,
           confidence, verdict, approved_at_minute, approved_at_period, approved_at_score,
           match_date, result, goals_home, goals_away, profit_loss, settled_at, created_at
    FROM public.live_sinais
    WHERE match_date >= v_start AND match_date < v_end
  ) x;

  RETURN jsonb_build_object('summary', v_summary, 'signals', v_signals);
END;
$function$;