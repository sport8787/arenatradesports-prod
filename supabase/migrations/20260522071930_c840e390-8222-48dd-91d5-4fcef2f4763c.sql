CREATE OR REPLACE FUNCTION public.get_live_sinais_ia_summary(_period text DEFAULT 'today')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_today_br date;
  v_summary jsonb;
  v_signals jsonb;
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
      v_start := (v_today_br::timestamp AT TIME ZONE 'America/Sao_Paulo');
      v_end := now() + interval '1 second';
  END CASE;

  WITH base AS (
    SELECT
      id, odd, UPPER(result) AS result_u,
      CASE
        WHEN UPPER(result) = 'GREEN' THEN ROUND((COALESCE(odd,1) - 1)::numeric, 2)
        WHEN UPPER(result) = 'RED' THEN -1.0
        ELSE NULL
      END AS profit_loss,
      CASE WHEN UPPER(result) IN ('GREEN','RED') THEN 1.0 ELSE NULL END AS stake,
      verdict
    FROM public.mycroft_analyses_shadow_ai
    WHERE created_at >= v_start AND created_at < v_end
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'approved_total', count(*),
    'pending_total', count(*) filter (where result_u is null),
    'settled_total', count(*) filter (where result_u in ('GREEN','RED','VOID','HALF_GREEN','HALF_RED')),
    'greens', count(*) filter (where result_u = 'GREEN'),
    'reds', count(*) filter (where result_u = 'RED'),
    'voids', count(*) filter (where result_u in ('VOID','HALF_GREEN','HALF_RED')),
    'win_rate', round((count(*) filter (where result_u = 'GREEN')::numeric / nullif(count(*) filter (where result_u in ('GREEN','RED')),0)) * 100, 1),
    'roi_percent', round((coalesce(sum(profit_loss) filter (where result_u in ('GREEN','RED')),0) / nullif(sum(stake) filter (where result_u in ('GREEN','RED')),0)) * 100, 2),
    'profit_total', round(coalesce(sum(profit_loss) filter (where result_u in ('GREEN','RED')),0), 2),
    'stake_total', round(coalesce(sum(stake) filter (where result_u in ('GREEN','RED')),0), 2)
  )
  INTO v_summary
  FROM base;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.match_date DESC), '[]'::jsonb)
  INTO v_signals
  FROM (
    SELECT
      id, match_id, home_team, away_team, championship, market,
      market AS market_key,
      odd, 1.0::numeric AS stake, confidence, verdict,
      approved_at_minute,
      NULL::text AS approved_at_period,
      CASE
        WHEN approved_at_score_home IS NOT NULL AND approved_at_score_away IS NOT NULL
          THEN approved_at_score_home || '-' || approved_at_score_away
        ELSE NULL
      END AS approved_at_score,
      created_at AS match_date,
      UPPER(result) AS result,
      final_score_home AS goals_home,
      final_score_away AS goals_away,
      CASE
        WHEN UPPER(result) = 'GREEN' THEN ROUND((COALESCE(odd,1) - 1)::numeric, 2)
        WHEN UPPER(result) = 'RED' THEN -1.0
        ELSE NULL
      END AS profit_loss,
      settled_at,
      created_at
    FROM public.mycroft_analyses_shadow_ai
    WHERE created_at >= v_start AND created_at < v_end
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
  ) x;

  RETURN jsonb_build_object('summary', v_summary, 'signals', v_signals);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_sinais_ia_summary(text) TO authenticated;