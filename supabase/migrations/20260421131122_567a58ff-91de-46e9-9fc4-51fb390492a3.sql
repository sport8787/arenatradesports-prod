-- Adicionar colunas de resultado em mycroft_analyses
ALTER TABLE public.mycroft_analyses
  ADD COLUMN IF NOT EXISTS result TEXT,
  ADD COLUMN IF NOT EXISTS final_score_home INTEGER,
  ADD COLUMN IF NOT EXISTS final_score_away INTEGER,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settle_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_match_id ON public.mycroft_analyses(match_id);
CREATE INDEX IF NOT EXISTS idx_mycroft_analyses_result ON public.mycroft_analyses(result) WHERE result IS NULL;

-- Função para liquidar análise com base em placar e mercado
CREATE OR REPLACE FUNCTION public.settle_mycroft_analysis(p_analysis_id UUID, p_score_home INT, p_score_away INT, p_reason TEXT DEFAULT 'manual')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_market TEXT;
  v_verdict TEXT;
  v_total INT := COALESCE(p_score_home,0) + COALESCE(p_score_away,0);
  v_result TEXT;
  v_line NUMERIC;
BEGIN
  SELECT market, verdict INTO v_market, v_verdict
  FROM public.mycroft_analyses WHERE id = p_analysis_id;
  IF v_market IS NULL THEN RETURN 'not_found'; END IF;
  IF v_verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN 'not_active'; END IF;

  -- Over X.5 Gols
  IF v_market ~* 'over\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'over\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total > v_line THEN 'green' ELSE 'red' END;
  -- Under X.5 Gols
  ELSIF v_market ~* 'under\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'under\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total < v_line THEN 'green' ELSE 'red' END;
  -- Ambas marcam (BTTS)
  ELSIF v_market ~* '(btts|ambas\s+marcam|both\s+teams\s+to\s+score).*sim|^sim' THEN
    v_result := CASE WHEN p_score_home > 0 AND p_score_away > 0 THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* '(btts|ambas|both).*n[ãa]o' THEN
    v_result := CASE WHEN p_score_home = 0 OR p_score_away = 0 THEN 'green' ELSE 'red' END;
  ELSE
    RETURN 'unsupported_market';
  END IF;

  UPDATE public.mycroft_analyses
  SET result = v_result,
      final_score_home = p_score_home,
      final_score_away = p_score_away,
      settled_at = now(),
      settle_reason = p_reason
  WHERE id = p_analysis_id;

  RETURN v_result;
END;
$$;