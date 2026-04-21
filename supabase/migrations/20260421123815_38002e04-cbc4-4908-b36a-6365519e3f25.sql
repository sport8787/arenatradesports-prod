-- Trigger: notificar usuário quando aposta virtual fecha (GREEN/RED)
CREATE OR REPLACE FUNCTION public.notify_bet_settled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title TEXT;
  v_body TEXT;
  v_emoji TEXT;
  v_result TEXT;
  v_pnl NUMERIC;
BEGIN
  -- Detecta resultado (campos podem variar: result, status)
  v_result := COALESCE(NEW.result, NEW.status);
  v_pnl := COALESCE(NEW.profit_loss, 0);

  IF v_result IS NULL OR v_result NOT IN ('won','lost','green','red','win','loss') THEN
    RETURN NEW;
  END IF;

  -- Só dispara se mudou de pendente para liquidado
  IF TG_OP = 'UPDATE' AND OLD.result IS NOT DISTINCT FROM NEW.result AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF v_result IN ('won','green','win') THEN
    v_emoji := '🟢 GREEN';
    v_title := '🟢 GREEN! Aposta vencedora';
    v_body := 'Lucro: +' || ROUND(v_pnl::numeric, 2) || ' | ' || COALESCE(NEW.market, 'Aposta');
  ELSE
    v_emoji := '🔴 RED';
    v_title := '🔴 RED — Aposta perdida';
    v_body := 'Perda: ' || ROUND(v_pnl::numeric, 2) || ' | ' || COALESCE(NEW.market, 'Aposta');
  END IF;

  PERFORM net.http_post(
    url := 'https://affquongjlhmusxzohjl.supabase.co/functions/v1/send-web-push',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_ids', jsonb_build_array(NEW.user_id),
      'payload', jsonb_build_object(
        'title', v_title,
        'body', v_body,
        'tag', 'bet-' || NEW.id,
        'url', '/apostas'
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_bet_settled erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bet_settled ON public.bets_history;
CREATE TRIGGER trg_notify_bet_settled
AFTER UPDATE ON public.bets_history
FOR EACH ROW EXECUTE FUNCTION public.notify_bet_settled();

-- Trigger: broadcast APROVADO ao vivo para todos os inscritos
CREATE OR REPLACE FUNCTION public.notify_aprovado_broadcast()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_title TEXT;
  v_body TEXT;
BEGIN
  IF NEW.verdict <> 'APROVADO' THEN RETURN NEW; END IF;

  SELECT home_team, away_team, championship, minute INTO v_match
  FROM public.live_matches WHERE match_id = NEW.match_id LIMIT 1;

  v_title := '🎯 SINAL APROVADO';
  v_body := COALESCE(v_match.home_team || ' vs ' || v_match.away_team || ' | ', '') ||
            NEW.market || ' @ ' || COALESCE(NEW.odd::text,'?') ||
            ' | ' || COALESCE(NEW.confidence::text,'?') || '%';

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
        'tag', 'aprovado-' || NEW.id,
        'url', '/arena-trader-sports'
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_aprovado_broadcast erro: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_aprovado_broadcast ON public.mycroft_analyses;
CREATE TRIGGER trg_notify_aprovado_broadcast
AFTER INSERT ON public.mycroft_analyses
FOR EACH ROW EXECUTE FUNCTION public.notify_aprovado_broadcast();