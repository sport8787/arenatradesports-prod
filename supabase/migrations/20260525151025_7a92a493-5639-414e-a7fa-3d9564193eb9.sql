
-- 1) Padronizar settle_mycroft_shadow_ai para gravar UPPERCASE
CREATE OR REPLACE FUNCTION public.settle_mycroft_shadow_ai(p_id uuid, p_score_home integer, p_score_away integer, p_reason text DEFAULT 'auto'::text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_market TEXT; v_verdict TEXT; v_home TEXT; v_away TEXT;
  v_total INT := COALESCE(p_score_home,0) + COALESCE(p_score_away,0);
  v_appr_total INT; v_ah INT; v_aa INT; v_result TEXT; v_line NUMERIC;
  v_team_label TEXT; v_team_norm TEXT; v_home_norm TEXT; v_away_norm TEXT;
  v_home_scored BOOLEAN; v_away_scored BOOLEAN;
BEGIN
  SELECT market, verdict, approved_at_score_home, approved_at_score_away, home_team, away_team
    INTO v_market, v_verdict, v_ah, v_aa, v_home, v_away
  FROM public.mycroft_analyses_shadow_ai WHERE id = p_id;
  IF v_market IS NULL THEN RETURN 'not_found'; END IF;
  IF v_verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN 'not_active'; END IF;

  IF v_market ~* '(pr[óo]ximo\s+gol|next\s+goal)' THEN
    IF v_ah IS NULL OR v_aa IS NULL THEN RETURN 'missing_snapshot'; END IF;
    v_appr_total := COALESCE(v_ah,0) + COALESCE(v_aa,0);
    v_home_scored := COALESCE(p_score_home,0) > COALESCE(v_ah,0);
    v_away_scored := COALESCE(p_score_away,0) > COALESCE(v_aa,0);
    v_team_label := (regexp_matches(v_market, '(?:pr[óo]ximo\s+gol|next\s+goal)\s*[:\-\(]\s*([^)]+)\)?', 'i'))[1];
    IF v_team_label IS NULL OR btrim(v_team_label) = '' THEN
      IF v_market ~* 'n[ãa]o' THEN
        v_result := CASE WHEN v_total > v_appr_total THEN 'RED' ELSE 'GREEN' END;
      ELSE
        v_result := CASE WHEN v_total > v_appr_total THEN 'GREEN' ELSE 'RED' END;
      END IF;
    ELSE
      v_team_norm := lower(unaccent(btrim(v_team_label)));
      v_home_norm := lower(unaccent(COALESCE(v_home,'')));
      v_away_norm := lower(unaccent(COALESCE(v_away,'')));
      IF v_home_norm <> '' AND (v_team_norm = v_home_norm OR position(v_team_norm in v_home_norm) > 0 OR position(v_home_norm in v_team_norm) > 0) THEN
        IF v_home_scored AND NOT v_away_scored THEN v_result := 'GREEN';
        ELSIF v_away_scored AND NOT v_home_scored THEN v_result := 'RED';
        ELSIF v_home_scored AND v_away_scored THEN v_result := 'RED';
        ELSE RETURN 'no_goal_yet';
        END IF;
      ELSIF v_away_norm <> '' AND (v_team_norm = v_away_norm OR position(v_team_norm in v_away_norm) > 0 OR position(v_away_norm in v_team_norm) > 0) THEN
        IF v_away_scored AND NOT v_home_scored THEN v_result := 'GREEN';
        ELSIF v_home_scored AND NOT v_away_scored THEN v_result := 'RED';
        ELSIF v_home_scored AND v_away_scored THEN v_result := 'RED';
        ELSE RETURN 'no_goal_yet';
        END IF;
      ELSE
        RETURN 'unmatched_team';
      END IF;
    END IF;
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

  UPDATE public.mycroft_analyses_shadow_ai
  SET result = v_result, final_score_home = p_score_home, final_score_away = p_score_away,
      settled_at = now(), settle_reason = p_reason
  WHERE id = p_id;
  RETURN v_result;
END;
$function$;

-- 2) Trigger robusto: também disparar quando mycroft_analysis_id é setado (sinal criado pós-finish)
DROP TRIGGER IF EXISTS auto_settle_mycroft_on_finish ON public.live_matches;
CREATE TRIGGER auto_settle_mycroft_on_finish
AFTER UPDATE OF status, mycroft_analysis_id ON public.live_matches
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_settle_mycroft();

-- 3) Trigger novo: quando shadow_ai insere/atualiza sinal e o jogo já está finished, liquida na hora
CREATE OR REPLACE FUNCTION public.trg_settle_shadow_ai_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status TEXT; v_sh INT; v_sa INT; v_minute INT;
BEGIN
  IF NEW.result IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN NEW; END IF;
  SELECT lower(COALESCE(status,'')), COALESCE(score_home,0), COALESCE(score_away,0), COALESCE(minute,0)
    INTO v_status, v_sh, v_sa, v_minute
  FROM public.live_matches WHERE match_id = NEW.match_id;
  IF v_status IS NULL THEN RETURN NEW; END IF;
  IF v_status NOT IN ('finished','ft','aet','pen','fin','ended') THEN RETURN NEW; END IF;
  IF v_minute > 0 AND v_minute < 88 THEN RETURN NEW; END IF;
  PERFORM public.settle_mycroft_shadow_ai(NEW.id, v_sh, v_sa, 'insert_post_finish');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_settle_shadow_ai_on_insert ON public.mycroft_analyses_shadow_ai;
CREATE TRIGGER trg_settle_shadow_ai_on_insert
AFTER INSERT ON public.mycroft_analyses_shadow_ai
FOR EACH ROW EXECUTE FUNCTION public.trg_settle_shadow_ai_on_insert();

-- 4) Análogo para shadow_af
CREATE OR REPLACE FUNCTION public.trg_settle_shadow_af_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_status TEXT; v_sh INT; v_sa INT; v_minute INT;
BEGIN
  IF NEW.result IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN NEW; END IF;
  SELECT lower(COALESCE(status,'')), COALESCE(score_home,0), COALESCE(score_away,0), COALESCE(minute,0)
    INTO v_status, v_sh, v_sa, v_minute
  FROM public.live_matches WHERE match_id = NEW.match_id;
  IF v_status IS NULL THEN RETURN NEW; END IF;
  IF v_status NOT IN ('finished','ft','aet','pen','fin','ended') THEN RETURN NEW; END IF;
  IF v_minute > 0 AND v_minute < 88 THEN RETURN NEW; END IF;
  PERFORM public.settle_mycroft_shadow_af(NEW.id, v_sh, v_sa, 'insert_post_finish');
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_settle_shadow_af_on_insert ON public.mycroft_analyses_shadow_af;
CREATE TRIGGER trg_settle_shadow_af_on_insert
AFTER INSERT ON public.mycroft_analyses_shadow_af
FOR EACH ROW EXECUTE FUNCTION public.trg_settle_shadow_af_on_insert();
