
-- 1. Tabela de logs
CREATE TABLE IF NOT EXISTS public.mycroft_settlement_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id TEXT,
  analysis_id UUID,
  market TEXT,
  verdict TEXT,
  score_home INT,
  score_away INT,
  total_goals INT,
  result TEXT,                    -- green | red | skipped | error
  outcome TEXT,                   -- detalhe: 'settled', 'already_settled', 'unsupported_market', 'not_active', 'no_analysis', 'status_unchanged', 'error'
  reason TEXT,                    -- explicação humana
  trigger_source TEXT DEFAULT 'auto_trigger_finished',
  status_old TEXT,
  status_new TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_settlement_log_match ON public.mycroft_settlement_log(match_id);
CREATE INDEX IF NOT EXISTS idx_settlement_log_analysis ON public.mycroft_settlement_log(analysis_id);
CREATE INDEX IF NOT EXISTS idx_settlement_log_created ON public.mycroft_settlement_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_settlement_log_result ON public.mycroft_settlement_log(result);

ALTER TABLE public.mycroft_settlement_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view settlement logs" ON public.mycroft_settlement_log;
CREATE POLICY "Admins can view settlement logs"
ON public.mycroft_settlement_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Trigger atualizado com logging completo
CREATE OR REPLACE FUNCTION public.trg_auto_settle_mycroft()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status TEXT := lower(COALESCE(NEW.status, ''));
  v_old_status TEXT := lower(COALESCE(OLD.status, ''));
  v_finished_set TEXT[] := ARRAY['finished','ft','aet','pen','fin','ended'];
  v_result TEXT;
  v_market TEXT;
  v_verdict TEXT;
  v_already BOOLEAN := false;
  v_total INT := COALESCE(NEW.score_home,0) + COALESCE(NEW.score_away,0);
BEGIN
  IF NEW.mycroft_analysis_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (v_status = ANY(v_finished_set)) THEN
    RETURN NEW;
  END IF;

  IF v_old_status = ANY(v_finished_set) THEN
    INSERT INTO public.mycroft_settlement_log
      (match_id, analysis_id, score_home, score_away, total_goals, result, outcome, reason, status_old, status_new)
    VALUES (NEW.match_id, NEW.mycroft_analysis_id, NEW.score_home, NEW.score_away, v_total,
            'skipped', 'status_unchanged', 'Status já era finalizado, ignorando', v_old_status, v_status);
    RETURN NEW;
  END IF;

  SELECT market, verdict, (result IS NOT NULL)
  INTO v_market, v_verdict, v_already
  FROM public.mycroft_analyses WHERE id = NEW.mycroft_analysis_id;

  IF v_already THEN
    INSERT INTO public.mycroft_settlement_log
      (match_id, analysis_id, market, verdict, score_home, score_away, total_goals, result, outcome, reason, status_old, status_new)
    VALUES (NEW.match_id, NEW.mycroft_analysis_id, v_market, v_verdict, NEW.score_home, NEW.score_away, v_total,
            'skipped', 'already_settled', 'Análise já liquidada anteriormente', v_old_status, v_status);
    RETURN NEW;
  END IF;

  v_result := public.settle_mycroft_analysis(
    NEW.mycroft_analysis_id,
    COALESCE(NEW.score_home, 0),
    COALESCE(NEW.score_away, 0),
    'auto_trigger_finished'
  );

  INSERT INTO public.mycroft_settlement_log
    (match_id, analysis_id, market, verdict, score_home, score_away, total_goals,
     result, outcome, reason, status_old, status_new)
  VALUES (
    NEW.match_id, NEW.mycroft_analysis_id, v_market, v_verdict,
    NEW.score_home, NEW.score_away, v_total,
    CASE WHEN v_result IN ('green','red') THEN v_result ELSE 'skipped' END,
    v_result,
    CASE v_result
      WHEN 'green' THEN 'Mercado vencedor com placar ' || NEW.score_home || '-' || NEW.score_away
      WHEN 'red'   THEN 'Mercado perdedor com placar ' || NEW.score_home || '-' || NEW.score_away
      WHEN 'unsupported_market' THEN 'Mercado não suportado pelo settler: ' || COALESCE(v_market,'?')
      WHEN 'not_active' THEN 'Verdict não elegível: ' || COALESCE(v_verdict,'?')
      WHEN 'not_found' THEN 'Análise não encontrada'
      ELSE 'Resultado: ' || COALESCE(v_result,'?')
    END,
    v_old_status, v_status
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.mycroft_settlement_log
    (match_id, analysis_id, market, verdict, score_home, score_away, total_goals,
     result, outcome, reason, status_old, status_new, error_message)
  VALUES (NEW.match_id, NEW.mycroft_analysis_id, v_market, v_verdict,
          NEW.score_home, NEW.score_away, v_total,
          'error', 'error', 'Falha durante liquidação automática', v_old_status, v_status, SQLERRM);
  RETURN NEW;
END;
$$;
