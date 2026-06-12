-- ─────────────────────────────────────────────────────────────────────
-- Copa do Mundo 2026 — Tabelas de entradas por arena
--
-- copa_punter_entradas : entradas pré-live geradas pelo Mycroft Punter
-- copa_live_entradas   : entradas in-play geradas pelo Arena Live
--
-- Separadas porque cada arena tem critérios, stakes e mercados distintos.
-- Permitem apurar G/R + ROI especificamente para jogos da Copa.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- 0. Adiciona colunas de liquidação em punter_copa_signals
--    (necessário para o trigger de sync funcionar)
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.punter_copa_signals
  ADD COLUMN IF NOT EXISTS goals_home  INTEGER,
  ADD COLUMN IF NOT EXISTS goals_away  INTEGER,
  ADD COLUMN IF NOT EXISTS profit_loss NUMERIC,
  ADD COLUMN IF NOT EXISTS settled_at  TIMESTAMPTZ;


-- ─────────────────────────────────────────────────────────────────────
-- 1. ARENA PUNTER — copa_punter_entradas
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.copa_punter_entradas (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Referência ao sinal original (nullable para entradas manuais futuras)
  signal_id       UUID,

  -- Identificação do jogo
  fixture_id      TEXT        NOT NULL,
  home            TEXT        NOT NULL,
  away            TEXT        NOT NULL,
  phase           TEXT,                    -- grupos_j1, oitavas, quartas, semi, final
  commence_time   TIMESTAMPTZ NOT NULL,

  -- Detalhes da entrada
  market          TEXT        NOT NULL,    -- ex: "Handicap Asiático"
  selection       TEXT        NOT NULL,    -- ex: "Mexico -1"
  ah_line         NUMERIC,                 -- linha numérica: -1.0, +0.5
  odd             NUMERIC     NOT NULL,
  stake_pct       NUMERIC     NOT NULL,    -- % do bankroll apostado
  block           TEXT,                    -- 'A', 'B', 'C'
  confidence      INTEGER,                 -- 0–100
  ve_pct          NUMERIC,
  edge_pct        NUMERIC,
  prob            NUMERIC,                 -- probabilidade implícita (0–1)
  rationale       TEXT,                    -- justificativa Mycroft

  -- Resultado (preenchido na liquidação)
  resultado       TEXT        CHECK (resultado IN ('GREEN', 'RED', 'VOID', 'HALF_GREEN', 'HALF_RED')),
  goals_home      INTEGER,
  goals_away      INTEGER,
  profit_loss     NUMERIC,                 -- ex: +1.87u (GREEN) ou -1.5u (RED)
  settled_at      TIMESTAMPTZ,

  -- Metadados
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  -- Uma entrada por fixture + seleção (evita duplicatas de re-análise)
  CONSTRAINT copa_punter_entradas_uq UNIQUE (fixture_id, selection)
);

-- Índices operacionais
CREATE INDEX IF NOT EXISTS cpe_fixture_idx   ON public.copa_punter_entradas (fixture_id);
CREATE INDEX IF NOT EXISTS cpe_resultado_idx ON public.copa_punter_entradas (resultado);
CREATE INDEX IF NOT EXISTS cpe_phase_idx     ON public.copa_punter_entradas (phase);
CREATE INDEX IF NOT EXISTS cpe_commence_idx  ON public.copa_punter_entradas (commence_time);


-- ─────────────────────────────────────────────────────────────────────
-- 2. ARENA LIVE — copa_live_entradas
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.copa_live_entradas (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Referência à análise original
  analysis_id      UUID,                   -- live_sinais.id ou mycroft_analyses.id

  -- Identificação do jogo
  match_id         TEXT        NOT NULL,   -- API-Football fixture_id (= copa_fixtures.fixture_id)
  fixture_id       TEXT,                   -- ref copa_fixtures (redundante mas útil para JOINs)
  home             TEXT,
  away             TEXT,
  phase            TEXT,
  commence_time    TIMESTAMPTZ,

  -- Detalhes da entrada
  market           TEXT        NOT NULL,   -- ex: "Under 4.5", "Asian Handicap"
  market_key       TEXT,                   -- normalizado: UNDER_4.5_FT, AH_HOME, etc.
  selection        TEXT,                   -- ex: "Under 4.5"
  odd              NUMERIC     NOT NULL,
  stake            NUMERIC     NOT NULL DEFAULT 5.0,  -- unidades fixas para live
  verdict          TEXT,                   -- 'APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'
  confidence       INTEGER,

  -- Contexto in-play no momento da aprovação
  approved_at_minute INTEGER,
  approved_at_score  TEXT,                 -- placar no momento: "1-0"
  approved_at_period TEXT,                 -- '1H', '2H', 'ET'
  source           TEXT        DEFAULT 'mycroft', -- 'mycroft', 'shadow_ai', 'sinais_alavanca'

  -- Resultado
  result           TEXT        CHECK (result IN ('GREEN', 'RED', 'VOID', 'HALF_GREEN', 'HALF_RED')),
  goals_home       INTEGER,
  goals_away       INTEGER,
  profit_loss      NUMERIC,
  settled_at       TIMESTAMPTZ,

  -- Metadados
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),

  -- Uma entrada por partida + mercado (market_key pode ser null → usa market)
  CONSTRAINT copa_live_entradas_uq UNIQUE (match_id, market)
);

-- Índices operacionais
CREATE INDEX IF NOT EXISTS cle_match_idx    ON public.copa_live_entradas (match_id);
CREATE INDEX IF NOT EXISTS cle_fixture_idx  ON public.copa_live_entradas (fixture_id);
CREATE INDEX IF NOT EXISTS cle_result_idx   ON public.copa_live_entradas (result);
CREATE INDEX IF NOT EXISTS cle_phase_idx    ON public.copa_live_entradas (phase);
CREATE INDEX IF NOT EXISTS cle_commence_idx ON public.copa_live_entradas (commence_time);


-- ─────────────────────────────────────────────────────────────────────
-- 3. RLS (row-level security)
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.copa_punter_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.copa_live_entradas   ENABLE ROW LEVEL SECURITY;

-- Leitura livre para usuários autenticados
CREATE POLICY "copa_punter_entradas_read"
  ON public.copa_punter_entradas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "copa_live_entradas_read"
  ON public.copa_live_entradas FOR SELECT
  TO authenticated USING (true);

-- Escrita exclusiva para service_role (edge functions)
CREATE POLICY "copa_punter_entradas_write"
  ON public.copa_punter_entradas FOR ALL
  TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "copa_live_entradas_write"
  ON public.copa_live_entradas FOR ALL
  TO service_role USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────────────
-- 4. Trigger: updated_at automático
-- ─────────────────────────────────────────────────────────────────────

-- Função genérica set_updated_at (pode já existir — recria sem erro)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS copa_punter_entradas_updated_at ON public.copa_punter_entradas;
CREATE TRIGGER copa_punter_entradas_updated_at
  BEFORE UPDATE ON public.copa_punter_entradas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS copa_live_entradas_updated_at ON public.copa_live_entradas;
CREATE TRIGGER copa_live_entradas_updated_at
  BEFORE UPDATE ON public.copa_live_entradas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────
-- 5. Trigger: resultado de punter_copa_signals → copa_punter_entradas
--    Quando o sinal Punter for liquidado (resultado preenchido),
--    sincroniza automaticamente para a tabela de entradas.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_copa_punter_resultado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Só age quando resultado muda de NULL para um valor
  IF NEW.resultado IS NOT NULL
     AND (OLD.resultado IS NULL OR OLD.resultado IS DISTINCT FROM NEW.resultado)
  THEN
    UPDATE public.copa_punter_entradas
    SET
      resultado   = NEW.resultado,
      goals_home  = COALESCE(NEW.goals_home,  copa_punter_entradas.goals_home),
      goals_away  = COALESCE(NEW.goals_away,  copa_punter_entradas.goals_away),
      profit_loss = NEW.profit_loss,
      settled_at  = COALESCE(NEW.settled_at, now()),
      updated_at  = now()
    WHERE fixture_id = NEW.fixture_id
      AND selection  = NEW.selection;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_copa_punter_resultado_trigger ON public.punter_copa_signals;
CREATE TRIGGER sync_copa_punter_resultado_trigger
  AFTER UPDATE ON public.punter_copa_signals
  FOR EACH ROW EXECUTE FUNCTION public.sync_copa_punter_resultado();


-- ─────────────────────────────────────────────────────────────────────
-- 6. Trigger: live_sinais → copa_live_entradas
--    Quando um sinal ao vivo for criado/atualizado para uma partida
--    que está em copa_fixtures, replica automaticamente.
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_copa_live_entradas()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  copa_fx record;
BEGIN
  -- Verifica se match_id corresponde a uma fixture da Copa
  SELECT fixture_id, home, away, phase, commence_time
  INTO   copa_fx
  FROM   public.copa_fixtures
  WHERE  fixture_id = NEW.match_id
  LIMIT  1;

  -- Se não for jogo da Copa, sai sem fazer nada
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Upsert na copa_live_entradas
  INSERT INTO public.copa_live_entradas (
    analysis_id, match_id, fixture_id,
    home, away, phase, commence_time,
    market, market_key, selection,
    odd, stake, verdict, confidence,
    approved_at_minute, approved_at_score, approved_at_period,
    source,
    result, goals_home, goals_away, profit_loss, settled_at
  ) VALUES (
    NEW.id,
    NEW.match_id,
    copa_fx.fixture_id,
    COALESCE(NEW.home_team, copa_fx.home),
    COALESCE(NEW.away_team, copa_fx.away),
    copa_fx.phase,
    copa_fx.commence_time,
    NEW.market,
    NEW.market_key,
    COALESCE(NEW.market, NEW.market_key),
    NEW.odd,
    COALESCE(NEW.stake, 5.0),
    NEW.verdict,
    NEW.confidence,
    NEW.approved_at_minute,
    NEW.approved_at_score,
    NEW.approved_at_period,
    'mycroft',
    NEW.result,
    NEW.goals_home,
    NEW.goals_away,
    NEW.profit_loss,
    NEW.settled_at
  )
  ON CONFLICT (match_id, market)
  DO UPDATE SET
    result        = EXCLUDED.result,
    goals_home    = EXCLUDED.goals_home,
    goals_away    = EXCLUDED.goals_away,
    profit_loss   = EXCLUDED.profit_loss,
    settled_at    = EXCLUDED.settled_at,
    market_key    = COALESCE(EXCLUDED.market_key, copa_live_entradas.market_key),
    confidence    = COALESCE(EXCLUDED.confidence, copa_live_entradas.confidence),
    updated_at    = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_copa_live_entradas_trigger ON public.live_sinais;
CREATE TRIGGER sync_copa_live_entradas_trigger
  AFTER INSERT OR UPDATE ON public.live_sinais
  FOR EACH ROW EXECUTE FUNCTION public.sync_copa_live_entradas();


-- ─────────────────────────────────────────────────────────────────────
-- 7. Seed: popula copa_punter_entradas com sinais já aprovados
-- ─────────────────────────────────────────────────────────────────────

INSERT INTO public.copa_punter_entradas (
  signal_id, fixture_id, home, away, phase, commence_time,
  market, selection, ah_line, odd, stake_pct, block,
  confidence, ve_pct, edge_pct, prob, rationale,
  resultado, created_at
)
SELECT
  id          AS signal_id,
  fixture_id, home, away, phase, commence_time,
  market, selection, ah_line, odd, stake_pct, block,
  confidence, ve_pct, edge_pct, prob, rationale,
  resultado, created_at
FROM public.punter_copa_signals
WHERE status IN ('APROVADO', 'EXPIRADO')
  AND selection IS NOT NULL
ON CONFLICT (fixture_id, selection) DO NOTHING;
