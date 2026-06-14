-- Reabilita Série B na Arena Live.
-- Contexto: 20260509174903 desabilitou todos os tier B/C indiscriminadamente.
-- Série B é cobertura prioritária (Liga com jogos às 11h BRT com Betfair + SM).
-- AF retorna Série B (id=72) mas o filtro rejeitava por enabled=false no trader_leagues.

INSERT INTO public.trader_leagues (league_id, name, country, region, tier, enabled)
VALUES (72, 'Brasileirao Serie B', 'Brazil', 'BRASIL', 'A', true)
ON CONFLICT (league_id) DO UPDATE
  SET enabled = true,
      tier    = 'A',
      name    = EXCLUDED.name,
      region  = EXCLUDED.region,
      updated_at = now();
