
-- Tabelas para detecção de Steam/Sharp money via Futodds Exchange
CREATE TABLE IF NOT EXISTS public.punter_steam_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  futodds_event_id text NOT NULL,
  market text NOT NULL,
  side text,
  back_odd numeric,
  lay_odd numeric,
  mid_odd numeric,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS punter_steam_snapshots_event_market_idx
  ON public.punter_steam_snapshots(futodds_event_id, market, captured_at DESC);
ALTER TABLE public.punter_steam_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "steam_snapshots read public" ON public.punter_steam_snapshots FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.punter_steam_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id text NOT NULL,
  futodds_event_id text,
  market text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in_favor','against','neutral')),
  drift_pct numeric NOT NULL,
  window_minutes integer NOT NULL,
  open_mid_odd numeric,
  close_mid_odd numeric,
  detected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, market, detected_at)
);
CREATE INDEX IF NOT EXISTS punter_steam_signals_match_market_idx
  ON public.punter_steam_signals(match_id, market, detected_at DESC);
ALTER TABLE public.punter_steam_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "steam_signals read public" ON public.punter_steam_signals FOR SELECT USING (true);
