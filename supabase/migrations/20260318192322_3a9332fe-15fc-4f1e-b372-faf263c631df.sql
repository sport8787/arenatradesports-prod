
CREATE TABLE public.arena_trader_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL,
  fixture_label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  minute_entered INTEGER NOT NULL,
  plano TEXT NOT NULL,
  market TEXT NOT NULL,
  odd DECIMAL(6,2) NOT NULL,
  stake_value DECIMAL(10,2) NOT NULL,
  stake_pct DECIMAL(4,1) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  pnl DECIMAL(10,2),
  notes TEXT
);

CREATE INDEX idx_arena_entries_fixture ON public.arena_trader_entries(fixture_id, user_id);
CREATE INDEX idx_arena_entries_user ON public.arena_trader_entries(user_id, created_at DESC);

ALTER TABLE public.arena_trader_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own entries"
  ON public.arena_trader_entries FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
