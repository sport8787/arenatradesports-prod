CREATE TABLE IF NOT EXISTS public.live_sinais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID REFERENCES public.mycroft_analyses(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  home_team TEXT,
  away_team TEXT,
  championship TEXT,
  market TEXT NOT NULL,
  odd NUMERIC(6,2),
  stake NUMERIC(6,2) NOT NULL DEFAULT 5.0,
  confidence INTEGER,
  verdict TEXT NOT NULL,
  approved_at_minute INTEGER,
  approved_at_period TEXT,
  approved_at_score TEXT,
  match_date TIMESTAMPTZ NOT NULL,
  result TEXT,
  goals_home INTEGER,
  goals_away INTEGER,
  profit_loss NUMERIC(8,2),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT live_sinais_match_market_uniq UNIQUE (match_id, market)
);

CREATE INDEX IF NOT EXISTS idx_live_sinais_match_date ON public.live_sinais (match_date DESC);
CREATE INDEX IF NOT EXISTS idx_live_sinais_result ON public.live_sinais (result);
CREATE INDEX IF NOT EXISTS idx_live_sinais_pending ON public.live_sinais (match_date) WHERE result IS NULL;

ALTER TABLE public.live_sinais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_sinais public read" ON public.live_sinais FOR SELECT USING (true);
CREATE POLICY "live_sinais service write" ON public.live_sinais FOR ALL
USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION public.tg_live_sinais_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_live_sinais_updated ON public.live_sinais;
CREATE TRIGGER trg_live_sinais_updated
BEFORE UPDATE ON public.live_sinais
FOR EACH ROW EXECUTE FUNCTION public.tg_live_sinais_updated();

CREATE OR REPLACE FUNCTION public.calc_signal_pnl(_result TEXT, _odd NUMERIC, _stake NUMERIC)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _result
    WHEN 'GREEN' THEN _stake * (_odd - 1)
    WHEN 'RED' THEN -_stake
    WHEN 'HALF_GREEN' THEN (_stake * (_odd - 1)) / 2
    WHEN 'HALF_RED' THEN -_stake / 2
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.tg_sync_live_sinais()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_home TEXT; v_away TEXT; v_champ TEXT; v_pnl NUMERIC; v_match_date TIMESTAMPTZ;
BEGIN
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN
    RETURN NEW;
  END IF;

  SELECT lm.home_team, lm.away_team, lm.championship
    INTO v_home, v_away, v_champ
  FROM public.live_matches lm WHERE lm.match_id = NEW.match_id LIMIT 1;

  v_match_date := COALESCE(NEW.approved_at_timestamp, NEW.created_at);
  v_pnl := public.calc_signal_pnl(NEW.result, NEW.odd, 5.0);

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
    NEW.result, NEW.final_score_home, NEW.final_score_away, v_pnl, NEW.settled_at
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

DROP TRIGGER IF EXISTS trg_sync_live_sinais ON public.mycroft_analyses;
CREATE TRIGGER trg_sync_live_sinais
AFTER INSERT OR UPDATE OF verdict, result, final_score_home, final_score_away, settled_at
ON public.mycroft_analyses
FOR EACH ROW EXECUTE FUNCTION public.tg_sync_live_sinais();

INSERT INTO public.live_sinais (
  analysis_id, match_id, home_team, away_team, championship,
  market, odd, stake, confidence, verdict,
  approved_at_minute, approved_at_period, approved_at_score, match_date,
  result, goals_home, goals_away, profit_loss, settled_at, created_at
)
SELECT
  ma.id, ma.match_id, lm.home_team, lm.away_team, lm.championship,
  ma.market, ma.odd, 5.0, ma.confidence, ma.verdict,
  ma.approved_at_minute, ma.approved_at_period,
  CASE WHEN ma.approved_at_score_home IS NOT NULL
       THEN ma.approved_at_score_home || '-' || ma.approved_at_score_away END,
  COALESCE(ma.approved_at_timestamp, ma.created_at),
  ma.result, ma.final_score_home, ma.final_score_away,
  public.calc_signal_pnl(ma.result, ma.odd, 5.0),
  ma.settled_at, ma.created_at
FROM public.mycroft_analyses ma
LEFT JOIN public.live_matches lm ON lm.match_id = ma.match_id
WHERE ma.verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
  AND ma.created_at >= NOW() - INTERVAL '30 days'
ON CONFLICT (match_id, market) DO NOTHING;

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

  SELECT COALESCE(jsonb_agg(row_to_json(s) ORDER BY (s->>'match_date') DESC), '[]'::jsonb)
  INTO v_signals
  FROM (
    SELECT to_jsonb(x) AS s, x.match_date
    FROM (
      SELECT id, match_id, home_team, away_team, championship, market, odd, stake,
             confidence, verdict, approved_at_minute, approved_at_score, match_date,
             result, goals_home, goals_away, profit_loss, settled_at
      FROM public.live_sinais
      WHERE match_date >= NOW() - v_interval
      ORDER BY match_date DESC
      LIMIT 500
    ) x
  ) t;

  RETURN jsonb_build_object('summary', v_summary, 'signals', v_signals);
END $$;

GRANT EXECUTE ON FUNCTION public.get_live_sinais_summary(TEXT) TO anon, authenticated;