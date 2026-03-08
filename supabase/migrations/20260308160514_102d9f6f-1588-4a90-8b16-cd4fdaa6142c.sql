
CREATE TABLE public.daily_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  horus jsonb NOT NULL DEFAULT '{}'::jsonb,
  manual jsonb NOT NULL DEFAULT '{}'::jsonb,
  best_bet jsonb,
  best_market jsonb,
  total_profit numeric DEFAULT 0,
  total_bets integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_daily_summaries_user ON public.daily_summaries(user_id);
CREATE INDEX idx_daily_summaries_date ON public.daily_summaries(date DESC);

ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily summaries"
  ON public.daily_summaries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily summaries"
  ON public.daily_summaries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily summaries"
  ON public.daily_summaries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);
