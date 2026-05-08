
ALTER TABLE public.arena_trader_entries
  ADD COLUMN IF NOT EXISTS odd_source TEXT NOT NULL DEFAULT 'estimada';

CREATE TABLE IF NOT EXISTS public.cashout_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL REFERENCES public.virtual_bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  match_id TEXT,
  market TEXT,
  entry_odd NUMERIC,
  current_odd NUMERIC NOT NULL,
  cashout_value NUMERIC,
  fonte TEXT NOT NULL,
  confianca INTEGER,
  saude TEXT,
  signal BOOLEAN DEFAULT false,
  motivo TEXT,
  fatores JSONB,
  minute INTEGER,
  score TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cashout_history_bet ON public.cashout_history(bet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cashout_history_user ON public.cashout_history(user_id, created_at DESC);

ALTER TABLE public.cashout_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own cashout history" ON public.cashout_history;
CREATE POLICY "Users read own cashout history"
  ON public.cashout_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role inserts cashout history" ON public.cashout_history;
CREATE POLICY "Service role inserts cashout history"
  ON public.cashout_history FOR INSERT
  WITH CHECK (true);
