
-- ─── Enum de modo ────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.mycroft_modo AS ENUM ('trader','punter');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── mycroft_config ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mycroft_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modo public.mycroft_modo NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  UNIQUE (modo, key)
);

ALTER TABLE public.mycroft_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read mycroft_config"
  ON public.mycroft_config FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins write mycroft_config"
  ON public.mycroft_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_mycroft_config_updated_at
  BEFORE UPDATE ON public.mycroft_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── mycroft_rules ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mycroft_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modo public.mycroft_modo NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('pontuacao','veto')),
  field TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('>','>=','<','<=','==','!=')),
  value NUMERIC NOT NULL,
  points NUMERIC,
  priority INT NOT NULL DEFAULT 0,
  mercado TEXT,
  time_start INT,
  time_end INT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_mycroft_rules_modo_active
  ON public.mycroft_rules (modo, active, priority DESC);

ALTER TABLE public.mycroft_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read mycroft_rules"
  ON public.mycroft_rules FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins write mycroft_rules"
  ON public.mycroft_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_mycroft_rules_updated_at
  BEFORE UPDATE ON public.mycroft_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── analises_comparativas (shadow mode) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.analises_comparativas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modo public.mycroft_modo NOT NULL,
  source_function TEXT NOT NULL,        -- analyze-live-matches | mycroft-punter-anthropic | handicap-asiatico-prelive
  match_id TEXT,
  fixture_id TEXT,
  mercado TEXT,
  league TEXT,
  home_team TEXT,
  away_team TEXT,
  -- atual
  verdicto_atual TEXT,
  score_atual NUMERIC,
  stake_atual NUMERIC,
  odd_atual NUMERIC,
  -- novo (motor de regras)
  verdicto_novo TEXT,
  score_novo NUMERIC,
  stake_novo NUMERIC,
  odd_novo NUMERIC,
  explicacao_novo JSONB,
  logs_novo JSONB,
  stats_snapshot JSONB,
  -- resultado
  resultado_real TEXT,                  -- GREEN | RED | PUSH | PENDENTE
  settled_at TIMESTAMPTZ,
  data_jogo TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analises_comp_match     ON public.analises_comparativas(match_id);
CREATE INDEX IF NOT EXISTS idx_analises_comp_mercado   ON public.analises_comparativas(mercado);
CREATE INDEX IF NOT EXISTS idx_analises_comp_resultado ON public.analises_comparativas(resultado_real);
CREATE INDEX IF NOT EXISTS idx_analises_comp_modo      ON public.analises_comparativas(modo, created_at DESC);

ALTER TABLE public.analises_comparativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read analises_comparativas"
  ON public.analises_comparativas FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Service can insert analises_comparativas"
  ON public.analises_comparativas FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins update analises_comparativas"
  ON public.analises_comparativas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_analises_comparativas_updated_at
  BEFORE UPDATE ON public.analises_comparativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Trigger: propaga resultado real do Mycroft live ────────────
CREATE OR REPLACE FUNCTION public.propagate_mycroft_result_to_shadow()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resultado TEXT;
BEGIN
  IF NEW.result IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.result IS NOT DISTINCT FROM NEW.result THEN
    RETURN NEW;
  END IF;

  v_resultado := CASE
    WHEN NEW.result IN ('green','won','win') THEN 'GREEN'
    WHEN NEW.result IN ('red','lost','loss') THEN 'RED'
    WHEN NEW.result = 'push' THEN 'PUSH'
    ELSE NULL
  END;

  IF v_resultado IS NULL THEN RETURN NEW; END IF;

  UPDATE public.analises_comparativas
  SET resultado_real = v_resultado,
      settled_at = COALESCE(NEW.settled_at, now()),
      updated_at = now()
  WHERE match_id = NEW.match_id
    AND lower(coalesce(mercado,'')) = lower(coalesce(NEW.market,''))
    AND resultado_real IS NULL;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'propagate_mycroft_result_to_shadow erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mycroft_result_to_shadow ON public.mycroft_analyses;
CREATE TRIGGER trg_mycroft_result_to_shadow
  AFTER UPDATE OF result ON public.mycroft_analyses
  FOR EACH ROW EXECUTE FUNCTION public.propagate_mycroft_result_to_shadow();

-- ─── Defaults de configuração ────────────────────────────────────
INSERT INTO public.mycroft_config (modo, key, value, description) VALUES
  ('trader','score_minimo_aprovar','70','Score mínimo para APROVADO (live)'),
  ('trader','score_minimo_cuidado','50','Score mínimo para CUIDADO/SITUACIONAL'),
  ('trader','stake_min_percent','2','Stake mínimo (% banca)'),
  ('trader','stake_max_percent','5','Stake máximo (% banca)'),
  ('trader','odd_minima','1.5','Odd mínima aceita'),
  ('trader','odd_maxima','3.0','Odd máxima aceita'),
  ('trader','tempo_minimo_analise','10','Minuto mínimo para iniciar análise live'),
  ('punter','score_minimo_aprovar','65','Score mínimo Punter pré-live'),
  ('punter','score_minimo_cuidado','50','Score mínimo CUIDADO Punter'),
  ('punter','stake_min_percent','2','Stake mínimo Punter (% banca)'),
  ('punter','stake_max_percent','5','Stake máximo Punter (% banca)'),
  ('punter','odd_minima','1.5','Odd mínima Punter'),
  ('punter','odd_maxima','3.5','Odd máxima Punter'),
  ('punter','tempo_minimo_analise','0','N/A para pré-live')
ON CONFLICT (modo, key) DO NOTHING;
