
-- Remove the conflicting Over 1.5 signal and analysis for Deportivo Riestra vs San Lorenzo
DELETE FROM public.punter_signals WHERE match_id = 'Deportivo_Riestra_San_Lorenzo_2026-03-25T22:00:00Z' AND market = 'Over 1.5';
DELETE FROM public.punter_analyses WHERE match_id = 'Deportivo_Riestra_San_Lorenzo_2026-03-25T22:00:00Z' AND market = 'Over 1.5';
