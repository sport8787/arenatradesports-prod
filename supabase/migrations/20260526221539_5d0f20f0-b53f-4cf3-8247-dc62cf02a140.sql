
INSERT INTO public.league_id_map (api_football_id, sportmonks_id, name, enabled)
VALUES (11, 1116, 'Copa Sudamericana', true)
ON CONFLICT (api_football_id) DO UPDATE SET sportmonks_id = EXCLUDED.sportmonks_id, name = EXCLUDED.name, enabled = true;

INSERT INTO public.trader_leagues (league_id, name, country, region, tier, enabled, odds_sport_key)
VALUES (11, 'Copa Sudamericana', 'World', 'SUL_AMERICA', 'A', true, 'soccer_conmebol_copa_sudamericana')
ON CONFLICT (league_id) DO UPDATE SET name = EXCLUDED.name, enabled = true, tier = 'A', region = 'SUL_AMERICA';

DELETE FROM public.live_matches
WHERE match_id = '35635103'
  AND EXISTS (SELECT 1 FROM public.live_matches WHERE match_id = 'sm_19693447');
