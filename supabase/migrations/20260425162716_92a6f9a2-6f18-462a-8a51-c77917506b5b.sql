-- Tabela de configuração calibrável do Mycroft Punter
CREATE TABLE IF NOT EXISTS public.punter_calibration (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Filtros globais
  min_probability NUMERIC NOT NULL DEFAULT 30,
  min_edge NUMERIC NOT NULL DEFAULT 4,
  min_confidence NUMERIC NOT NULL DEFAULT 65,
  target_roi NUMERIC NOT NULL DEFAULT 20,
  target_win_rate NUMERIC NOT NULL DEFAULT 60,
  tolerance_pp NUMERIC NOT NULL DEFAULT 2,
  odd_min NUMERIC NOT NULL DEFAULT 1.35,
  odd_max NUMERIC NOT NULL DEFAULT 4.50,
  -- Tiers
  tier1_min_edge NUMERIC NOT NULL DEFAULT 7,
  tier1_min_conf NUMERIC NOT NULL DEFAULT 78,
  tier1_min_prob NUMERIC NOT NULL DEFAULT 50,
  tier1_max_stake NUMERIC NOT NULL DEFAULT 5,
  tier2_min_edge NUMERIC NOT NULL DEFAULT 5,
  tier2_min_conf NUMERIC NOT NULL DEFAULT 70,
  tier2_min_prob NUMERIC NOT NULL DEFAULT 40,
  tier2_max_stake NUMERIC NOT NULL DEFAULT 3.5,
  tier3_min_edge NUMERIC NOT NULL DEFAULT 4,
  tier3_min_conf NUMERIC NOT NULL DEFAULT 65,
  tier3_min_prob NUMERIC NOT NULL DEFAULT 32,
  tier3_max_stake NUMERIC NOT NULL DEFAULT 2.5,
  -- Meta
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apenas uma linha ativa
CREATE UNIQUE INDEX IF NOT EXISTS punter_calibration_active_idx
  ON public.punter_calibration (is_active) WHERE is_active = true;

ALTER TABLE public.punter_calibration ENABLE ROW LEVEL SECURITY;

-- Apenas admin (email pabloescobar@gmail.com) pode modificar; leitura pública (a edge function lê via service role)
CREATE POLICY "Anyone can read punter calibration"
  ON public.punter_calibration FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert punter calibration"
  ON public.punter_calibration FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND lower(auth.users.email) = 'pabloescobar@gmail.com'
    )
  );

CREATE POLICY "Admin can update punter calibration"
  ON public.punter_calibration FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
        AND lower(auth.users.email) = 'pabloescobar@gmail.com'
    )
  );

CREATE OR REPLACE FUNCTION public.touch_punter_calibration()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_touch_punter_calibration ON public.punter_calibration;
CREATE TRIGGER trg_touch_punter_calibration
  BEFORE UPDATE ON public.punter_calibration
  FOR EACH ROW EXECUTE FUNCTION public.touch_punter_calibration();

-- Seed da configuração atual (se não existir nenhuma ativa)
INSERT INTO public.punter_calibration (is_active, notes)
SELECT true, 'Configuração inicial (valores hardcoded migrados)'
WHERE NOT EXISTS (SELECT 1 FROM public.punter_calibration WHERE is_active = true);