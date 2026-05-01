-- 1) Atualiza função SHADOW
CREATE OR REPLACE FUNCTION public.settle_mycroft_shadow_af(p_id uuid, p_score_home integer, p_score_away integer, p_reason text DEFAULT 'auto'::text)
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
  FROM public.mycroft_analyses_shadow_af WHERE id = p_id;
  IF v_market IS NULL THEN RETURN 'not_found'; END IF;
  IF v_verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN 'not_active'; END IF;

  -- "Próximo Gol" / "next goal": exige gol APÓS o snapshot de aprovação
  IF v_market ~* '(pr[óo]ximo\s+gol|next\s+goal)' THEN
    IF v_ah IS NULL OR v_aa IS NULL THEN
      RETURN 'missing_snapshot';
    END IF;
    v_appr_total := COALESCE(v_ah,0) + COALESCE(v_aa,0);
    -- Para "Over 0.5 Próximo Gol" basta sair pelo menos 1 gol depois
    v_result := CASE WHEN v_total > v_appr_total THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* 'over\s*([0-9]+(\.[0-9]+)?)' THEN
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
$function$;

-- 2) Atualiza função PRIMARY
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
    v_result := CASE WHEN v_total > v_appr_total THEN 'green' ELSE 'red' END;
  ELSIF v_market ~* 'over\s*([0-9]+(\.[0-9]+)?)' THEN
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

-- 3) Re-liquida sinais Próximo Gol já settled (corrige histórico)
UPDATE public.mycroft_analyses_shadow_af
SET result = CASE
  WHEN (COALESCE(final_score_home,0)+COALESCE(final_score_away,0))
     > (COALESCE(approved_at_score_home,0)+COALESCE(approved_at_score_away,0))
  THEN 'green' ELSE 'red' END,
  settle_reason = COALESCE(settle_reason,'') || '|reaudit_proximo_gol'
WHERE (market ~* '(pr[óo]ximo\s+gol|next\s+goal)')
  AND result IN ('green','red')
  AND approved_at_score_home IS NOT NULL
  AND final_score_home IS NOT NULL;

UPDATE public.mycroft_analyses
SET result = CASE
  WHEN (COALESCE(final_score_home,0)+COALESCE(final_score_away,0))
     > (COALESCE(approved_at_score_home,0)+COALESCE(approved_at_score_away,0))
  THEN 'green' ELSE 'red' END,
  settle_reason = COALESCE(settle_reason,'') || '|reaudit_proximo_gol'
WHERE (market ~* '(pr[óo]ximo\s+gol|next\s+goal)')
  AND result IN ('green','red')
  AND approved_at_score_home IS NOT NULL
  AND final_score_home IS NOT NULL;