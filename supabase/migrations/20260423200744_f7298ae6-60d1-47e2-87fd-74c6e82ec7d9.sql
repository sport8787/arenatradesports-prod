CREATE OR REPLACE FUNCTION public.prevent_conflicting_punter_markets()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_market_lower TEXT := lower(NEW.market);
  v_player_prefix TEXT := '';
  v_existing INT;
  v_line NUMERIC;
  v_stat_tail TEXT;
  v_opposite TEXT;
  v_opp TEXT;
BEGIN
  -- Só aplica para verdicts ativos
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN
    RETURN NEW;
  END IF;

  -- Extrai prefixo de jogador se existir
  IF NEW.market ~ '—' THEN
    v_player_prefix := split_part(NEW.market, '—', 1) || '—%';
  END IF;

  -- 1) Over X.5 vs Under X.5 (mesma linha + mesma estatística + mesmo escopo)
  IF v_market_lower ~ '\m(over|under)\s*[0-9]+(\.[0-9]+)?' THEN
    v_line := (regexp_matches(v_market_lower, '\m(over|under)\s*([0-9]+(\.[0-9]+)?)'))[2]::numeric;
    v_stat_tail := trim(regexp_replace(v_market_lower, '.*\m(over|under)\s*[0-9]+(\.[0-9]+)?\s*', ''));
    IF v_market_lower ~ '\mover\s*[0-9]' THEN
      v_opposite := 'under ' || v_line || ' ' || v_stat_tail;
    ELSE
      v_opposite := 'over ' || v_line || ' ' || v_stat_tail;
    END IF;

    SELECT COUNT(*) INTO v_existing
    FROM public.punter_analyses
    WHERE match_id = NEW.match_id
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND lower(market) LIKE '%' || v_opposite || '%'
      AND (v_player_prefix = '' OR market LIKE v_player_prefix);

    IF v_existing > 0 THEN
      RAISE NOTICE '[anti-conflict] Bloqueado: % (oposto já existe para %)', NEW.market, NEW.match_id;
      RETURN NULL;
    END IF;
  END IF;

  -- 2) BTTS Sim vs BTTS Não
  IF v_market_lower ~ '(btts|ambas\s+marcam|both\s+teams\s+to\s+score)' THEN
    IF v_market_lower ~ '(sim|yes)' THEN
      v_opp := 'n[ãa]o|no';
    ELSE
      v_opp := 'sim|yes';
    END IF;
    SELECT COUNT(*) INTO v_existing
    FROM public.punter_analyses
    WHERE match_id = NEW.match_id
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND lower(market) ~ ('(btts|ambas|both).*(' || v_opp || ')');
    IF v_existing > 0 THEN
      RAISE NOTICE '[anti-conflict] Bloqueado BTTS oposto: %', NEW.market;
      RETURN NULL;
    END IF;
  END IF;

  -- 3) 1X2: Casa vs Fora vs Empate
  IF v_market_lower IN ('casa','fora','empate','home','away','draw') THEN
    SELECT COUNT(*) INTO v_existing
    FROM public.punter_analyses
    WHERE match_id = NEW.match_id
      AND verdict IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA')
      AND lower(market) IN ('casa','fora','empate','home','away','draw')
      AND lower(market) <> v_market_lower;
    IF v_existing > 0 THEN
      RAISE NOTICE '[anti-conflict] Bloqueado 1X2 oposto: %', NEW.market;
      RETURN NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_conflicting_punter_markets ON public.punter_analyses;
CREATE TRIGGER trg_prevent_conflicting_punter_markets
  BEFORE INSERT ON public.punter_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_conflicting_punter_markets();