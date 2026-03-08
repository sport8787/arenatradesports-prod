
-- Table to cache daily odds/games from The Odds API
CREATE TABLE public.cached_odds_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  commence_time TIMESTAMPTZ NOT NULL,
  bookmakers JSONB NOT NULL DEFAULT '[]'::jsonb,
  simulated_odds BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  UNIQUE(event_id)
);

-- Index for fast lookups
CREATE INDEX idx_cached_odds_games_expires ON public.cached_odds_games(expires_at);
CREATE INDEX idx_cached_odds_games_commence ON public.cached_odds_games(commence_time);

-- RLS: public read (all users see same cache), only service role writes
ALTER TABLE public.cached_odds_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cached odds"
  ON public.cached_odds_games
  FOR SELECT
  TO authenticated
  USING (true);

-- Table to track analysis cost per user (NT spending on analyze)
-- We'll use existing spend_nt_balance function for this

-- Add realtime for instant updates when cache refreshes
ALTER PUBLICATION supabase_realtime ADD TABLE public.cached_odds_games;
