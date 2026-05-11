
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

  IF m ~ 'monitor' THEN RETURN NULL; END IF;
  IF m ~ '\m(cartao|cartoes|escanteio|corner|chute|posse)\M' THEN RETURN NULL; END IF;
  IF m ~ 'proximo gol|next goal|primeiro a marcar|first.*goal' THEN RETURN NULL; END IF;
  IF m ~ 'restante|remaining' THEN RETURN NULL; END IF;
  IF m ~ ' e ambas| e btts|& btts|combinad' THEN RETURN NULL; END IF;
  IF m ~ '^\s*gols totais\s*$' THEN RETURN NULL; END IF;

  -- PRIORIDADE: nome do time vence literal "casa/fora"
  IF length(nh) > 2 AND position(nh in m) > 0 THEN side := 'HOME'; END IF;
  IF side IS NULL AND length(na) > 2 AND position(na in m) > 0 THEN side := 'AWAY'; END IF;
  IF side IS NULL THEN
    DECLARE w TEXT;
    BEGIN
      w := split_part(nh,' ',1);
      IF length(w) >= 4 AND position(w in m) > 0 THEN side := 'HOME'; END IF;
      IF side IS NULL THEN
        w := split_part(na,' ',1);
        IF length(w) >= 4 AND position(w in m) > 0 THEN side := 'AWAY'; END IF;
      END IF;
    END;
  END IF;
  IF side IS NULL AND (m ~ '\mcasa\M|\mhome\M|\mmandante\M') THEN side := 'HOME'; END IF;
  IF side IS NULL AND (m ~ '\mfora\M|\maway\M|\mvisitante\M') THEN side := 'AWAY'; END IF;

  mline := substring(m from '(\d+(?:[\.,]\d+)?)');
  IF mline IS NOT NULL THEN line := replace(mline, ',', '.')::NUMERIC; END IF;

  IF m ~ '\m(ht|primeiro tempo|first half|1h)\M' THEN
    IF line IS NOT NULL AND line - floor(line) = 0.5 THEN
      IF m ~ 'over|mais de|acima' AND side IS NULL THEN RETURN 'OVER_'||line||'_HT'; END IF;
      IF m ~ 'under|menos de|abaixo' AND side IS NULL THEN RETURN 'UNDER_'||line||'_HT'; END IF;
    END IF;
    RETURN NULL;
  END IF;

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

  IF m ~ 'ambas marcam|btts|ambos marcam|ambas as equipes marcam' THEN
    IF m ~ '\m(nao|no)\M' THEN RETURN 'BTTS_NO'; END IF;
    IF m ~ '\m(sim|yes)\M' THEN RETURN 'BTTS_YES'; END IF;
    RETURN NULL;
  END IF;

  IF m ~ '^\s*empate\s*$|\mdraw\M' THEN RETURN 'DRAW'; END IF;

  IF m ~ 'placar exato|resultado exato|exact score|correct score' THEN
    DECLARE pair TEXT; mr TEXT[];
    BEGIN
      pair := substring(m from '(\d+\s*[x\-:]\s*\d+)');
      IF pair IS NULL THEN RETURN NULL; END IF;
      mr := regexp_matches(m, '(\d+)\s*[x\-:]\s*(\d+)');
      RETURN 'CS_'||mr[1]||'_'||mr[2];
    END;
  END IF;

  IF m ~ 'clean sheet' THEN
    IF side='HOME' THEN RETURN 'CS_HOME'; END IF;
    IF side='AWAY' THEN RETURN 'CS_AWAY'; END IF;
    RETURN NULL;
  END IF;

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

  IF line IS NOT NULL AND line - floor(line) = 0.5 AND m ~ '(mais de|acima|over)' THEN
    IF side='HOME' THEN RETURN 'TEAM_HOME_OVER_'||line; END IF;
    IF side='AWAY' THEN RETURN 'TEAM_AWAY_OVER_'||line; END IF;
    RETURN 'OVER_'||line||'_FT';
  END IF;

  IF line IS NOT NULL AND line - floor(line) = 0.5 AND m ~ '(menos de|abaixo|under)' AND side IS NULL THEN
    RETURN 'UNDER_'||line||'_FT';
  END IF;

  IF m ~ 'resultado final|match odds|vencer|vitoria|\mback\M|para vencer' THEN
    IF m ~ '\mempate\M|\mdraw\M' THEN RETURN 'DRAW'; END IF;
    IF side='HOME' THEN RETURN 'WIN_HOME'; END IF;
    IF side='AWAY' THEN RETURN 'WIN_AWAY'; END IF;
    RETURN NULL;
  END IF;

  RETURN NULL;
END $$;
