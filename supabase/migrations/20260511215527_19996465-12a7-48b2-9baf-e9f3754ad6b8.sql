ALTER TABLE public.trader_notifications_sent
  DROP CONSTRAINT IF EXISTS trader_notifications_sent_event_type_check;

ALTER TABLE public.trader_notifications_sent
  ADD CONSTRAINT trader_notifications_sent_event_type_check
  CHECK (event_type IN ('APROVADO', 'LABAREDA', 'CANCELADO', 'GREEN', 'RED', 'CASHOUT'));

CREATE OR REPLACE FUNCTION public.sync_live_sinal_from_notification(
  _match_id text,
  _market text,
  _event_type text,
  _home_team text,
  _away_team text,
  _odd numeric,
  _confidence numeric,
  _sent_at timestamptz
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market_key text;
  v_analysis record;
  v_match_date timestamptz;
  v_championship text;
  v_settled record;
  v_result text;
  v_profit_loss numeric;
BEGIN
  IF _event_type NOT IN ('APROVADO', 'LABAREDA') THEN
    RETURN;
  END IF;

  SELECT lm.championship
    INTO v_championship
  FROM public.live_matches lm
  WHERE lm.match_id = _match_id
  ORDER BY lm.updated_at DESC NULLS LAST, lm.created_at DESC NULLS LAST
  LIMIT 1;

  v_market_key := public.classify_market(_market, _home_team, _away_team);
  IF v_market_key IS NULL THEN
    RETURN;
  END IF;

  SELECT
    ma.id,
    ma.approved_at_minute,
    ma.approved_at_period,
    CASE
      WHEN ma.approved_at_score_home IS NOT NULL AND ma.approved_at_score_away IS NOT NULL
        THEN ma.approved_at_score_home || '-' || ma.approved_at_score_away
      ELSE NULL
    END AS approved_score,
    COALESCE(ma.approved_at_timestamp, ma.created_at) AS approved_at,
    ma.final_score_home,
    ma.final_score_away,
    ma.settled_at,
    ma.verdict,
    ma.odd
  INTO v_analysis
  FROM public.mycroft_analyses ma
  WHERE ma.match_id = _match_id
    AND ma.market = _market
    AND ma.verdict IN ('APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA')
  ORDER BY COALESCE(ma.approved_at_timestamp, ma.created_at) DESC
  LIMIT 1;

  v_match_date := COALESCE(v_analysis.approved_at, _sent_at, now());
  v_result := NULL;
  v_profit_loss := NULL;

  IF v_analysis.final_score_home IS NOT NULL AND v_analysis.final_score_away IS NOT NULL THEN
    SELECT s.result, s.profit_loss
      INTO v_settled
    FROM public.settle_signal(
      v_market_key,
      v_analysis.final_score_home,
      v_analysis.final_score_away,
      NULL,
      NULL,
      COALESCE(_odd, v_analysis.odd, 0),
      5.0
    ) s;

    v_result := v_settled.result;
    v_profit_loss := v_settled.profit_loss;
  END IF;

  INSERT INTO public.live_sinais (
    analysis_id,
    match_id,
    home_team,
    away_team,
    championship,
    market,
    market_key,
    odd,
    stake,
    confidence,
    verdict,
    approved_at_minute,
    approved_at_period,
    approved_at_score,
    match_date,
    result,
    goals_home,
    goals_away,
    profit_loss,
    settled_at
  ) VALUES (
    v_analysis.id,
    _match_id,
    _home_team,
    _away_team,
    v_championship,
    _market,
    v_market_key,
    _odd,
    5.0,
    _confidence::integer,
    COALESCE(v_analysis.verdict, CASE WHEN _event_type = 'LABAREDA' THEN 'LABAREDA' ELSE 'APROVADO' END),
    v_analysis.approved_at_minute,
    v_analysis.approved_at_period,
    v_analysis.approved_score,
    v_match_date,
    v_result,
    v_analysis.final_score_home,
    v_analysis.final_score_away,
    v_profit_loss,
    CASE WHEN v_result IS NOT NULL THEN COALESCE(v_analysis.settled_at, now()) END
  )
  ON CONFLICT (match_id, market_key) DO UPDATE SET
    analysis_id = COALESCE(EXCLUDED.analysis_id, live_sinais.analysis_id),
    home_team = COALESCE(EXCLUDED.home_team, live_sinais.home_team),
    away_team = COALESCE(EXCLUDED.away_team, live_sinais.away_team),
    championship = COALESCE(EXCLUDED.championship, live_sinais.championship),
    market = EXCLUDED.market,
    odd = COALESCE(EXCLUDED.odd, live_sinais.odd),
    confidence = COALESCE(EXCLUDED.confidence, live_sinais.confidence),
    verdict = COALESCE(EXCLUDED.verdict, live_sinais.verdict),
    approved_at_minute = COALESCE(EXCLUDED.approved_at_minute, live_sinais.approved_at_minute),
    approved_at_period = COALESCE(EXCLUDED.approved_at_period, live_sinais.approved_at_period),
    approved_at_score = COALESCE(EXCLUDED.approved_at_score, live_sinais.approved_at_score),
    match_date = LEAST(live_sinais.match_date, EXCLUDED.match_date),
    result = COALESCE(EXCLUDED.result, live_sinais.result),
    goals_home = COALESCE(EXCLUDED.goals_home, live_sinais.goals_home),
    goals_away = COALESCE(EXCLUDED.goals_away, live_sinais.goals_away),
    profit_loss = COALESCE(EXCLUDED.profit_loss, live_sinais.profit_loss),
    settled_at = COALESCE(EXCLUDED.settled_at, live_sinais.settled_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_live_sinais_from_notifications(_days integer DEFAULT 2)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT match_id, market, event_type, home_team, away_team, odd, confidence, sent_at
    FROM public.trader_notifications_sent
    WHERE event_type IN ('APROVADO', 'LABAREDA')
      AND sent_at >= now() - make_interval(days => GREATEST(_days, 1))
    ORDER BY sent_at ASC
  LOOP
    PERFORM public.sync_live_sinal_from_notification(
      v_row.match_id,
      v_row.market,
      v_row.event_type,
      v_row.home_team,
      v_row.away_team,
      v_row.odd,
      v_row.confidence,
      v_row.sent_at
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_live_sinais_summary(_period text DEFAULT 'today')
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz;
  v_end timestamptz;
  v_summary jsonb;
  v_signals jsonb;
BEGIN
  CASE _period
    WHEN 'today' THEN
      v_start := date_trunc('day', now());
      v_end := now() + interval '1 second';
    WHEN 'yesterday' THEN
      v_start := date_trunc('day', now()) - interval '1 day';
      v_end := date_trunc('day', now());
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
      v_start := date_trunc('day', now());
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
           match_date, result, goals_home, goals_away, profit_loss, settled_at
    FROM public.live_sinais
    WHERE match_date >= v_start AND match_date < v_end
    ORDER BY match_date DESC
    LIMIT 1000
  ) x;

  RETURN jsonb_build_object('summary', v_summary, 'signals', v_signals);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_live_sinal_from_notification(text, text, text, text, text, numeric, numeric, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.backfill_live_sinais_from_notifications(integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_live_sinais_summary(text) TO anon, authenticated;

SELECT public.backfill_live_sinais_from_notifications(2);