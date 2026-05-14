CREATE OR REPLACE FUNCTION public.calc_signal_pnl(_result TEXT, _odd NUMERIC, _stake NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE UPPER(COALESCE(_result, ''))
    WHEN 'GREEN' THEN round((_stake * (COALESCE(NULLIF(_odd, 0), 1.70) - 1))::numeric, 2)
    WHEN 'RED' THEN round((-_stake)::numeric, 2)
    WHEN 'HALF_GREEN' THEN round(((_stake * (COALESCE(NULLIF(_odd, 0), 1.70) - 1)) / 2)::numeric, 2)
    WHEN 'HALF_RED' THEN round((-_stake / 2)::numeric, 2)
    ELSE 0
  END
$$;

CREATE OR REPLACE FUNCTION public.settle_signal(
  _market_key TEXT, _gh INT, _ga INT,
  _htgh INT, _htga INT,
  _odd NUMERIC, _stake NUMERIC
) RETURNS TABLE(result TEXT, profit_loss NUMERIC)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  total INT; ht_total INT; sec_total INT;
  k TEXT; line NUMERIC; lhs TEXT;
  win_pl NUMERIC; lose_pl NUMERIC;
  is_win BOOLEAN := NULL;
  effective_odd NUMERIC;
BEGIN
  IF _market_key IS NULL OR _gh IS NULL OR _ga IS NULL THEN RETURN; END IF;
  total := _gh + _ga;
  ht_total := COALESCE(_htgh,0) + COALESCE(_htga,0);
  sec_total := total - ht_total;
  k := _market_key;
  effective_odd := COALESCE(NULLIF(_odd, 0), 1.70);
  win_pl := round((_stake * (effective_odd - 1))::numeric, 2);
  lose_pl := round((-_stake)::numeric, 2);

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
  ELSIF k='BTTS_YES' THEN is_win := _gh > 0 AND _ga > 0;
  ELSIF k='BTTS_NO' THEN is_win := NOT (_gh > 0 AND _ga > 0);
  ELSIF k='DRAW' THEN is_win := _gh = _ga;
  ELSIF k='WIN_HOME' THEN is_win := _gh > _ga;
  ELSIF k='WIN_AWAY' THEN is_win := _ga > _gh;
  ELSIF k='WIN_HOME_2H' THEN
    IF _htgh IS NULL OR _htga IS NULL THEN RETURN; END IF;
    is_win := (_gh - _htgh) > (_ga - _htga);
  ELSIF k='WIN_AWAY_2H' THEN
    IF _htgh IS NULL OR _htga IS NULL THEN RETURN; END IF;
    is_win := (_ga - _htga) > (_gh - _htgh);
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
    line := split_part(k, '_', 4)::NUMERIC;
    is_win := _gh > line;
  ELSIF k LIKE 'TEAM\_AWAY\_OVER\_%' THEN
    line := split_part(k, '_', 4)::NUMERIC;
    is_win := _ga > line;
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
  IF is_win THEN
    result := 'GREEN';
    profit_loss := win_pl;
  ELSE
    result := 'RED';
    profit_loss := lose_pl;
  END IF;

  RETURN NEXT;
END $$;

UPDATE public.live_sinais
SET profit_loss = public.calc_signal_pnl(result, odd, stake)
WHERE result IN ('GREEN', 'RED', 'HALF_GREEN', 'HALF_RED')
  AND (odd IS NULL OR odd = 0 OR profit_loss IS DISTINCT FROM public.calc_signal_pnl(result, odd, stake));