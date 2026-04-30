-- 1) Colunas de liquidação na tabela shadow
ALTER TABLE public.mycroft_analyses_shadow_af
  ADD COLUMN IF NOT EXISTS result TEXT,
  ADD COLUMN IF NOT EXISTS final_score_home INT,
  ADD COLUMN IF NOT EXISTS final_score_away INT,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settle_reason TEXT,
  ADD COLUMN IF NOT EXISTS stats_snapshot JSONB;

-- 2) Snapshot de stats também na primária (para diff)
ALTER TABLE public.mycroft_analyses
  ADD COLUMN IF NOT EXISTS stats_snapshot JSONB;

-- 3) Índices para painel agregado
CREATE INDEX IF NOT EXISTS idx_shadow_af_created_verdict
  ON public.mycroft_analyses_shadow_af (created_at DESC, verdict);
CREATE INDEX IF NOT EXISTS idx_shadow_af_match_market
  ON public.mycroft_analyses_shadow_af (match_id, market);
CREATE INDEX IF NOT EXISTS idx_shadow_af_result
  ON public.mycroft_analyses_shadow_af (result) WHERE result IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_created_verdict
  ON public.mycroft_analyses (created_at DESC, verdict);

-- 4) Função de liquidação (espelho da settle_mycroft_analysis)
CREATE OR REPLACE FUNCTION public.settle_mycroft_shadow_af(
  p_id UUID, p_score_home INT, p_score_away INT, p_reason TEXT DEFAULT 'auto'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_market TEXT;
  v_verdict TEXT;
  v_total INT := COALESCE(p_score_home,0) + COALESCE(p_score_away,0);
  v_result TEXT;
  v_line NUMERIC;
BEGIN
  SELECT market, verdict INTO v_market, v_verdict
  FROM public.mycroft_analyses_shadow_af WHERE id = p_id;
  IF v_market IS NULL THEN RETURN 'not_found'; END IF;
  IF v_verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN 'not_active'; END IF;

  IF v_market ~* 'over\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'over\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total > v_line THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* 'under\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'under\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total < v_line THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* '(btts|ambas\s+marcam|both\s+teams\s+to\s+score).*sim|^sim' THEN
    v_result := CASE WHEN p_score_home > 0 AND p_score_away > 0 THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* '(btts|ambas|both).*n[ãa]o' THEN
    v_result := CASE WHEN p_score_home = 0 OR p_score_away = 0 THEN 'green' ELSE 'red' END;
  ELSE
    RETURN 'unsupported_market';
  END IF;

  UPDATE public.mycroft_analyses_shadow_af
  SET result = v_result,
      final_score_home = p_score_home,
      final_score_away = p_score_away,
      settled_at = now(),
      settle_reason = p_reason
  WHERE id = p_id;

  RETURN v_result;
END;
$$;

-- 5) Trigger no live_matches: ao finalizar, liquida TODOS os sinais shadow do match
CREATE OR REPLACE FUNCTION public.trg_auto_settle_shadow_af()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_status TEXT := lower(COALESCE(NEW.status, ''));
  v_old_status TEXT := lower(COALESCE(OLD.status, ''));
  v_finished_set TEXT[] := ARRAY['finished','ft','aet','pen','fin','ended'];
  v_minute INT := COALESCE(NEW.minute, 0);
  v_rec RECORD;
BEGIN
  IF NOT (v_status = ANY(v_finished_set)) THEN RETURN NEW; END IF;
  IF v_old_status = ANY(v_finished_set) THEN RETURN NEW; END IF;
  IF v_minute > 0 AND v_minute < 88 THEN RETURN NEW; END IF;

  FOR v_rec IN
    SELECT id FROM public.mycroft_analyses_shadow_af
    WHERE match_id = NEW.match_id
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND result IS NULL
  LOOP
    PERFORM public.settle_mycroft_shadow_af(
      v_rec.id, COALESCE(NEW.score_home,0), COALESCE(NEW.score_away,0),
      'auto_trigger_finished'
    );
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_auto_settle_shadow_af erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_settle_shadow_af ON public.live_matches;
CREATE TRIGGER auto_settle_shadow_af
  AFTER UPDATE ON public.live_matches
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_auto_settle_shadow_af();

-- 6) RPC agregada para o painel (A): aceita janela em dias OU "desde ativação"
CREATE OR REPLACE FUNCTION public.compare_providers_metrics(p_since TIMESTAMPTZ)
RETURNS TABLE(
  provider TEXT,
  total_approvados INT,
  liquidados INT,
  greens INT,
  reds INT,
  win_rate NUMERIC,
  pendentes INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'sportmonks'::TEXT AS provider,
         COUNT(*)::INT AS total_approvados,
         COUNT(*) FILTER (WHERE result IN ('green','red'))::INT AS liquidados,
         COUNT(*) FILTER (WHERE result = 'green')::INT AS greens,
         COUNT(*) FILTER (WHERE result = 'red')::INT AS reds,
         CASE WHEN COUNT(*) FILTER (WHERE result IN ('green','red')) > 0
              THEN ROUND(100.0 * COUNT(*) FILTER (WHERE result = 'green')
                                / COUNT(*) FILTER (WHERE result IN ('green','red')), 1)
              ELSE NULL END AS win_rate,
         COUNT(*) FILTER (WHERE result IS NULL)::INT AS pendentes
  FROM public.mycroft_analyses
  WHERE verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
    AND created_at >= p_since
  UNION ALL
  SELECT 'api-football'::TEXT,
         COUNT(*)::INT,
         COUNT(*) FILTER (WHERE result IN ('green','red'))::INT,
         COUNT(*) FILTER (WHERE result = 'green')::INT,
         COUNT(*) FILTER (WHERE result = 'red')::INT,
         CASE WHEN COUNT(*) FILTER (WHERE result IN ('green','red')) > 0
              THEN ROUND(100.0 * COUNT(*) FILTER (WHERE result = 'green')
                                / COUNT(*) FILTER (WHERE result IN ('green','red')), 1)
              ELSE NULL END,
         COUNT(*) FILTER (WHERE result IS NULL)::INT
  FROM public.mycroft_analyses_shadow_af
  WHERE verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
    AND created_at >= p_since;
$$;

-- 7) RPC de divergências: total e quantas de cada tipo no período
CREATE OR REPLACE FUNCTION public.compare_providers_divergences(p_since TIMESTAMPTZ)
RETURNS TABLE(
  divergencia TEXT,
  total INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH sm AS (
    SELECT match_id, lower(trim(market)) AS market_norm
    FROM public.mycroft_analyses
    WHERE verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND created_at >= p_since
  ),
  af AS (
    SELECT match_id, lower(trim(market)) AS market_norm
    FROM public.mycroft_analyses_shadow_af
    WHERE verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND created_at >= p_since
  )
  SELECT 'confirmados_ambas'::TEXT, COUNT(*)::INT
    FROM sm JOIN af USING (match_id, market_norm)
  UNION ALL
  SELECT 'so_sportmonks'::TEXT, COUNT(*)::INT
    FROM sm WHERE NOT EXISTS (
      SELECT 1 FROM af WHERE af.match_id = sm.match_id AND af.market_norm = sm.market_norm
    )
  UNION ALL
  SELECT 'so_api_football'::TEXT, COUNT(*)::INT
    FROM af WHERE NOT EXISTS (
      SELECT 1 FROM sm WHERE sm.match_id = af.match_id AND sm.market_norm = af.market_norm
    )
  UNION ALL
  SELECT 'mesma_partida_mercado_diferente'::TEXT, COUNT(DISTINCT sm.match_id)::INT
    FROM sm JOIN af ON sm.match_id = af.match_id
    WHERE sm.market_norm <> af.market_norm
      AND NOT EXISTS (
        SELECT 1 FROM af af2 WHERE af2.match_id = sm.match_id AND af2.market_norm = sm.market_norm
      );
$$;