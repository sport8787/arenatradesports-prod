CREATE TABLE public.punter_sinais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  legacy_signal_id UUID,
  legacy_analysis_id UUID,
  match_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT,
  commence_time TIMESTAMP WITH TIME ZONE NOT NULL,
  match_date DATE,
  market TEXT NOT NULL,
  bookmaker TEXT,
  odd NUMERIC,
  fair_odd NUMERIC,
  implied_probability NUMERIC,
  estimated_probability NUMERIC,
  value_percentage NUMERIC,
  verdict TEXT,
  confidence INTEGER,
  stake_percentage INTEGER,
  stake_amount NUMERIC,
  thesis TEXT,
  analysis TEXT,
  risk_factors TEXT,
  analyzed_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resultado TEXT,
  profit_loss NUMERIC,
  final_score_home INTEGER,
  final_score_away INTEGER,
  red_card_home BOOLEAN,
  red_card_away BOOLEAN,
  sent_to_telegram BOOLEAN NOT NULL DEFAULT false,
  telegram_sent_at TIMESTAMP WITH TIME ZONE,
  sent_to_email BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  sent_green_to_telegram BOOLEAN NOT NULL DEFAULT false,
  green_telegram_sent_at TIMESTAMP WITH TIME ZONE,
  resulted_at TIMESTAMP WITH TIME ZONE,
  settled_at TIMESTAMP WITH TIME ZONE,
  settle_attempts INTEGER NOT NULL DEFAULT 0,
  last_settle_attempt_at TIMESTAMP WITH TIME ZONE,
  stake_confirmed BOOLEAN NOT NULL DEFAULT false,
  stake_recalculated_at TIMESTAMP WITH TIME ZONE,
  bankroll_at_recalc NUMERIC,
  stake_percentage_original NUMERIC,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uniq_punter_sinais_match_market UNIQUE (match_id, market)
);

CREATE INDEX idx_punter_sinais_match ON public.punter_sinais (match_id);
CREATE INDEX idx_punter_sinais_status ON public.punter_sinais (status);
CREATE INDEX idx_punter_sinais_commence ON public.punter_sinais (commence_time);
CREATE INDEX idx_punter_sinais_created ON public.punter_sinais (created_at DESC);
CREATE INDEX idx_punter_sinais_settle ON public.punter_sinais (resultado, commence_time) WHERE (resultado IS NULL AND dismissed = false);
CREATE INDEX idx_punter_sinais_legacy_signal ON public.punter_sinais (legacy_signal_id);
CREATE INDEX idx_punter_sinais_legacy_analysis ON public.punter_sinais (legacy_analysis_id);

ALTER TABLE public.punter_sinais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view punter unified signals"
ON public.punter_sinais
FOR SELECT
USING (true);

CREATE POLICY "Service role can manage punter unified signals"
ON public.punter_sinais
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TRIGGER update_punter_sinais_updated_at
BEFORE UPDATE ON public.punter_sinais
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();