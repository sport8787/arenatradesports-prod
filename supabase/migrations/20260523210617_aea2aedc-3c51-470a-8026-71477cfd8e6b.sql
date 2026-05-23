-- =====================================================================
-- HT Markets Auto-Settlement
-- Liquida mycroft_analyses com mercados de 1º tempo (Over/Under X.5 HT,
-- BTTS HT) assim que o estado do jogo decide o mercado:
--   • Over X.5 HT  → GREEN quando total_goals >= line+1 ainda no 1T
--                    RED   quando entra no 2T/halftime sem bater linha
--   • Under X.5 HT → RED   quando total_goals >= line+1 no 1T
--                    GREEN quando entra no 2T/halftime sem bater linha
--   • BTTS Sim HT  → GREEN se ambos marcaram no 1T, RED ao entrar no 2T sem isso
--   • BTTS Não HT  → RED se ambos marcaram no 1T, GREEN ao entrar no 2T sem isso
-- Acionado por trigger AFTER UPDATE em live_matches (sempre que score/period mudam).
-- =====================================================================

CREATE OR REPLACE FUNCTION public.settle_ht_markets_for_match(
  p_match_id text,
  p_score_home int,
  p_score_away int,
  p_minute int,
  p_period text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_market_lc text;
  v_total int := COALESCE(p_score_home,0) + COALESCE(p_score_away,0);
  v_period_lc text := lower(COALESCE(p_period,''));
  v_status_lc text := lower(COALESCE(p_status,''));
  v_is_second_half boolean;
  v_line numeric;
  v_result text;
  v_reason text;
BEGIN
  v_is_second_half :=
    v_status_lc IN ('finished','ft','aet','pen','fin','ended')
    OR v_period_lc ~ '(second|2nd|2t|2º|2o\s*tempo|segundo|halftime|half_time|ht\b|intervalo|full_time|fulltime|finish|ended|after)'
    OR COALESCE(p_minute,0) >= 45;

  FOR r IN
    SELECT id, market
      FROM public.mycroft_analyses
     WHERE match_id = p_match_id
       AND result IS NULL
       AND market IS NOT NULL
       AND lower(market) ~ '(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)'
  LOOP
    v_market_lc := lower(r.market);
    v_result := NULL;
    v_reason := NULL;
    v_line := NULL;

    -- Over X.5 HT
    IF v_market_lc ~ 'over\s*\d' THEN
      v_line := COALESCE(NULLIF(regexp_replace(v_market_lc, '^.*over\s*(\d+(\.\d+)?).*$', '\1'), v_market_lc)::numeric, 0.5);
      IF v_total >= v_line + 0.5 THEN
        v_result := 'GREEN';
        v_reason := format('Over %s HT batido no 1T (%sx%s)', v_line, p_score_home, p_score_away);
      ELSIF v_is_second_half THEN
        v_result := 'RED';
        v_reason := format('Over %s HT não batido — 1T encerrado (%sx%s)', v_line, p_score_home, p_score_away);
      END IF;

    -- Under X.5 HT
    ELSIF v_market_lc ~ 'under\s*\d' THEN
      v_line := COALESCE(NULLIF(regexp_replace(v_market_lc, '^.*under\s*(\d+(\.\d+)?).*$', '\1'), v_market_lc)::numeric, 0.5);
      IF v_total >= v_line + 0.5 THEN
        v_result := 'RED';
        v_reason := format('Under %s HT perdido no 1T (%sx%s)', v_line, p_score_home, p_score_away);
      ELSIF v_is_second_half THEN
        v_result := 'GREEN';
        v_reason := format('Under %s HT mantido — 1T encerrado (%sx%s)', v_line, p_score_home, p_score_away);
      END IF;

    -- BTTS HT
    ELSIF v_market_lc ~ '(btts|ambas|both\s*teams)' THEN
      IF v_market_lc ~ '(não|nao|\bno\b)' THEN
        -- BTTS Não HT
        IF COALESCE(p_score_home,0) >= 1 AND COALESCE(p_score_away,0) >= 1 THEN
          v_result := 'RED';
          v_reason := format('BTTS Não HT perdido (%sx%s no 1T)', p_score_home, p_score_away);
        ELSIF v_is_second_half THEN
          v_result := 'GREEN';
          v_reason := format('BTTS Não HT mantido — 1T encerrado (%sx%s)', p_score_home, p_score_away);
        END IF;
      ELSE
        -- BTTS Sim HT
        IF COALESCE(p_score_home,0) >= 1 AND COALESCE(p_score_away,0) >= 1 THEN
          v_result := 'GREEN';
          v_reason := format('BTTS Sim HT batido (%sx%s no 1T)', p_score_home, p_score_away);
        ELSIF v_is_second_half THEN
          v_result := 'RED';
          v_reason := format('BTTS Sim HT não batido — 1T encerrado (%sx%s)', p_score_home, p_score_away);
        END IF;
      END IF;
    END IF;

    IF v_result IS NOT NULL THEN
      UPDATE public.mycroft_analyses
         SET result = v_result,
             settled_at = COALESCE(settled_at, now()),
             settle_reason = COALESCE(settle_reason, v_reason),
             final_score_home = COALESCE(final_score_home, p_score_home),
             final_score_away = COALESCE(final_score_away, p_score_away)
       WHERE id = r.id
         AND result IS NULL;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_settle_ht_on_live_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só roda se score, period, status ou minute mudaram (evita churn)
  IF TG_OP = 'INSERT'
     OR NEW.score_home IS DISTINCT FROM OLD.score_home
     OR NEW.score_away IS DISTINCT FROM OLD.score_away
     OR NEW.period     IS DISTINCT FROM OLD.period
     OR NEW.status     IS DISTINCT FROM OLD.status
     OR NEW.minute     IS DISTINCT FROM OLD.minute
  THEN
    PERFORM public.settle_ht_markets_for_match(
      NEW.match_id,
      COALESCE(NEW.score_home, 0),
      COALESCE(NEW.score_away, 0),
      COALESCE(NEW.minute, 0),
      NEW.period,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_live_matches_settle_ht ON public.live_matches;
CREATE TRIGGER trg_live_matches_settle_ht
AFTER INSERT OR UPDATE ON public.live_matches
FOR EACH ROW
EXECUTE FUNCTION public.trg_settle_ht_on_live_matches();

-- Backfill imediato: liquida HT pendentes com o estado atual de live_matches.
DO $$
DECLARE
  m record;
BEGIN
  FOR m IN
    SELECT DISTINCT lm.match_id, lm.score_home, lm.score_away, lm.minute, lm.period, lm.status
      FROM public.live_matches lm
     WHERE EXISTS (
       SELECT 1 FROM public.mycroft_analyses ma
        WHERE ma.match_id = lm.match_id
          AND ma.result IS NULL
          AND lower(ma.market) ~ '(ht|1t|1[ºo]?\s*tempo|primeiro\s*tempo|first\s*half)'
     )
  LOOP
    PERFORM public.settle_ht_markets_for_match(
      m.match_id,
      COALESCE(m.score_home,0),
      COALESCE(m.score_away,0),
      COALESCE(m.minute,0),
      m.period,
      m.status
    );
  END LOOP;
END $$;