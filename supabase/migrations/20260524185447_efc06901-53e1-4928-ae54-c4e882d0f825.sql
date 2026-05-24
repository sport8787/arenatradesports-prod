
-- Novas colunas opcionais
ALTER TABLE public.mycroft_planos
  ADD COLUMN IF NOT EXISTS contexto TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS prioridade INTEGER DEFAULT 0;

-- Insert dos 7 planos da Copa (idempotente via ON CONFLICT)
INSERT INTO public.mycroft_planos
  (codigo, nome, categoria, mercado, janela, risco, conceito, execucao, criterios, vetos, observacao, ativo, contexto, prioridade)
VALUES
('NEYMAR', 'Plano NEYMAR', 'ATAQUE',
 'Over 0.5 HT, Over 1.5, Over 2.5, Over 3.5, Over 0.5 Próximo Gol', '0-90', 'MÉDIO-ALTO',
 'Plano ofensivo, apostando em gols. Neymar é o craque que decide jogos com gols e assistências.',
 'Identificar jogos com alto potencial de gols (xG combinado alto, ataques perigosos, defesas fracas).',
 '["xG combinado >= 1.8","Ataques perigosos >= 20","Finalizações no alvo >= 5"]'::jsonb,
 '["Defesas muito sólidas (clean sheet > 50%)","Jogo truncado e sem chances"]'::jsonb,
 'Plano para momentos de ataque e muitos gols.', true, ARRAY['copa'], 60),

('VINI_JR', 'Plano VINI JR', 'VELOCIDADE',
 'Over 0.5 HT, Over 1.5 HT', '0-45', 'MÉDIO',
 'Plano para gols rápidos no primeiro tempo. Vini Jr é velocidade e explosão.',
 'Entrar em Over HT quando um time domina e pressiona desde o início.',
 '["Posse >= 55% nos primeiros 15 min","Finalizações no alvo >= 3 nos primeiros 20 min","xG >= 0.6"]'::jsonb,
 '["Jogo muito estudado, sem ritmo","Time favorito com odd muito baixa (<1.40)"]'::jsonb,
 'Velocidade para definir o jogo antes do intervalo.', true, ARRAY['copa'], 55),

('ENDRICK', 'Plano ENDRICK', 'REVELAÇÃO',
 'Back Zebra, Lay Favorito', '15-70', 'ALTO',
 'Plano para surpresas (zebra). Endrick é a jovem promessa que pode mudar o jogo.',
 'Apostar contra o favorito quando as estatísticas mostram que ele não está dominando.',
 '["Time zebra com posse >= 45%","Favorito com xG baixo (<0.4)","Zebra com >= 2 chances claras"]'::jsonb,
 '["Zebra com expulsão","Favorito já vencendo por 2 gols"]'::jsonb,
 'Revelação e ousadia para apostar no improvável.', true, ARRAY['copa'], 50),

('CASEMIRO', 'Plano CASEMIRO', 'DEFESA',
 'Under 2.5, Under 1.5, BTTS Não', '0-90', 'MÉDIO-BAIXO',
 'Plano defensivo, apostando em jogos de poucos gols. Casemiro é a contenção e a marcação.',
 'Under ou BTTS Não quando o jogo está travado, com poucas finalizações e xG baixo.',
 '["Ataques perigosos totais <= 12","xG combinado <= 1.0","Defesas sólidas (clean sheet > 50% para um dos times)"]'::jsonb,
 '["Time já está vencendo por 2 gols","Time perdendo e pressionando muito"]'::jsonb,
 'Segurança e poucos gols, como um bom volante de contenção.', true, ARRAY['copa'], 65),

('MARQUINHOS', 'Plano MARQUINHOS', 'SOLIDEZ',
 'BTTS Não', '0-90', 'MÉDIO',
 'Plano de solidez defensiva, focando em times que não sofrem gols. Marquinhos é a segurança da zaga.',
 'Apostar que pelo menos um time não marcará gol, com base em defesa forte e ataque fraco do adversário.',
 '["Um time tem clean sheet rate >= 60%","O outro time tem média de gols marcados <= 0.7","xG adversário <= 0.4"]'::jsonb,
 '["Ambos os times marcam em mais de 60% dos jogos","Jogo eliminatório com pressão por gols"]'::jsonb,
 'Solidez e poucas falhas defensivas.', true, ARRAY['copa'], 58),

('ANCELOTTI', 'Plano ANCELOTTI', 'ESTRATÉGIA',
 'BTTS Sim', '0-90', 'MÉDIO',
 'Plano para jogos abertos, onde ambos os times têm capacidade ofensiva. Ancelotti é o estrategista que equilibra ataque e defesa.',
 'BTTS Sim quando ambos times atacam e as defesas são vulneráveis.',
 '["Ambos times marcam em >= 55% dos jogos","Média de gols sofridos de cada time >= 1.0","xG combinado >= 1.8"]'::jsonb,
 '["Jogo muito truncado","Time muito favorito com defesa sólida"]'::jsonb,
 'Estratégia para jogos equilibrados e com chances para ambos.', true, ARRAY['copa'], 54),

('HEXA', 'Plano HEXA', 'TÍTULO',
 'Back Favorito, Próximo Gol', '20-80', 'BAIXO-MÉDIO',
 'Plano para momentos de domínio claro, apostando na vitória do favorito ou no gol iminente. HEXA representa a busca pelo título.',
 'Back no favorito quando ele domina mas ainda não vence; próximo gol quando a pressão é alta.',
 '["Posse >= 60%","Ataques perigosos >= 15","xG >= 0.7","Placar 0-0 ou 1-0"]'::jsonb,
 '["Time favorito com expulsão","Jogo já decidido (diferença >= 2 gols)"]'::jsonb,
 'A confiança de quem vai vencer.', true, ARRAY['copa'], 62)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  categoria = EXCLUDED.categoria,
  mercado = EXCLUDED.mercado,
  janela = EXCLUDED.janela,
  risco = EXCLUDED.risco,
  conceito = EXCLUDED.conceito,
  execucao = EXCLUDED.execucao,
  criterios = EXCLUDED.criterios,
  vetos = EXCLUDED.vetos,
  observacao = EXCLUDED.observacao,
  ativo = EXCLUDED.ativo,
  contexto = EXCLUDED.contexto,
  prioridade = EXCLUDED.prioridade,
  atualizado_em = now();
