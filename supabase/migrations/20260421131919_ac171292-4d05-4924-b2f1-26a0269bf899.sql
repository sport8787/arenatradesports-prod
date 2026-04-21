
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
  v_analysis_match TEXT;
  v_already_settled BOOLEAN := false;
  v_settled_at TIMESTAMPTZ;
  v_total INT := COALESCE(NEW.score_home,0) + COALESCE(NEW.score_away,0);
  v_lock_acquired BOOLEAN;
BEGIN
  -- Sem análise vinculada → nada a fazer
  IF NEW.mycroft_analysis_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só age se o NOVO status é finalizado
  IF NOT (v_status = ANY(v_finished_set)) THEN
    RETURN NEW;
  END IF;

  -- IDEMPOTÊNCIA #1: lock por análise (impede execuções simultâneas)
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext('settle_' || NEW.mycroft_analysis_id::text));
  IF NOT v_lock_acquired THEN
    INSERT INTO public.mycroft_settlement_log
      (match_id, analysis_id, score_home, score_away, total_goals, result, outcome, reason, status_old, status_new)
    VALUES (NEW.match_id, NEW.mycroft_analysis_id, NEW.score_home, NEW.score_away, v_total,
            'skipped', 'lock_busy', 'Outra transação está liquidando esta análise', v_old_status, v_status);
    RETURN NEW;
  END IF;

  -- Carrega estado atual da análise
  SELECT market, verdict, match_id, settled_at, (result IS NOT NULL OR settled_at IS NOT NULL)
  INTO v_market, v_verdict, v_analysis_match, v_settled_at, v_already_settled
  FROM public.mycroft_analyses
  WHERE id = NEW.mycroft_analysis_id;

  -- IDEMPOTÊNCIA #2: já liquidada (result OU settled_at)
  IF v_already_settled THEN
    -- Só loga se o status realmente mudou (evita flood em updates repetidos)
    IF NOT (v_old_status = ANY(v_finished_set)) THEN
      INSERT INTO public.mycroft_settlement_log
        (match_id, analysis_id, market, verdict, score_home, score_away, total_goals, result, outcome, reason, status_old, status_new)
      VALUES (NEW.match_id, NEW.mycroft_analysis_id, v_market, v_verdict, NEW.score_home, NEW.score_away, v_total,
              'skipped', 'already_settled',
              'Análise já liquidada em ' || COALESCE(v_settled_at::text,'?'),
              v_old_status, v_status);
    END IF;
    RETURN NEW;
  END IF;

  -- IDEMPOTÊNCIA #3: status anterior também era finalizado → não reprocessa
  IF v_old_status = ANY(v_finished_set) THEN
    RETURN NEW;
  END IF;

  -- VALIDAÇÃO DE VÍNCULO: a análise deve pertencer a este jogo
  IF v_analysis_match IS NULL OR v_analysis_match <> NEW.match_id THEN
    INSERT INTO public.mycroft_settlement_log
      (match_id, analysis_id, market, verdict, score_home, score_away, total_goals, result, outcome, reason, status_old, status_new, error_message)
    VALUES (NEW.match_id, NEW.mycroft_analysis_id, v_market, v_verdict, NEW.score_home, NEW.score_away, v_total,
            'skipped', 'mismatch',
            'Análise vinculada a outro match_id: ' || COALESCE(v_analysis_match,'NULL') || ' ≠ ' || NEW.match_id,
            v_old_status, v_status,
            'mismatch_match_id');
    RETURN NEW;
  END IF;

  -- Liquida
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
      WHEN 'unsupported_market' THEN 'Mercado não suportado: ' || COALESCE(v_market,'?')
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

-- Rotina utilitária: re-vincula análises órfãs (mesmo match_id mas live_matches.mycroft_analysis_id está NULL)
CREATE OR REPLACE FUNCTION public.relink_mycroft_analyses()
RETURNS TABLE(linked INT, mismatched INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_linked INT := 0;
  v_mismatched INT := 0;
BEGIN
  -- Vincula live_matches que têm análise compatível por match_id
  WITH candidates AS (
    SELECT DISTINCT ON (lm.match_id) lm.match_id, ma.id AS analysis_id
    FROM public.live_matches lm
    JOIN public.mycroft_analyses ma ON ma.match_id = lm.match_id
    WHERE lm.mycroft_analysis_id IS NULL
      AND ma.verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
    ORDER BY lm.match_id, ma.created_at DESC
  ),
  upd AS (
    UPDATE public.live_matches lm
    SET mycroft_analysis_id = c.analysis_id
    FROM candidates c
    WHERE lm.match_id = c.match_id
    RETURNING 1
  )
  SELECT count(*) INTO v_linked FROM upd;

  -- Detecta mismatches (live_matches aponta para análise de outro jogo)
  SELECT count(*) INTO v_mismatched
  FROM public.live_matches lm
  JOIN public.mycroft_analyses ma ON ma.id = lm.mycroft_analysis_id
  WHERE ma.match_id <> lm.match_id;

  RETURN QUERY SELECT v_linked, v_mismatched;
END;
$$;
