-- 1. punter_gate_config: novos campos Copa
ALTER TABLE public.punter_gate_config
  ADD COLUMN IF NOT EXISTS modo_copa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS copa_start_date date,
  ADD COLUMN IF NOT EXISTS copa_end_date date DEFAULT '2026-07-19',
  ADD COLUMN IF NOT EXISTS copa_config jsonb DEFAULT jsonb_build_object(
    've_min', jsonb_build_object('grupos', 7, 'oitavas', 5, 'quartas_plus', 4),
    'conf_min', jsonb_build_object('grupos', 70, 'mata_mata', 65),
    'stake_blocks', jsonb_build_object(
      'A', jsonb_build_object('grupos', 1.5, 'mata_mata', 2),
      'B', jsonb_build_object('grupos', 2, 'mata_mata', 3),
      'C', jsonb_build_object('grupos', 3, 'mata_mata', 4)
    ),
    'max_exposicao_rodada', 8,
    'ah_odd_range', jsonb_build_object('min', 1.65, 'max', 2.30),
    'xg_fav_min', 1.5,
    'xga_adv_min', 1.2,
    'poss_diff_min', 10
  );

-- 2. copa_fixtures: cache diário
CREATE TABLE IF NOT EXISTS public.copa_fixtures (
  fixture_id text PRIMARY KEY,
  home text NOT NULL,
  away text NOT NULL,
  commence_time timestamptz NOT NULL,
  phase text NOT NULL,
  group_letter text,
  home_fifa_rank int,
  away_fifa_rank int,
  home_fifa_pts int,
  away_fifa_pts int,
  home_already_qualified boolean DEFAULT false,
  away_already_qualified boolean DEFAULT false,
  home_eliminated boolean DEFAULT false,
  away_eliminated boolean DEFAULT false,
  injuries jsonb DEFAULT '{}'::jsonb,
  xg_last5 jsonb DEFAULT '{}'::jsonb,
  xg_copa jsonb DEFAULT '{}'::jsonb,
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.copa_fixtures TO authenticated;
GRANT ALL ON public.copa_fixtures TO service_role;
ALTER TABLE public.copa_fixtures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copa_fixtures_read_all_auth"
  ON public.copa_fixtures FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "copa_fixtures_service_all"
  ON public.copa_fixtures FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_copa_fixtures_commence ON public.copa_fixtures (commence_time);
CREATE INDEX IF NOT EXISTS idx_copa_fixtures_phase ON public.copa_fixtures (phase);

-- 3. punter_copa_signals: histórico isolado
CREATE TABLE IF NOT EXISTS public.punter_copa_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  fixture_id text NOT NULL REFERENCES public.copa_fixtures(fixture_id) ON DELETE CASCADE,
  home text NOT NULL,
  away text NOT NULL,
  commence_time timestamptz NOT NULL,
  phase text NOT NULL,
  market text NOT NULL,
  selection text NOT NULL,
  ah_line numeric,
  odd numeric NOT NULL,
  prob numeric NOT NULL,
  ve_pct numeric NOT NULL,
  edge_pct numeric,
  confidence numeric NOT NULL,
  block char(1) NOT NULL,
  stake_pct numeric NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  resultado text,
  rationale text,
  copa_badge boolean NOT NULL DEFAULT true,
  vetos jsonb DEFAULT '[]'::jsonb,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(fixture_id, market, selection)
);
GRANT SELECT ON public.punter_copa_signals TO authenticated;
GRANT ALL ON public.punter_copa_signals TO service_role;
ALTER TABLE public.punter_copa_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "copa_signals_read_authenticated"
  ON public.punter_copa_signals FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "copa_signals_service_all"
  ON public.punter_copa_signals FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_copa_signals_commence ON public.punter_copa_signals (commence_time DESC);
CREATE INDEX IF NOT EXISTS idx_copa_signals_status ON public.punter_copa_signals (status);

-- 4. updated_at trigger reaproveitando função existente
DROP TRIGGER IF EXISTS trg_copa_fixtures_updated_at ON public.copa_fixtures;
CREATE TRIGGER trg_copa_fixtures_updated_at
  BEFORE UPDATE ON public.copa_fixtures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_copa_signals_updated_at ON public.punter_copa_signals;
CREATE TRIGGER trg_copa_signals_updated_at
  BEFORE UPDATE ON public.punter_copa_signals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();