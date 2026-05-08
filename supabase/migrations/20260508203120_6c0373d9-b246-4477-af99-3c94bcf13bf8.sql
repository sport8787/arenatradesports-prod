
CREATE TABLE IF NOT EXISTS public.punter_clv_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id TEXT NOT NULL,
  market TEXT NOT NULL,
  futodds_event_id TEXT,
  home_team TEXT,
  away_team TEXT,
  commence_time TIMESTAMPTZ,
  bookmaker_odd NUMERIC,        -- odd que a IA usou (bookmaker)
  bookmaker_edge_pp NUMERIC,    -- value_percentage original
  open_back_odd NUMERIC,        -- Exchange Back no momento do sinal
  open_lay_odd NUMERIC,
  open_mid_odd NUMERIC,
  open_fair_prob NUMERIC,       -- 1/mid (sem margem)
  open_edge_pp NUMERIC,         -- (estimated_prob/100)*mid - 1, em pp
  close_back_odd NUMERIC,
  close_lay_odd NUMERIC,
  close_mid_odd NUMERIC,
  clv_pp NUMERIC,               -- (open_mid/close_mid - 1) * 100
  estimated_probability NUMERIC,
  demoted_by_exchange BOOLEAN DEFAULT FALSE,
  exchange_source TEXT DEFAULT 'futodds',
  open_captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  close_captured_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS punter_clv_log_match_market_uq
  ON public.punter_clv_log(match_id, market);

CREATE INDEX IF NOT EXISTS punter_clv_log_event_idx
  ON public.punter_clv_log(futodds_event_id);

CREATE INDEX IF NOT EXISTS punter_clv_log_commence_idx
  ON public.punter_clv_log(commence_time);

ALTER TABLE public.punter_clv_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "punter_clv_log read public"
  ON public.punter_clv_log FOR SELECT
  USING (true);
