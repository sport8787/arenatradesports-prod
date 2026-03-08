
-- ═══════════════════════════════════════
-- MARKET MANIPULATION DETECTOR
-- ═══════════════════════════════════════
CREATE TABLE public.market_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  market text NOT NULL,
  prob_model decimal(5,4) NOT NULL,
  prob_market decimal(5,4) NOT NULL,
  market_inefficiency_score decimal(5,2),
  odds_drift_index decimal(5,2),
  odd_open decimal(6,3),
  odd_current decimal(6,3),
  inefficiency_level text,
  analyzed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_market_analysis_match ON public.market_analysis(match_id);
CREATE INDEX idx_market_analysis_level ON public.market_analysis(inefficiency_level);

ALTER TABLE public.market_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view market analysis"
  ON public.market_analysis FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can manage market analysis"
  ON public.market_analysis FOR ALL
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════
-- SHARP MONEY DETECTOR
-- ═══════════════════════════════════════
CREATE TABLE public.sharp_money_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  market text NOT NULL,
  has_rlm boolean DEFAULT false,
  has_steam boolean DEFAULT false,
  has_consensus boolean DEFAULT false,
  sharp_activity_score integer DEFAULT 0,
  odd_open decimal(6,3),
  odd_current decimal(6,3),
  odd_movement_pct decimal(5,2),
  detected_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_sharp_signals_match ON public.sharp_money_signals(match_id);
CREATE INDEX idx_sharp_signals_score ON public.sharp_money_signals(sharp_activity_score DESC);

ALTER TABLE public.sharp_money_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sharp money signals"
  ON public.sharp_money_signals FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can manage sharp signals"
  ON public.sharp_money_signals FOR ALL
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════
-- SELF LEARNING ENGINE
-- ═══════════════════════════════════════
CREATE TABLE public.model_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  date date NOT NULL,
  league text,
  market text,
  odd_range text,
  total_bets integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  win_rate decimal(5,2) DEFAULT 0,
  roi decimal(8,4) DEFAULT 0,
  profit decimal(12,2) DEFAULT 0,
  avg_odd decimal(6,3),
  avg_asset_score decimal(5,2),
  avg_edge decimal(5,2),
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(period, date, league, market, odd_range)
);

CREATE INDEX idx_model_perf_league ON public.model_performance(league);
CREATE INDEX idx_model_perf_market ON public.model_performance(market);
CREATE INDEX idx_model_perf_roi ON public.model_performance(roi DESC);

ALTER TABLE public.model_performance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view model performance"
  ON public.model_performance FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can manage model performance"
  ON public.model_performance FOR ALL
  USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════
-- PORTFOLIO OPTIMIZATION
-- ═══════════════════════════════════════
CREATE TABLE public.bet_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_a text NOT NULL,
  market_b text NOT NULL,
  correlation_coefficient decimal(5,4),
  sample_size integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(market_a, market_b)
);

CREATE INDEX idx_correlations_markets ON public.bet_correlations(market_a, market_b);

ALTER TABLE public.bet_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bet correlations"
  ON public.bet_correlations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Service role can manage correlations"
  ON public.bet_correlations FOR ALL
  USING (true) WITH CHECK (true);
