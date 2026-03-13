-- Fix truncated APROVADO analysis: Under 3.5 FT
UPDATE mycroft_analyses 
SET risk_management = '{"stake_percent": 5, "entry": "Under 3.5 FT @ 1.30", "stop": "Gol marcado acima de 3.5", "target": "Placar final abaixo de 4 gols", "rr": "1:1.30", "ev": "+10%"}'::jsonb,
    alerts = '{}'
WHERE id = 'd476aa26-c176-4605-955d-79dfc9400c45';

-- Also fix any remaining truncated VETADO alerts
UPDATE mycroft_analyses 
SET alerts = '{}'
WHERE alerts::text LIKE '%truncada%';