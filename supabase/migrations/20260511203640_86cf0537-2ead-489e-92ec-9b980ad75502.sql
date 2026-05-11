
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.live_sinais ADD COLUMN IF NOT EXISTS market_key TEXT;

-- Helper de normalização sem depender de unaccent (caso schema)
CREATE OR REPLACE FUNCTION public.norm_market_text(_t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(translate(coalesce(_t,''),
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));
$$;

CREATE OR REPLACE FUNCTION public.classify_market(_market TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  m TEXT; line NUMERIC; mline TEXT;
BEGIN
  IF _market IS NULL THEN RETURN NULL; END IF;
  m := public.norm_market_text(_market);

  IF m ~ 'monitor' THEN RETURN NULL; END IF;
  IF m ~ '\m(cartao|cartoes|escanteio|corner|chute|posse)\M' THEN RETURN NULL; END IF;
  IF m ~ 'proximo gol|next goal|primeiro a marcar|first.*goal' THEN RETURN NULL; END IF;
  IF m ~ 'restante|remaining' THEN RETURN NULL; END IF;
  IF m ~ ' e ambas| e btts|& btts|combinad' THEN RETURN NULL; END IF;
  IF m ~ '^\s*gols totais\s*$' THEN RETURN NULL; END IF;

  mline := substring(m from '(\d+(?:[\.,]\d+)?)');
  IF mline IS NOT NULL THEN line := replace(mline, ',', '.')::NUMERIC; END IF;

  IF m ~ '\m(ht|primeiro tempo|first half|1h)\M' THEN
    IF line IS NOT NULL AND line - floor(line) = 0.5 THEN
      IF m ~ 'over|mais de|acima' THEN RETURN 'OVER_'||line||'_HT'; END IF;
      IF m ~ 'under|menos de|abaixo' THEN RETURN 'UNDER_'||line||'_HT'; END IF;
    END IF;
    RETURN NULL;
  END IF;

  IF m ~ 'segundo tempo|2.\s*tempo|2t|second half' THEN
    IF line IS NOT NULL AND line - floor(line) = 0.5 THEN
      IF m ~ 'over|mais de|acima' THEN RETURN 'OVER_'||line||'_2H'; END IF;
      IF m ~ 'under|menos de|abaixo' THEN RETURN 'UNDER_'||line||'_2H'; END IF;
    END IF;
    IF m ~ 'vencer.*2|2.*vencer' THEN
      IF m ~ '\mcasa\M|\mhome\M|\mmandante\M' THEN RETURN 'WIN_HOME_2H'; END IF;
      IF m ~ '\mfora\M|\maway\M|\mvisitante\M' THEN RETURN 'WIN_AWAY_2H'; END IF;
      RETURN NULL;
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
    IF m ~ '\mcasa\M|\mhome\M|\mmandante\M' THEN RETURN 'CS_HOME'; END IF;
    IF m ~ '\mfora\M|\maway\M|\mvisitante\M' THEN RETURN 'CS_AWAY'; END IF;
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
      IF m ~ '\mfora\M|\maway\M|\mvisitante\M' THEN RETURN 'AH_AWAY_'||hc;
      ELSE RETURN 'AH_HOME_'||hc; END IF;
    END;
  END IF;

  IF line IS NOT NULL AND line - floor(line) = 0.5 AND m ~ '(mais de|acima|over)' THEN
    IF m ~ '\mcasa\M|\mhome\M|\mmandante\M' THEN RETURN 'TEAM_HOME_OVER_'||line; END IF;
    IF m ~ '\mfora\M|\maway\M|\mvisitante\M' THEN RETURN 'TEAM_AWAY_OVER_'||line; END IF;
    RETURN 'OVER_'||line||'_FT';
  END IF;

  IF line IS NOT NULL AND line - floor(line) = 0.5 AND m ~ '(menos de|abaixo|under)' THEN
    RETURN 'UNDER_'||line||'_FT';
  END IF;

  IF m ~ 'resultado final|match odds|vencer|vitoria|\mback\M|para vencer' THEN
    IF m ~ '\mempate\M|\mdraw\M' THEN RETURN 'DRAW'; END IF;
    IF m ~ '\mcasa\M|\mhome\M|\mmandante\M' THEN RETURN 'WIN_HOME'; END IF;
    IF m ~ '\mfora\M|\maway\M|\mvisitante\M' THEN RETURN 'WIN_AWAY'; END IF;
    RETURN NULL;
  END IF;

  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.settle_signal(
  _market_key TEXT, _gh INT, _ga INT,
  _htgh INT, _htga INT,
  _odd NUMERIC, _stake NUMERIC
) RETURNS TABLE(result TEXT, profit_loss NUMERIC)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  total INT; ht_total INT; sec_total INT;
  k TEXT; line NUMERIC; lhs TEXT;
  win_pl NUMERIC; lose_pl NUMERIC;
  is_win BOOLEAN := NULL;
BEGIN
  IF _market_key IS NULL OR _gh IS NULL OR _ga IS NULL THEN RETURN; END IF;
  total := _gh + _ga;
  ht_total := COALESCE(_htgh,0) + COALESCE(_htga,0);
  sec_total := total - ht_total;
  k := _market_key;
  win_pl := round((_stake * (COALESCE(_odd,0) - 1))::numeric, 2);
  lose_pl := -_stake;

  IF k LIKE 'OVER\_%' OR k LIKE 'UNDER\_%' THEN
    line := split_part(k, '_', 2)::NUMERIC;
    lhs := split_part(k, '_', 3);
    DECLARE ref INT;
    BEGIN
      IF lhs='FT' THEN ref := total;
      ELSIF lhs='HT' THEN
        IF _htgh IS NULL OR _htga IS NULL THEN RETURN; END IF;
        ref := ht_total;
      ELSE
        IF _htgh IS NULL OR _htga IS NULL THEN RETURN; END IF;
        ref := sec_total;
      END IF;
      IF k LIKE 'OVER%' THEN is_win := ref > line;
      ELSE is_win := ref < line; END IF;
    END;
  ELSIF k='BTTS_YES' THEN is_win := _gh>0 AND _ga>0;
  ELSIF k='BTTS_NO'  THEN is_win := NOT(_gh>0 AND _ga>0);
  ELSIF k='DRAW'     THEN is_win := _gh = _ga;
  ELSIF k='WIN_HOME' THEN is_win := _gh > _ga;
  ELSIF k='WIN_AWAY' THEN is_win := _ga > _gh;
  ELSIF k='WIN_HOME_2H' THEN
    IF _htgh IS NULL OR _htga IS NULL THEN RETURN; END IF;
    is_win := (_gh-_htgh) > (_ga-_htga);
  ELSIF k='WIN_AWAY_2H' THEN
    IF _htgh IS NULL OR _htga IS NULL THEN RETURN; END IF;
    is_win := (_ga-_htga) > (_gh-_htgh);
  ELSIF k='CS_HOME' THEN is_win := _ga = 0;
  ELSIF k='CS_AWAY' THEN is_win := _gh = 0;
  ELSIF k LIKE 'CS\_%' AND k <> 'CS_HOME' AND k <> 'CS_AWAY' THEN
    DECLARE cx INT; cy INT;
    BEGIN
      cx := split_part(k, '_', 2)::INT;
      cy := split_part(k, '_', 3)::INT;
      is_win := (_gh = cx AND _ga = cy);
    END;
  ELSIF k LIKE 'TEAM\_HOME\_OVER\_%' THEN
    line := split_part(k, '_', 4)::NUMERIC; is_win := _gh > line;
  ELSIF k LIKE 'TEAM\_AWAY\_OVER\_%' THEN
    line := split_part(k, '_', 4)::NUMERIC; is_win := _ga > line;
  ELSIF k LIKE 'AH\_HOME\_%' THEN
    DECLARE hc NUMERIC; adj NUMERIC;
    BEGIN
      hc := split_part(k, '_', 3)::NUMERIC;
      adj := _gh + hc - _ga;
      IF adj > 0 THEN is_win := TRUE;
      ELSIF adj < 0 THEN is_win := FALSE;
      ELSE result := 'VOID'; profit_loss := 0; RETURN NEXT; RETURN; END IF;
    END;
  ELSIF k LIKE 'AH\_AWAY\_%' THEN
    DECLARE hc NUMERIC; adj NUMERIC;
    BEGIN
      hc := split_part(k, '_', 3)::NUMERIC;
      adj := _ga + hc - _gh;
      IF adj > 0 THEN is_win := TRUE;
      ELSIF adj < 0 THEN is_win := FALSE;
      ELSE result := 'VOID'; profit_loss := 0; RETURN NEXT; RETURN; END IF;
    END;
  ELSE
    RETURN;
  END IF;

  IF is_win IS NULL THEN RETURN; END IF;
  IF is_win THEN result := 'GREEN'; profit_loss := win_pl;
  ELSE result := 'RED'; profit_loss := lose_pl; END IF;
  RETURN NEXT;
END $$;

CREATE OR REPLACE FUNCTION public.tg_sync_live_sinais()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_home TEXT; v_away TEXT; v_champ TEXT; v_pnl NUMERIC; v_match_date TIMESTAMPTZ;
  v_result TEXT; v_key TEXT; v_settled RECORD;
BEGIN
  IF NEW.verdict NOT IN ('APROVADO','APROVADO_SITUACIONAL','LABAREDA') THEN RETURN NEW; END IF;
  v_key := public.classify_market(NEW.market);
  IF v_key IS NULL THEN RETURN NEW; END IF;

  SELECT lm.home_team, lm.away_team, lm.championship
    INTO v_home, v_away, v_champ
  FROM public.live_matches lm WHERE lm.match_id = NEW.match_id LIMIT 1;

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

DELETE FROM public.live_sinais WHERE result IS NULL;
UPDATE public.live_sinais SET market_key = public.classify_market(market) WHERE market_key IS NULL;
DELETE FROM public.live_sinais WHERE market_key IS NULL;

ALTER TABLE public.live_sinais DROP CONSTRAINT IF EXISTS live_sinais_match_id_market_key;
ALTER TABLE public.live_sinais DROP CONSTRAINT IF EXISTS live_sinais_match_market_unique;
DROP INDEX IF EXISTS live_sinais_match_market_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS live_sinais_match_marketkey_uidx
  ON public.live_sinais(match_id, market_key);
