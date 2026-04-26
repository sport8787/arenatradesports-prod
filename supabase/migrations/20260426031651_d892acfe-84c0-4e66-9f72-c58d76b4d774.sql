-- =============================================================================
-- PLANO EVENTOS RAROS
-- Tabelas para candidatos (pre-live) e sinais (live) de placares raros
-- usando estratégia LAY: GOLEADA, 2x2, 1x3, 3x1
-- =============================================================================

-- Candidatos identificados no pré-live (rodando 2x ao dia)
CREATE TABLE IF NOT EXISTS public.eventos_raros_candidatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação do jogo
  match_id TEXT NOT NULL UNIQUE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league_id INT NOT NULL,
  league_name TEXT,
  match_date TIMESTAMPTZ NOT NULL,
  season INT,

  -- Placares alvo (estratégia LAY)
  placar_alvo TEXT CHECK (placar_alvo IN ('LAY_GOLEADA','LAY_2x2','LAY_1x3','LAY_3x1')),
  placar_alternativo TEXT CHECK (placar_alternativo IN ('LAY_GOLEADA','LAY_2x2','LAY_1x3','LAY_3x1')),

  -- Score de qualidade (0-100)
  score_qualidade NUMERIC DEFAULT 0,

  -- Indicadores estatísticos calculados
  freq_goleada_home NUMERIC DEFAULT 0,
  freq_goleada_away NUMERIC DEFAULT 0,
  freq_goleada_h2h NUMERIC DEFAULT 0,
  freq_2x2_h2h NUMERIC DEFAULT 0,
  freq_1x3_h2h NUMERIC DEFAULT 0,
  forca_ofensiva_home NUMERIC DEFAULT 0,
  forca_ofensiva_away NUMERIC DEFAULT 0,
  fragilidade_def_home NUMERIC DEFAULT 0,
  fragilidade_def_away NUMERIC DEFAULT 0,
  media_gols_h2h NUMERIC DEFAULT 0,
  clean_sheet_rate_home NUMERIC DEFAULT 0,
  clean_sheet_rate_away NUMERIC DEFAULT 0,
  desequilibrio_forcas NUMERIC DEFAULT 0,

  -- Status / arena alvo
  status TEXT DEFAULT 'CANDIDATO' CHECK (status IN ('CANDIDATO','APROVADO','DESCARTADO','ENCERRADO')),
  motivo_descarte TEXT,
  arenas TEXT[] DEFAULT ARRAY['punter','trader_sports'],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_candidatos_match ON public.eventos_raros_candidatos(match_id);
CREATE INDEX IF NOT EXISTS idx_eventos_candidatos_date ON public.eventos_raros_candidatos(match_date);
CREATE INDEX IF NOT EXISTS idx_eventos_candidatos_status ON public.eventos_raros_candidatos(status);

-- Sinais ativos durante o live
CREATE TABLE IF NOT EXISTS public.eventos_raros_sinais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  candidato_id UUID REFERENCES public.eventos_raros_candidatos(id) ON DELETE CASCADE,
  match_id TEXT NOT NULL,

  -- Dados da entrada
  placar_alvo TEXT NOT NULL,
  odd_entrada NUMERIC,
  minuto_entrada INT,
  placar_no_momento TEXT,
  modo_betfair TEXT DEFAULT 'simulado' CHECK (modo_betfair IN ('simulado','live')),

  -- Dados de saída
  status TEXT DEFAULT 'ATIVO' CHECK (status IN (
    'ATIVO','SAIDA_NORMAL','SAIDA_EMERGENCIA','ENCERRADO'
  )),
  motivo_saida TEXT,
  minuto_saida INT,
  placar_saida TEXT,
  odd_saida NUMERIC,

  -- Resultado
  resultado TEXT CHECK (resultado IN ('GREEN','RED','PENDENTE','VOID')),
  profit_loss NUMERIC,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_sinais_match ON public.eventos_raros_sinais(match_id);
CREATE INDEX IF NOT EXISTS idx_eventos_sinais_status ON public.eventos_raros_sinais(status);
CREATE INDEX IF NOT EXISTS idx_eventos_sinais_candidato ON public.eventos_raros_sinais(candidato_id);

-- Trigger updated_at
CREATE TRIGGER trg_eventos_candidatos_updated
BEFORE UPDATE ON public.eventos_raros_candidatos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_eventos_sinais_updated
BEFORE UPDATE ON public.eventos_raros_sinais
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: leitura pública (sinais globais como Mycroft), escrita só via service role
ALTER TABLE public.eventos_raros_candidatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eventos_raros_sinais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eventos raros candidatos publicly readable"
ON public.eventos_raros_candidatos FOR SELECT
USING (true);

CREATE POLICY "Eventos raros sinais publicly readable"
ON public.eventos_raros_sinais FOR SELECT
USING (true);
