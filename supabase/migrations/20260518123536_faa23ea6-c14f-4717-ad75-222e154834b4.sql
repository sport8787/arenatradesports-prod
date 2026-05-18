-- Tabela de configuração dinâmica do gate de aprovação Punter (3 blocos + vetos)
-- Permite ajustar thresholds sem redeploy de edge functions
CREATE TABLE IF NOT EXISTS public.punter_gate_config (
  id TEXT PRIMARY KEY DEFAULT 'global',

  -- Vetos / limites globais
  prob_min_global NUMERIC NOT NULL DEFAULT 45,
  odd_min_global NUMERIC NOT NULL DEFAULT 1.30,
  odd_max_global NUMERIC NOT NULL DEFAULT 4.50,

  -- Veto favorito barato sem stats ALTA
  favorite_odd_threshold NUMERIC NOT NULL DEFAULT 1.50,
  favorite_requires_data_strength TEXT NOT NULL DEFAULT 'ALTA',

  -- Veto trap line (queda da odd em 2h)
  odd_drop_pct_threshold NUMERIC NOT NULL DEFAULT 8,

  -- Veto liga fraca + odd baixa
  weak_league_odd_threshold NUMERIC NOT NULL DEFAULT 1.60,
  strong_league_regex TEXT NOT NULL DEFAULT '(premier league|la liga|primera divis|serie a|bundesliga|ligue 1|champions|europa|conference|libertadores|sudamericana|brasileir|copa do brasil|eredivisie|primeira liga|jupiler|championship|copa america|world cup|euro)',

  -- Anti-overfit IA
  conf_inflation_threshold NUMERIC NOT NULL DEFAULT 85,
  edge_inflation_threshold NUMERIC NOT NULL DEFAULT 5,

  -- BLOCO A — Segurança
  a_prob_min NUMERIC NOT NULL DEFAULT 58,
  a_edge_min NUMERIC NOT NULL DEFAULT 3,
  a_conf_min NUMERIC NOT NULL DEFAULT 72,
  a_odd_min NUMERIC NOT NULL DEFAULT 1.30,
  a_odd_max NUMERIC NOT NULL DEFAULT 1.85,
  a_stake_pct NUMERIC NOT NULL DEFAULT 2,

  -- BLOCO B — Valor
  b_prob_min NUMERIC NOT NULL DEFAULT 45,
  b_edge_min NUMERIC NOT NULL DEFAULT 5,
  b_conf_min NUMERIC NOT NULL DEFAULT 70,
  b_odd_min NUMERIC NOT NULL DEFAULT 1.85,
  b_odd_max NUMERIC NOT NULL DEFAULT 3.20,
  b_stake_pct NUMERIC NOT NULL DEFAULT 3,

  -- BLOCO C — Elite
  c_prob_min NUMERIC NOT NULL DEFAULT 55,
  c_edge_min NUMERIC NOT NULL DEFAULT 7,
  c_conf_min NUMERIC NOT NULL DEFAULT 80,
  c_odd_min NUMERIC NOT NULL DEFAULT 1.50,
  c_odd_max NUMERIC NOT NULL DEFAULT 4.50,
  c_stake_pct NUMERIC NOT NULL DEFAULT 4,
  c_requires_pinnacle BOOLEAN NOT NULL DEFAULT true,

  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Seed da linha global (idempotente)
INSERT INTO public.punter_gate_config (id) VALUES ('global')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.punter_gate_config ENABLE ROW LEVEL SECURITY;

-- Leitura: qualquer autenticado (edges usam service-role, sem restrição)
CREATE POLICY "gate_config_select_authenticated"
ON public.punter_gate_config FOR SELECT
TO authenticated
USING (true);

-- Escrita: somente admins
CREATE POLICY "gate_config_admin_insert"
ON public.punter_gate_config FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gate_config_admin_update"
ON public.punter_gate_config FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "gate_config_admin_delete"
ON public.punter_gate_config FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_punter_gate_config()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_punter_gate_config ON public.punter_gate_config;
CREATE TRIGGER trg_touch_punter_gate_config
BEFORE UPDATE ON public.punter_gate_config
FOR EACH ROW
EXECUTE FUNCTION public.touch_punter_gate_config();