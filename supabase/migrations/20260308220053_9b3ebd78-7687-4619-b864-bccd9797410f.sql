
-- Table to store user bookmaker connections (Betfair credentials etc)
CREATE TABLE public.bookmaker_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  bookmaker TEXT NOT NULL DEFAULT 'betfair',
  app_key TEXT,
  username TEXT,
  encrypted_password TEXT,
  session_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, bookmaker)
);

ALTER TABLE public.bookmaker_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own connections"
  ON public.bookmaker_connections FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table to store imported bets (from CSV/PDF/API sync)
CREATE TABLE public.imported_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'csv',
  bookmaker TEXT,
  event_name TEXT,
  market TEXT NOT NULL,
  selection TEXT,
  odd NUMERIC NOT NULL,
  stake NUMERIC NOT NULL DEFAULT 0,
  profit_loss NUMERIC DEFAULT 0,
  result TEXT DEFAULT 'pending',
  bet_date TIMESTAMPTZ,
  settle_date TIMESTAMPTZ,
  raw_data JSONB,
  import_batch_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.imported_bets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own imported bets"
  ON public.imported_bets FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_imported_bets_user_source ON public.imported_bets(user_id, source);
CREATE INDEX idx_imported_bets_batch ON public.imported_bets(import_batch_id);
