-- Sudamericana faltava no registry; habilita Nordeste/Verde para o plano-favorito-prelive
INSERT INTO public.trader_leagues (league_id, name, country, region, tier, enabled)
VALUES (11, 'Copa Sudamericana', 'South America', 'SUL_AMERICA', 'A', true)
ON CONFLICT (league_id) DO UPDATE SET enabled = true, tier = 'A', region = 'SUL_AMERICA';

UPDATE public.trader_leagues SET enabled = true, tier = 'A' WHERE league_id IN (624, 628);