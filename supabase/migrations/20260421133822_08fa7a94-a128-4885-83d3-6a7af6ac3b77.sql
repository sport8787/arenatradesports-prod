-- 1) REVERTE liquidações incorretas: análises liquidadas enquanto o jogo ainda está ao vivo
UPDATE public.mycroft_analyses ma
SET result = NULL,
    final_score_home = NULL,
    final_score_away = NULL,
    settled_at = NULL,
    settle_reason = NULL
FROM public.live_matches lm
WHERE ma.match_id = lm.match_id
  AND ma.settled_at IS NOT NULL
  AND ma.settle_reason = 'auto_trigger_finished'
  AND lower(COALESCE(lm.status,'')) NOT IN ('finished','ft','aet','pen','fin','ended')
  AND COALESCE(lm.minute, 0) < 88;

-- 2) Loga a reversão
INSERT INTO public.mycroft_settlement_log
  (match_id, analysis_id, market, verdict, score_home, score_away, total_goals,
   result, outcome, reason, status_old, status_new)
SELECT lm.match_id, ma.id, ma.market, ma.verdict,
       lm.score_home, lm.score_away,
       COALESCE(lm.score_home,0)+COALESCE(lm.score_away,0),
       'skipped', 'reverted_premature',
       'Liquidação revertida: jogo ainda ao vivo (minuto ' || COALESCE(lm.minute::text,'?') || ', status=' || COALESCE(lm.status,'?') || ')',
       'finished', lower(COALESCE(lm.status,''))
FROM public.live_matches lm
JOIN public.mycroft_analyses ma ON ma.match_id = lm.match_id
WHERE ma.result IS NULL AND ma.settled_at IS NULL
  AND ma.match_id IN (
    SELECT DISTINCT match_id FROM public.live_matches
    WHERE lower(COALESCE(status,'')) NOT IN ('finished','ft','aet','pen','fin','ended')
      AND COALESCE(minute,0) < 88
  )
  AND ma.match_id = '1523110';

-- 3) ENDURECE o trigger: exige minuto >= 88 quando status muda para "finished",
--    para evitar falsos finais de provedores que oscilam o status.
CREATE OR REPLACE FUNCTION public.trg_auto_settle_mycroft()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_minute INT := COALESCE(NEW.minute, 0);
BEGIN
  IF NEW.mycroft_analysis_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Só age se o NOVO status é finalizado
  IF NOT (v_status = ANY(v_finished_set)) THEN
    RETURN NEW;
  END IF;

  -- GUARD ANTI-FALSO-FINAL: exige minuto >= 88 OU período explícito de fim.
  -- Provedores às vezes mandam 'ft' temporariamente em jogos ao vivo.
  IF v_minute > 0 AND v_minute < 88 THEN
    INSERT INTO public.mycroft_settlement_log
      (match_id, analysis_id, score_home, score_away, total_goals, result, outcome, reason, status_old, status_new)
    VALUES (NEW.match_id, NEW.mycroft_analysis_id, NEW.score_home, NEW.score_away, v_total,
            'skipped', 'premature_finish',
            'Status=' || v_status || ' mas minuto=' || v_minute || ' < 88. Aguardando fim real.',
            v_old_status, v_status);
    RETURN NEW;
  END IF;

  -- IDEMPOTÊNCIA #1: lock por análise
  v_lock_acquired := pg_try_advisory_xact_lock(hashtext('settle_' || NEW.mycroft_analysis_id::text));
  IF NOT v_lock_acquired THEN
    INSERT INTO public.mycroft_settlement_log
      (match_id, analysis_id, score_home, score_away, total_goals, result, outcome, reason, status_old, status_new)
    VALUES (NEW.match_id, NEW.mycroft_analysis_id, NEW.score_home, NEW.score_away, v_total,
            'skipped', 'lock_busy', 'Outra transação está liquidando esta análise', v_old_status, v_status);
    RETURN NEW;
  END IF;

  SELECT market, verdict, match_id, settled_at, (result IS NOT NULL OR settled_at IS NOT NULL)
  INTO v_market, v_verdict, v_analysis_match, v_settled_at, v_already_settled
  FROM public.mycroft_analyses
  WHERE id = NEW.mycroft_analysis_id;

  IF v_already_settled THEN
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

  IF v_old_status = ANY(v_finished_set) THEN
    RETURN NEW;
  END IF;

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
      WHEN 'green' THEN 'Mercado vencedor com placar ' || NEW.score_home || '-' || NEW.score_away || ' (min ' || v_minute || ')'
      WHEN 'red'   THEN 'Mercado perdedor com placar ' || NEW.score_home || '-' || NEW.score_away || ' (min ' || v_minute || ')'
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
$function$;