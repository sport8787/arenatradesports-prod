
INSERT INTO public.league_id_map (api_football_id, sportmonks_id, name, enabled)
VALUES (671, 1798, 'Supercopa do Brasil', true)
ON CONFLICT (api_football_id) DO UPDATE SET sportmonks_id = EXCLUDED.sportmonks_id, enabled = true;

UPDATE public.trader_leagues
SET enabled = false
WHERE league_id IN (76, 77, 624, 628);
