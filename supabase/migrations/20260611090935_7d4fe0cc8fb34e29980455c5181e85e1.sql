-- Copa 2026: ajuste de config (ve_min.grupos 7→5, ah_odd_range min 1.65→1.40 max 2.30→4.50)
-- e inserção de odds reais para México vs África do Sul (fixture_id=1489369)

UPDATE public.punter_gate_config
SET copa_config = jsonb_set(
  jsonb_set(
    jsonb_set(
      copa_config,
      '{ve_min,grupos}',
      '5'
    ),
    '{ah_odd_range,min}',
    '1.40'
  ),
  '{ah_odd_range,max}',
  '4.50'
)
WHERE copa_config IS NOT NULL;

-- Odds reais AH para México vs África do Sul (Copa 2026 Grupos — fixture 1489369)
INSERT INTO public.ah_odds_snapshot (fixture_id, payload, captured_at)
VALUES (
  '1489369',
  '{"home": {"-1": 2.25, "-2": 4.20}, "away": {"1": 2.75, "2": 1.57}}'::jsonb,
  NOW()
)
ON CONFLICT DO NOTHING;

-- Corrige labels trocados na league_id_map (nomes AF73/75 estavam invertidos)
UPDATE public.league_id_map SET name = 'Copa do Brasil'      WHERE api_football_id = 73;
UPDATE public.league_id_map SET name = 'Brasileirao Serie C' WHERE api_football_id = 75;
