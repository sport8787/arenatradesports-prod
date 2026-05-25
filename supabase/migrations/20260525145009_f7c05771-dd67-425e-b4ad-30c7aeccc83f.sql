-- 1) Backfill normalização
UPDATE public.mycroft_analyses SET result = UPPER(result) WHERE result IS NOT NULL AND result <> UPPER(result);
UPDATE public.mycroft_analyses_shadow_ai SET result = UPPER(result) WHERE result IS NOT NULL AND result <> UPPER(result);
UPDATE public.mycroft_analyses_shadow_af SET result = UPPER(result) WHERE result IS NOT NULL AND result <> UPPER(result);

-- 2) RPC settle_mycroft_analysis — gravar UPPERCASE
CREATE OR REPLACE FUNCTION public.settle_mycroft_analysis(p_analysis_id uuid, p_score_home integer, p_score_away integer, p_reason text DEFAULT 'manual'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_market TEXT;
  v_verdict TEXT;
  v_total INT := COALESCE(p_score_home,0) + COALESCE(p_score_away,0);
  v_appr_total INT;
  v_ah INT;
  v_aa INT;
  v_result TEXT;
  v_line NUMERIC;
BEGIN
  SELECT market, verdict, approved_at_score_home, approved_at_score_away
    INTO v_market, v_verdict, v_ah, v_aa
  FROM public.mycroft_analyses WHERE id = p_analysis_id;
  IF v_market IS NULL THEN RETURN 'not_found'; END IF;
  IF v_verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN 'not_active'; END IF;

  IF v_market ~* '(pr[óo]ximo\s+gol|next\s+goal)' THEN
    IF v_ah IS NULL OR v_aa IS NULL THEN
      RETURN 'missing_snapshot';
    END IF;
    v_appr_total := COALESCE(v_ah,0) + COALESCE(v_aa,0);
    v_result := CASE WHEN v_total > v_appr_total THEN 'GREEN' ELSE 'RED' END;
  ELSIF v_market ~* 'over\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'over\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total > v_line THEN 'GREEN' ELSE 'RED' END;
  ELSIF v_market ~* 'under\s*([0-9]+(\.[0-9]+)?)' THEN
    v_line := (regexp_matches(v_market, 'under\s*([0-9]+(\.[0-9]+)?)', 'i'))[1]::numeric;
    v_result := CASE WHEN v_total < v_line THEN 'GREEN' ELSE 'RED' END;
  ELSIF v_market ~* '(btts|ambas\s+marcam|both\s+teams\s+to\s+score).*sim|^sim' THEN
    v_result := CASE WHEN p_score_home > 0 AND p_score_away > 0 THEN 'GREEN' ELSE 'RED' END;
  ELSIF v_market ~* '(btts|ambas|both).*n[ãa]o' THEN
    v_result := CASE WHEN p_score_home = 0 OR p_score_away = 0 THEN 'GREEN' ELSE 'RED' END;
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
$function$;

-- 3) Trigger auto_settle — normalizar saídas via UPPER no UPDATE final
-- (mantém a lógica mas garante que toda gravação saia em MAIÚSCULO)
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
  v_minute INT := COALESCE(NEW.minute, 0);
  v_settle_result TEXT;
BEGIN
  IF NEW.mycroft_analysis_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT (v_status = ANY(v_finished_set)) THEN
    RETURN NEW;
  END IF;
  IF v_minute > 0 AND v_minute < 88 THEN
    RETURN NEW;
  END IF;
  -- delega para a RPC (que já grava UPPERCASE)
  SELECT public.settle_mycroft_analysis(
    NEW.mycroft_analysis_id,
    COALESCE(NEW.score_home, 0),
    COALESCE(NEW.score_away, 0),
    'trigger_auto'
  ) INTO v_settle_result;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;