-- Reabilita Série B e Série C na Arena Live.
-- Causa: 20260509174903 desabilitou todos tier B/C em massa.
-- Série B (72) e Série C (75) têm cobertura Sportmonks + API-Football.
-- Nota: api_football_id=75 = Série C (corrigido em 20260611090935).

INSERT INTO public.trader_leagues (league_id, name, country, region, tier, enabled)
VALUES
  (72, 'Brasileirao Serie B', 'Brazil', 'BRASIL', 'A', true),
  (75, 'Brasileirao Serie C', 'Brazil', 'BRASIL', 'B', true)
ON CONFLICT (league_id) DO UPDATE
  SET enabled    = true,
      name       = EXCLUDED.name,
      region     = EXCLUDED.region,
      updated_at = now();
