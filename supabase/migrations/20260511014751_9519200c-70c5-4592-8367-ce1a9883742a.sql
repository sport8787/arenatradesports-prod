-- Normaliza calc_signal_pnl para aceitar lowercase
CREATE OR REPLACE FUNCTION public.calc_signal_pnl(_result TEXT, _odd NUMERIC, _stake NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE UPPER(COALESCE(_result, ''))
    WHEN 'GREEN' THEN _stake * (_odd - 1)
    WHEN 'RED' THEN -_stake
    WHEN 'HALF_GREEN' THEN (_stake * (_odd - 1)) / 2
    WHEN 'HALF_RED' THEN -_stake / 2
    ELSE 0
  END
$$;

-- Trigger atualizado: normaliza result para uppercase
CREATE OR REPLACE FUNCTION public.tg_sync_live_sinais()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_home TEXT; v_away TEXT; v_champ TEXT; v_pnl NUMERIC; v_match_date TIMESTAMPTZ;
  v_result TEXT;
BEGIN
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN
    RETURN NEW;
  END IF;

  SELECT lm.home_team, lm.away_team, lm.championship
    INTO v_home, v_away, v_champ
  FROM public.live_matches lm WHERE lm.match_id = NEW.match_id LIMIT 1;

  v_match_date := COALESCE(NEW.approved_at_timestamp, NEW.created_at);
  v_result := NULLIF(UPPER(COALESCE(NEW.result, '')), '');
  v_pnl := public.calc_signal_pnl(v_result, NEW.odd, 5.0);

  INSERT INTO public.live_sinais (
    analysis_id, match_id, home_team, away_team, championship,
    market, odd, stake, confidence, verdict,
    approved_at_minute, approved_at_period, approved_at_score, match_date,
    result, goals_home, goals_away, profit_loss, settled_at
  ) VALUES (
    NEW.id, NEW.match_id, v_home, v_away, v_champ,
    NEW.market, NEW.odd, 5.0, NEW.confidence, NEW.verdict,
    NEW.approved_at_minute, NEW.approved_at_period,
    CASE WHEN NEW.approved_at_score_home IS NOT NULL
         THEN NEW.approved_at_score_home || '-' || NEW.approved_at_score_away END,
    v_match_date,
    v_result, NEW.final_score_home, NEW.final_score_away, v_pnl, NEW.settled_at
  )
  ON CONFLICT (match_id, market) DO UPDATE SET
    analysis_id = EXCLUDED.analysis_id,
    verdict = EXCLUDED.verdict,
    odd = EXCLUDED.odd,
    confidence = EXCLUDED.confidence,
    result = EXCLUDED.result,
    goals_home = EXCLUDED.goals_home,
    goals_away = EXCLUDED.goals_away,
    profit_loss = EXCLUDED.profit_loss,
    settled_at = EXCLUDED.settled_at;

  RETURN NEW;
END $$;

-- Re-normaliza dados existentes
UPDATE public.live_sinais
SET result = UPPER(result),
    profit_loss = public.calc_signal_pnl(UPPER(result), odd, stake)
WHERE result IS NOT NULL AND result <> UPPER(result);

-- RPC corrigida
CREATE OR REPLACE FUNCTION public.get_live_sinais_summary(_period TEXT DEFAULT '7d')
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_interval INTERVAL; v_summary JSONB; v_signals JSONB;
BEGIN
  v_interval := CASE _period
    WHEN 'today' THEN (NOW() - DATE_TRUNC('day', NOW()))
    WHEN '7d' THEN INTERVAL '7 days'
    WHEN '14d' THEN INTERVAL '14 days'
    WHEN '30d' THEN INTERVAL '30 days'
    ELSE INTERVAL '7 days'
  END;

  SELECT jsonb_build_object(
    'total', COUNT(*),
    'greens', COUNT(*) FILTER (WHERE result = 'GREEN'),
    'reds', COUNT(*) FILTER (WHERE result = 'RED'),
    'voids', COUNT(*) FILTER (WHERE result IN ('VOID','HALF_GREEN','HALF_RED')),
    'pendings', COUNT(*) FILTER (WHERE result IS NULL),
    'win_rate', ROUND(
      (COUNT(*) FILTER (WHERE result = 'GREEN')::numeric
       / NULLIF(COUNT(*) FILTER (WHERE result IN ('GREEN','RED')), 0)) * 100, 1),
    'roi_percent', ROUND(
      (COALESCE(SUM(profit_loss) FILTER (WHERE result IN ('GREEN','RED')), 0)
       / NULLIF(SUM(stake) FILTER (WHERE result IN ('GREEN','RED')), 0)) * 100, 2),
    'profit_total', ROUND(COALESCE(SUM(profit_loss) FILTER (WHERE result IN ('GREEN','RED')), 0), 2),
    'stake_total', ROUND(COALESCE(SUM(stake) FILTER (WHERE result IN ('GREEN','RED')), 0), 2)
  )
  INTO v_summary
  FROM public.live_sinais
  WHERE match_date >= NOW() - v_interval;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.match_date DESC), '[]'::jsonb)
  INTO v_signals
  FROM (
    SELECT id, match_id, home_team, away_team, championship, market, odd, stake,
           confidence, verdict, approved_at_minute, approved_at_score, match_date,
           result, goals_home, goals_away, profit_loss, settled_at
    FROM public.live_sinais
    WHERE match_date >= NOW() - v_interval
    ORDER BY match_date DESC
    LIMIT 500
  ) x;

  RETURN jsonb_build_object('summary', v_summary, 'signals', v_signals);
END $$;