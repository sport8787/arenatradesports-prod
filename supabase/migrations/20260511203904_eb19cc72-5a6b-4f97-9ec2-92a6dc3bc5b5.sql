
CREATE OR REPLACE FUNCTION public.classify_market(_market TEXT, _home TEXT DEFAULT NULL, _away TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  m TEXT; line NUMERIC; mline TEXT;
  nh TEXT; na TEXT; side TEXT := NULL;
BEGIN
  IF _market IS NULL THEN RETURN NULL; END IF;
  m := public.norm_market_text(_market);
  nh := public.norm_market_text(coalesce(_home,''));
  na := public.norm_market_text(coalesce(_away,''));

  -- Ruído
  IF m ~ 'monitor' THEN RETURN NULL; END IF;
  IF m ~ '\m(cartao|cartoes|escanteio|corner|chute|posse)\M' THEN RETURN NULL; END IF;
  IF m ~ 'proximo gol|next goal|primeiro a marcar|first.*goal' THEN RETURN NULL; END IF;
  IF m ~ 'restante|remaining' THEN RETURN NULL; END IF;
  IF m ~ ' e ambas| e btts|& btts|combinad' THEN RETURN NULL; END IF;
  IF m ~ '^\s*gols totais\s*$' THEN RETURN NULL; END IF;

  -- Detecta lado (casa/fora ou nome do time)
  IF m ~ '\mcasa\M|\mhome\M|\mmandante\M' THEN side := 'HOME'; END IF;
  IF side IS NULL AND (m ~ '\mfora\M|\maway\M|\mvisitante\M') THEN side := 'AWAY'; END IF;
  IF side IS NULL AND length(nh) > 2 AND position(nh in m) > 0 THEN side := 'HOME'; END IF;
  IF side IS NULL AND length(na) > 2 AND position(na in m) > 0 THEN side := 'AWAY'; END IF;
  -- tenta primeira palavra do nome do time (>=4 chars)
  IF side IS NULL AND nh <> '' THEN
    DECLARE w TEXT;
    BEGIN
      w := split_part(nh,' ',1);
      IF length(w) >= 4 AND position(w in m) > 0 THEN side := 'HOME'; END IF;
    END;
  END IF;
  IF side IS NULL AND na <> '' THEN
    DECLARE w TEXT;
    BEGIN
      w := split_part(na,' ',1);
      IF length(w) >= 4 AND position(w in m) > 0 THEN side := 'AWAY'; END IF;
    END;
  END IF;

  -- Linha (.5)
  mline := substring(m from '(\d+(?:[\.,]\d+)?)');
  IF mline IS NOT NULL THEN line := replace(mline, ',', '.')::NUMERIC; END IF;

  -- HT (1º tempo) — apenas Over/Under puro
  IF m ~ '\m(ht|primeiro tempo|first half|1h)\M' THEN
    IF line IS NOT NULL AND line - floor(line) = 0.5 THEN
      IF m ~ 'over|mais de|acima' AND side IS NULL THEN RETURN 'OVER_'||line||'_HT'; END IF;
      IF m ~ 'under|menos de|abaixo' AND side IS NULL THEN RETURN 'UNDER_'||line||'_HT'; END IF;
    END IF;
    RETURN NULL;
  END IF;

  -- 2º tempo
  IF m ~ 'segundo tempo|2.\s*tempo|2t|second half' THEN
    IF line IS NOT NULL AND line - floor(line) = 0.5 AND side IS NULL THEN
      IF m ~ 'over|mais de|acima' THEN RETURN 'OVER_'||line||'_2H'; END IF;
      IF m ~ 'under|menos de|abaixo' THEN RETURN 'UNDER_'||line||'_2H'; END IF;
    END IF;
    IF (m ~ 'vencer' OR m ~ 'marcar') AND side IS NOT NULL THEN
      IF side='HOME' THEN RETURN 'WIN_HOME_2H'; ELSE RETURN 'WIN_AWAY_2H'; END IF;
    END IF;
    RETURN NULL;
  END IF;

  -- BTTS
  IF m ~ 'ambas marcam|btts|ambos marcam|ambas as equipes marcam' THEN
    IF m ~ '\m(nao|no)\M' THEN RETURN 'BTTS_NO'; END IF;
    IF m ~ '\m(sim|yes)\M' THEN RETURN 'BTTS_YES'; END IF;
    RETURN NULL;
  END IF;

  -- Empate
  IF m ~ '^\s*empate\s*$|\mdraw\M' THEN RETURN 'DRAW'; END IF;

  -- Placar Exato
  IF m ~ 'placar exato|resultado exato|exact score|correct score' THEN
    DECLARE pair TEXT; mr TEXT[];
    BEGIN
      pair := substring(m from '(\d+\s*[x\-:]\s*\d+)');
      IF pair IS NULL THEN RETURN NULL; END IF;
      mr := regexp_matches(m, '(\d+)\s*[x\-:]\s*(\d+)');
      RETURN 'CS_'||mr[1]||'_'||mr[2];
    END;
  END IF;

  -- Clean Sheet
  IF m ~ 'clean sheet' THEN
    IF side='HOME' THEN RETURN 'CS_HOME'; END IF;
    IF side='AWAY' THEN RETURN 'CS_AWAY'; END IF;
    RETURN NULL;
  END IF;

  -- Handicap Asiático
  IF m ~ 'handicap' THEN
    DECLARE hc NUMERIC; nm TEXT;
    BEGIN
      nm := substring(m from 'handicap[^-+0-9]*([+-]?\d+(?:[\.,]\d+)?)');
      IF nm IS NULL THEN nm := substring(m from '([+-]?\d+(?:[\.,]\d+)?)\s*handicap'); END IF;
      IF nm IS NULL THEN RETURN NULL; END IF;
      hc := replace(nm, ',', '.')::NUMERIC;
      IF (hc - floor(hc)) <> 0.5 AND (hc - ceil(hc)) <> -0.5 THEN RETURN NULL; END IF;
      IF side='AWAY' THEN RETURN 'AH_AWAY_'||hc; ELSE RETURN 'AH_HOME_'||hc; END IF;
    END;
  END IF;

  -- Team Total Goals (ex.: "Bologna para Marcar Mais de 2.5", "Time X Total Gols Acima de 1.5")
  IF line IS NOT NULL AND line - floor(line) = 0.5 AND m ~ '(mais de|acima|over)' THEN
    IF side='HOME' THEN RETURN 'TEAM_HOME_OVER_'||line; END IF;
    IF side='AWAY' THEN RETURN 'TEAM_AWAY_OVER_'||line; END IF;
    -- Sem lado identificado → total da partida
    RETURN 'OVER_'||line||'_FT';
  END IF;

  IF line IS NOT NULL AND line - floor(line) = 0.5 AND m ~ '(menos de|abaixo|under)' AND side IS NULL THEN
    RETURN 'UNDER_'||line||'_FT';
  END IF;

  -- Resultado Final / Match Odds / Vencer
  IF m ~ 'resultado final|match odds|vencer|vitoria|\mback\M|para vencer' THEN
    IF m ~ '\mempate\M|\mdraw\M' THEN RETURN 'DRAW'; END IF;
    IF side='HOME' THEN RETURN 'WIN_HOME'; END IF;
    IF side='AWAY' THEN RETURN 'WIN_AWAY'; END IF;
    RETURN NULL;
  END IF;

  RETURN NULL;
END $$;

-- Trigger usa a v2 com home/away
CREATE OR REPLACE FUNCTION public.tg_sync_live_sinais()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_home TEXT; v_away TEXT; v_champ TEXT; v_pnl NUMERIC; v_match_date TIMESTAMPTZ;
  v_result TEXT; v_key TEXT; v_settled RECORD;
BEGIN
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN NEW; END IF;

  SELECT lm.home_team, lm.away_team, lm.championship
    INTO v_home, v_away, v_champ
  FROM public.live_matches lm WHERE lm.match_id = NEW.match_id LIMIT 1;

  v_key := public.classify_market(NEW.market, v_home, v_away);
  IF v_key IS NULL THEN RETURN NEW; END IF;

  v_match_date := COALESCE(NEW.approved_at_timestamp, NEW.created_at);
  v_result := NULL; v_pnl := NULL;
  IF NEW.final_score_home IS NOT NULL AND NEW.final_score_away IS NOT NULL THEN
    SELECT s.result, s.profit_loss INTO v_settled
    FROM public.settle_signal(v_key, NEW.final_score_home, NEW.final_score_away, NULL, NULL,
                              COALESCE(NEW.odd,0), 5.0) s;
    v_result := v_settled.result; v_pnl := v_settled.profit_loss;
  END IF;

  INSERT INTO public.live_sinais (
    analysis_id, match_id, home_team, away_team, championship,
    market, market_key, odd, stake, confidence, verdict,
    approved_at_minute, approved_at_period, approved_at_score, match_date,
    result, goals_home, goals_away, profit_loss, settled_at
  ) VALUES (
    NEW.id, NEW.match_id, v_home, v_away, v_champ,
    NEW.market, v_key, NEW.odd, 5.0, NEW.confidence, NEW.verdict,
    NEW.approved_at_minute, NEW.approved_at_period,
    CASE WHEN NEW.approved_at_score_home IS NOT NULL
         THEN NEW.approved_at_score_home || '-' || NEW.approved_at_score_away END,
    v_match_date,
    v_result, NEW.final_score_home, NEW.final_score_away, v_pnl,
    CASE WHEN v_result IS NOT NULL THEN now() END
  )
  ON CONFLICT (match_id, market_key) DO UPDATE SET
    analysis_id = EXCLUDED.analysis_id,
    market = EXCLUDED.market,
    verdict = EXCLUDED.verdict,
    odd = COALESCE(EXCLUDED.odd, live_sinais.odd),
    confidence = EXCLUDED.confidence,
    result = COALESCE(EXCLUDED.result, live_sinais.result),
    goals_home = COALESCE(EXCLUDED.goals_home, live_sinais.goals_home),
    goals_away = COALESCE(EXCLUDED.goals_away, live_sinais.goals_away),
    profit_loss = COALESCE(EXCLUDED.profit_loss, live_sinais.profit_loss),
    settled_at = COALESCE(EXCLUDED.settled_at, live_sinais.settled_at);
  RETURN NEW;
END $$;
