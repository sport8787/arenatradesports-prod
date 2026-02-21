
-- Table for session replay: stores trade snapshots
CREATE TABLE public.trader_session_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  trade_type TEXT NOT NULL, -- 'long' or 'short'
  asset_symbol TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC,
  amount INTEGER NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  pnl INTEGER,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  candles_snapshot JSONB,
  mycroft_analysis JSONB,
  horus_message TEXT,
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'open'
);

ALTER TABLE public.trader_session_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own snapshots"
  ON public.trader_session_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Table for social feed: public trades
CREATE TABLE public.trader_social_feed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  username TEXT NOT NULL DEFAULT 'Trader',
  trade_type TEXT NOT NULL,
  asset_symbol TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  amount INTEGER NOT NULL,
  leverage INTEGER NOT NULL DEFAULT 1,
  pnl INTEGER NOT NULL,
  pnl_percent NUMERIC NOT NULL DEFAULT 0,
  comment TEXT,
  likes_count INTEGER NOT NULL DEFAULT 0,
  copies_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trader_social_feed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Social feed is publicly readable"
  ON public.trader_social_feed FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own trades"
  ON public.trader_social_feed FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trades"
  ON public.trader_social_feed FOR UPDATE
  USING (auth.uid() = user_id);

-- Enable realtime for social feed
ALTER PUBLICATION supabase_realtime ADD TABLE public.trader_social_feed;
