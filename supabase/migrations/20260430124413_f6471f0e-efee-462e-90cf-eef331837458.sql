
-- Limpa qualquer regra antiga do Punter para evitar duplicidade
DELETE FROM public.mycroft_rules WHERE modo = 'punter';

-- ─── REGRAS DE VETO ───────────────────────────────────────────
INSERT INTO public.mycroft_rules (modo, name, category, field, operator, value, points, priority, mercado, active) VALUES
('punter', 'Cap odd máxima 3.0', 'veto', 'odd', '>', 3.0, NULL, 100, NULL, true),
('punter', 'Azarão (prob estimada < 35%)', 'veto', 'estimated_probability', '<', 35, NULL, 95, NULL, true);

-- ─── REGRAS DE PONTUAÇÃO (stake escalar) ──────────────────────
INSERT INTO public.mycroft_rules (modo, name, category, field, operator, value, points, priority, mercado, active) VALUES
-- Confiança da IA
('punter', 'Confiança alta (>=80)',     'pontuacao', 'confidence', '>=', 80, 20, 80, NULL, true),
('punter', 'Confiança média-alta (>=70)','pontuacao', 'confidence', '>=', 70, 12, 75, NULL, true),
('punter', 'Confiança média (>=60)',    'pontuacao', 'confidence', '>=', 60,  8, 70, NULL, true),
-- Edge / value
('punter', 'Edge forte (>=10%)',        'pontuacao', 'value_percentage', '>=', 10, 25, 65, NULL, true),
('punter', 'Edge moderado (>=5%)',      'pontuacao', 'value_percentage', '>=',  5, 15, 60, NULL, true),
-- Favoritismo (probabilidade estimada do modelo)
('punter', 'Favorito claro (prob>=55)', 'pontuacao', 'estimated_probability', '>=', 55, 10, 55, NULL, true),
('punter', 'Favorito leve (prob>=45)',  'pontuacao', 'estimated_probability', '>=', 45,  5, 50, NULL, true);

-- Ajusta config para a nova faixa de stake escalar (mantém min 2%, max 5%)
-- score_minimo_aprovar fica em 65 (precisa pelo menos confiança boa OU edge bom + favoritismo)
-- score_minimo_cuidado fica em 50

UPDATE public.mycroft_config SET value = '65' WHERE modo='punter' AND key='score_minimo_aprovar';
UPDATE public.mycroft_config SET value = '50' WHERE modo='punter' AND key='score_minimo_cuidado';
