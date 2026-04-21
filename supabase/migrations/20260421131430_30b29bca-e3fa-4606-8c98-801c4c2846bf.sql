
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
BEGIN
  -- Só age quando há análise vinculada e a partida acabou de transitar para finalizado
  IF NEW.mycroft_analysis_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT (v_status = ANY(v_finished_set)) THEN
    RETURN NEW;
  END IF;

  -- Evita reprocessar (status já era finalizado)
  IF v_old_status = ANY(v_finished_set) THEN
    RETURN NEW;
  END IF;

  -- Não sobrescreve se já liquidado
  PERFORM 1 FROM public.mycroft_analyses
   WHERE id = NEW.mycroft_analysis_id AND result IS NOT NULL;
  IF FOUND THEN
    RETURN NEW;
  END IF;

  v_result := public.settle_mycroft_analysis(
    NEW.mycroft_analysis_id,
    COALESCE(NEW.score_home, 0),
    COALESCE(NEW.score_away, 0),
    'auto_trigger_finished'
  );

  RAISE NOTICE '[auto_settle] match=% analysis=% result=%', NEW.match_id, NEW.mycroft_analysis_id, v_result;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[auto_settle] erro match=%: %', NEW.match_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_settle_mycroft_on_finish ON public.live_matches;
CREATE TRIGGER auto_settle_mycroft_on_finish
AFTER UPDATE OF status ON public.live_matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_settle_mycroft();
