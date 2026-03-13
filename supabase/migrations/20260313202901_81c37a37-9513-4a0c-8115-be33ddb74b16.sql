-- Fix truncated analysis 1: Lask Linz Under 0.5 FT
UPDATE mycroft_analyses 
SET odd = 1.25,
    risk_management = '{"stake_percent": 5, "entry": "Under 0.5 FT @ 1.25", "stop": "Gol marcado", "target": "Sem gols até o apito final", "rr": "1:1.25", "ev": "+15%"}'::jsonb,
    thesis = 'O jogo se encontra no minuto 88'' com placar 0x0, indicando que a estratégia CACHORRO LOUCO está prestes a ser ativada na janela de 89-92 minutos. Apesar da dominância do Lask Linz em estatísticas ofensivas, a ineficácia na conversão (3 chutes no gol de 22) e o xG de apenas 1.0 sugerem que um gol é improvável nos últimos minutos.',
    alerts = '{}'
WHERE id = '39d8daec-bc10-4dd0-8856-1813d6c78f43';

-- Fix truncated analysis 2: Montpellier Back Casa
UPDATE mycroft_analyses 
SET odd = 1.90,
    risk_management = '{"stake_percent": 5, "entry": "Back Casa (Full Time) @ 1.90", "stop": "Gol do Laval", "target": "Vitória do Montpellier", "rr": "1:1.90", "ev": "+20%"}'::jsonb,
    thesis = 'Identificada assimetria clara em favor do Montpellier no primeiro tempo (45min, 0-0). A dominância em ataques, chutes e a ineficácia ofensiva do Laval (0 chutes no gol) sugerem alta probabilidade de gol do favorito na segunda etapa, conforme o princípio de ASSIMETRIA de estratégias validadas no mercado.',
    alerts = '{}'
WHERE id = '8f4387ae-42ed-4cfb-a1c8-6965396fc638';

-- Fix Ricardo Santos mentions in all analyses
UPDATE mycroft_analyses 
SET thesis = REPLACE(thesis, 'Ricardo Santos', 'estratégias validadas no mercado')
WHERE thesis LIKE '%Ricardo Santos%';

UPDATE mycroft_analyses 
SET risk_management = REPLACE(risk_management::text, 'Ricardo Santos', 'estratégias validadas no mercado')::jsonb
WHERE risk_management::text LIKE '%Ricardo Santos%';