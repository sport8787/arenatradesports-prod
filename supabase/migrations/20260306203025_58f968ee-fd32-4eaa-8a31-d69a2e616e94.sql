
-- Ranking Global de Investidores
CREATE TABLE public.punter_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  username text NOT NULL DEFAULT 'Investidor',
  total_bets integer NOT NULL DEFAULT 0,
  green_bets integer NOT NULL DEFAULT 0,
  red_bets integer NOT NULL DEFAULT 0,
  total_staked numeric NOT NULL DEFAULT 0,
  total_profit numeric NOT NULL DEFAULT 0,
  roi numeric NOT NULL DEFAULT 0,
  win_rate numeric NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  max_drawdown numeric NOT NULL DEFAULT 0,
  sharpe_ratio numeric NOT NULL DEFAULT 0,
  profit_factor numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.punter_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Punter rankings are publicly readable"
  ON public.punter_rankings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own punter ranking"
  ON public.punter_rankings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own punter ranking"
  ON public.punter_rankings FOR UPDATE
  USING (auth.uid() = user_id);
