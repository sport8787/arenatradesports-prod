-- Trigger: broadcast novo sinal APROVADO do Punter
CREATE OR REPLACE FUNCTION public.notify_punter_signal_aprovado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analysis RECORD;
  v_title TEXT;
  v_body TEXT;
BEGIN
  SELECT home_team, away_team, league, confidence, verdict
  INTO v_analysis
  FROM public.punter_analyses
  WHERE id = NEW.analysis_id
  LIMIT 1;

  -- Só dispara para sinais aprovados
  IF v_analysis.verdict IS DISTINCT FROM 'APROVADO' THEN
    RETURN NEW;
  END IF;

  v_title := '🎯 SINAL PUNTER APROVADO';
  v_body := COALESCE(v_analysis.home_team || ' vs ' || v_analysis.away_team || ' | ', '') ||
            NEW.market || ' @ ' || COALESCE(NEW.odd::text, '?') ||
            ' | Confiança: ' || COALESCE(v_analysis.confidence::text, '?') || '%';

  PERFORM net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'broadcast', true,
      'payload', jsonb_build_object(
        'title', v_title,
        'body', v_body,
        'tag', 'punter-' || NEW.id,
        'url', '/punter'
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_punter_signal_aprovado erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_punter_signal_aprovado ON public.punter_signals;
CREATE TRIGGER trg_notify_punter_signal_aprovado
AFTER INSERT ON public.punter_signals
FOR EACH ROW EXECUTE FUNCTION public.notify_punter_signal_aprovado();

-- Trigger: broadcast GREEN/RED de sinal Punter quando liquidado
CREATE OR REPLACE FUNCTION public.notify_punter_signal_settled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_analysis RECORD;
  v_title TEXT;
  v_body TEXT;
  v_jogo TEXT;
BEGIN
  -- Só dispara quando result mudou para won/lost
  IF NEW.result IS NULL OR NEW.result NOT IN ('won','lost','green','red') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.result IS NOT DISTINCT FROM NEW.result THEN
    RETURN NEW;
  END IF;

  SELECT home_team, away_team INTO v_analysis
  FROM public.punter_analyses WHERE id = NEW.analysis_id LIMIT 1;

  v_jogo := COALESCE(v_analysis.home_team || ' vs ' || v_analysis.away_team || ' | ', '');

  IF NEW.result IN ('won','green') THEN
    v_title := '🟢 GREEN PUNTER!';
    v_body := v_jogo || NEW.market || ' @ ' || COALESCE(NEW.odd::text,'?') || ' VENCEU';
  ELSE
    v_title := '🔴 RED PUNTER';
    v_body := v_jogo || NEW.market || ' @ ' || COALESCE(NEW.odd::text,'?') || ' perdeu';
  END IF;

  PERFORM net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'broadcast', true,
      'payload', jsonb_build_object(
        'title', v_title,
        'body', v_body,
        'tag', 'punter-result-' || NEW.id,
        'url', '/punter'
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_punter_signal_settled erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_punter_signal_settled ON public.punter_signals;
CREATE TRIGGER trg_notify_punter_signal_settled
AFTER UPDATE ON public.punter_signals
FOR EACH ROW EXECUTE FUNCTION public.notify_punter_signal_settled();