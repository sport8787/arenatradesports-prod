
-- ═══════════════════════════════════════════════════════
-- MYCROFT PUNTER - TABELAS
-- ═══════════════════════════════════════════════════════

-- Tabela: punter_analyses (todas análises pré-jogo)
CREATE TABLE public.punter_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  market TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  odd DECIMAL(5,2) NOT NULL,
  fair_odd DECIMAL(5,2),
  implied_probability DECIMAL(5,2),
  estimated_probability DECIMAL(5,2),
  value_percentage DECIMAL(5,2),
  verdict TEXT NOT NULL,
  confidence INTEGER,
  stake_percentage INTEGER,
  thesis TEXT,
  analysis TEXT,
  risk_factors TEXT,
  analyzed_by TEXT DEFAULT 'mycroft-punter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_punter_analyses_commence ON public.punter_analyses(commence_time);
CREATE INDEX idx_punter_analyses_verdict ON public.punter_analyses(verdict);
CREATE INDEX idx_punter_analyses_created ON public.punter_analyses(created_at DESC);

-- RLS
ALTER TABLE public.punter_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view punter analyses"
ON public.punter_analyses FOR SELECT USING (true);

CREATE POLICY "Service role can manage punter analyses"
ON public.punter_analyses FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ═══════════════════════════════════════════════════════
-- Tabela: punter_signals (sinais aprovados + tracking)
-- ═══════════════════════════════════════════════════════

CREATE TABLE public.punter_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES public.punter_analyses(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,
  market TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  odd DECIMAL(5,2) NOT NULL,
  value_percentage DECIMAL(5,2),
  stake_percentage INTEGER,
  status TEXT DEFAULT 'pending',
  result TEXT,
  profit_loss DECIMAL(10,2),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  resulted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_punter_signals_status ON public.punter_signals(status);
CREATE INDEX idx_punter_signals_match ON public.punter_signals(match_id);
CREATE INDEX idx_punter_signals_sent ON public.punter_signals(sent_at DESC);

-- RLS
ALTER TABLE public.punter_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view punter signals"
ON public.punter_signals FOR SELECT USING (true);

CREATE POLICY "Service role can manage punter signals"
ON public.punter_signals FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Tabela: virtual_bets_punter (apostas virtuais do punter, vinculadas à banca do usuário)
CREATE TABLE public.virtual_bets_punter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  signal_id UUID REFERENCES public.punter_signals(id),
  match_id TEXT NOT NULL,
  match_name TEXT NOT NULL,
  market TEXT NOT NULL,
  odd DECIMAL(5,2) NOT NULL,
  stake DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'pending',
  result TEXT,
  profit_loss DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vbp_user ON public.virtual_bets_punter(user_id);
CREATE INDEX idx_vbp_status ON public.virtual_bets_punter(status);

ALTER TABLE public.virtual_bets_punter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own punter bets"
ON public.virtual_bets_punter FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own punter bets"
ON public.virtual_bets_punter FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own punter bets"
ON public.virtual_bets_punter FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_vbp_updated_at
BEFORE UPDATE ON public.virtual_bets_punter
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_punter_signals_updated_at
BEFORE UPDATE ON public.punter_signals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
