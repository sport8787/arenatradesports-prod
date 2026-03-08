
-- =============================================
-- TABELA 1: arena_matches (histórico de partidas)
-- =============================================
CREATE TABLE public.arena_matches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id text NOT NULL,
  league text NOT NULL,
  season text,
  home_team text NOT NULL,
  away_team text NOT NULL,
  match_date timestamp with time zone NOT NULL,
  score_home integer,
  score_away integer,
  result text, -- 'home', 'draw', 'away'
  xg_home numeric,
  xg_away numeric,
  possession_home numeric,
  possession_away numeric,
  shots_home integer,
  shots_away integer,
  shots_on_target_home integer,
  shots_on_target_away integer,
  corners_home integer,
  corners_away integer,
  cards_home integer,
  cards_away integer,
  dangerous_attacks_home integer,
  dangerous_attacks_away integer,
  stats jsonb DEFAULT '{}'::jsonb,
  source text DEFAULT 'api-football',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(match_id)
);

ALTER TABLE public.arena_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view arena matches" ON public.arena_matches
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage arena matches" ON public.arena_matches
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- TABELA 2: arena_odds (histórico de odds por bookmaker)
-- =============================================
CREATE TABLE public.arena_odds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id text NOT NULL,
  market text NOT NULL,
  bookmaker text NOT NULL,
  odd_open numeric,
  odd_close numeric,
  odd_current numeric,
  timestamp_open timestamp with time zone,
  timestamp_close timestamp with time zone,
  timestamp_current timestamp with time zone DEFAULT now(),
  movement_pct numeric, -- % change from open to close
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_odds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view arena odds" ON public.arena_odds
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage arena odds" ON public.arena_odds
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_arena_odds_match_id ON public.arena_odds(match_id);
CREATE INDEX idx_arena_odds_market ON public.arena_odds(market);

-- =============================================
-- TABELA 3: arena_patterns (padrões lucrativos)
-- =============================================
CREATE TABLE public.arena_patterns (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  league text NOT NULL,
  market text NOT NULL,
  pattern_type text DEFAULT 'standard', -- 'standard', 'conditional', 'composite'
  sample_size integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  roi numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  avg_odd numeric,
  confidence numeric NOT NULL DEFAULT 0, -- 0-100
  is_profitable boolean NOT NULL DEFAULT false,
  conditions jsonb DEFAULT '{}'::jsonb, -- filtros adicionais (ex: "after_loss", "home_favorite")
  last_calculated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(league, market, pattern_type)
);

ALTER TABLE public.arena_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view arena patterns" ON public.arena_patterns
  FOR SELECT USING (true);

CREATE POLICY "Service role can manage arena patterns" ON public.arena_patterns
  FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- TABELA 4: bets_history (histórico unificado para self-learning)
-- =============================================
CREATE TABLE public.bets_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  match_id text NOT NULL,
  league text,
  season text,
  home_team text,
  away_team text,
  market text NOT NULL,
  bookmaker text,
  odd numeric NOT NULL,
  stake numeric NOT NULL DEFAULT 0,
  stake_percentage numeric,
  probability_model numeric,
  probability_market numeric,
  asset_score integer,
  asset_classification text, -- 'ELITE', 'PREMIUM', 'STRONG', 'SPECULATIVE'
  edge numeric,
  source text NOT NULL DEFAULT 'user', -- 'horus' ou 'user'
  result text, -- 'green', 'red', 'void', 'pending'
  profit_loss numeric DEFAULT 0,
  odd_close numeric, -- para CLV
  clv numeric, -- closing line value
  score_home integer,
  score_away integer,
  placed_at timestamp with time zone DEFAULT now(),
  resulted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.bets_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bets history" ON public.bets_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bets history" ON public.bets_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bets history" ON public.bets_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all bets history" ON public.bets_history
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_bets_history_user_id ON public.bets_history(user_id);
CREATE INDEX idx_bets_history_match_id ON public.bets_history(match_id);
CREATE INDEX idx_bets_history_league ON public.bets_history(league);
CREATE INDEX idx_bets_history_source ON public.bets_history(source);
CREATE INDEX idx_bets_history_result ON public.bets_history(result);
