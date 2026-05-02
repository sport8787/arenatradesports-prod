CREATE TABLE IF NOT EXISTS public.ah_odds_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id TEXT NOT NULL,
  home_odd NUMERIC,
  away_odd NUMERIC,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ah_odds_snapshot_fixture ON public.ah_odds_snapshot(fixture_id, captured_at);

ALTER TABLE public.ah_odds_snapshot ENABLE ROW LEVEL SECURITY;

-- Apenas leitura para usuários autenticados; escrita só via service role (edge function)
DROP POLICY IF EXISTS "ah_odds_snapshot_select_auth" ON public.ah_odds_snapshot;
CREATE POLICY "ah_odds_snapshot_select_auth" ON public.ah_odds_snapshot
  FOR SELECT TO authenticated USING (true);