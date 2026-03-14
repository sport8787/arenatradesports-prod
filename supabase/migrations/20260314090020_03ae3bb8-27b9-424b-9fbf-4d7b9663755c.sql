
-- Tabela de planos estratégicos
CREATE TABLE IF NOT EXISTS public.mycroft_planos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  emoji TEXT,
  categoria TEXT NOT NULL,
  mercado TEXT NOT NULL,
  janela TEXT NOT NULL,
  risco TEXT NOT NULL,
  conceito TEXT,
  execucao TEXT,
  observacao TEXT,
  criterios JSONB NOT NULL DEFAULT '[]',
  vetos JSONB NOT NULL DEFAULT '[]',
  ativo BOOLEAN DEFAULT TRUE,
  versao INT DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para atualizar timestamp e versão
CREATE OR REPLACE FUNCTION public.update_planos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  NEW.versao = OLD.versao + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = 'public';

CREATE TRIGGER planos_updated
  BEFORE UPDATE ON public.mycroft_planos
  FOR EACH ROW EXECUTE FUNCTION public.update_planos_timestamp();

-- RLS
ALTER TABLE public.mycroft_planos ENABLE ROW LEVEL SECURITY;

-- Leitura pública (planos são referência do sistema)
CREATE POLICY "Anyone can read active plans" ON public.mycroft_planos
  FOR SELECT USING (true);

-- Inserir os 10 planos iniciais
INSERT INTO public.mycroft_planos 
  (codigo, nome, emoji, categoria, mercado, janela, risco, conceito, execucao, observacao, criterios, vetos)
VALUES
('LABAREDA', 'Plano Labareda', '🔥', 'TRADER', 
  'Gol Próximos Minutos / Over 0.5 restantes',
  '82'' - 89''', 'ALTO',
  'Time domina amplamente mas não converte. Janela final 85-92 minutos. O mercado ainda não precificou a pressão acumulada.',
  'Back no dominante ou Over 0.5 gols restantes via Exchange',
  'Alta volatilidade. Funciona melhor em ligas com ritmo elevado (Premier, Bundesliga, Brasileirão A).',
  '["Placar: 0x0 ou 1x0 para qualquer lado","Minuto: entre 82 e 89","Ataques perigosos do dominante: >= 15","Chutes ao gol: >= 3 sem conversão","xG acumulado do dominante: >= 0.8","Posse de bola: >= 55%"]',
  '["Placar 2-0 ou mais — não é Labareda","Minuto fora da janela 82-89 — não é Labareda"]'
),
('ECLIPSE', 'Plano Eclipse', '🌑', 'PUNTER',
  'Resultado Final / Vencer o 2º Tempo',
  'Intervalo (45''-50'')', 'MÉDIO',
  'Time dominante no 1T com xG elevado mas sem conversão. Mercado subestima probabilidade de gol na 2ª etapa.',
  'Back no favorito no intervalo — odd tende a subir após empate no 1T',
  'Assimetria: quando xG não converte no 1T, pressão tende a se materializar no 2T.',
  '["Minuto: 45-50 (intervalo apenas)","Placar: 0x0 ou 1x0","xG dominante 1T: >= 1.2 vs <= 0.3 do adversário","Chutes dominante: >= 4 vs <= 1 adversário","Odd do dominante pré-jogo: <= 2.20","Edge vs Pinnacle: >= 4% na odd da vitória"]',
  '["Jogo fora do intervalo — não é Eclipse","Ambos os times com xG similar — não é Eclipse"]'
),
('DILUVIO', 'Plano Dilúvio', '🌊', 'AMBOS',
  'Over 2.5 / Over 3.5 / Ambas Marcam',
  'Pré-jogo ou até 30''', 'MÉDIO',
  'Partida com pressão bilateral intensa e xG combinado elevado. Mercado de gols está subprecificado.',
  'Back Over 2.5 gols pré-jogo ou Over 0.5 ao vivo no 1T',
  'Mais eficaz em ligas abertas. Verificar H2H — times que jogam juntos tendem a repetir padrão.',
  '["xG combinado dos dois times: >= 2.5","Ataques perigosos totais: >= 25","AMBOS os times com chutes ao gol: >= 3","Odd Over 2.5: >= 1.80","Edge vs Pinnacle: >= 4% no mercado Over"]',
  '["Apenas um time atacando — não é Dilúvio, verificar Avalanche","Copa eliminatória — evitar"]'
),
('ARMADILHA', 'Plano Armadilha', '🪤', 'TRADER',
  'Lay Casa (Exchange)',
  'Pré-jogo', 'ALTO',
  'Favorito absoluto enfrenta visitante organizado e compacto. Mercado superestima probabilidade do mandante.',
  'Lay do favorito na Betfair Exchange com responsabilidade calculada',
  'NUNCA usar em mata-mata onde favorito joga por sobrevivência.',
  '["Odd do favorito na Exchange: <= 1.50","Visitante: <= 1.0 gol sofrido/jogo","H2H: visitante não perdeu por > 1 gol nos últimos 3","xG visitante esperado: >= 0.5","Edge no Lay: >= 3% vs Pinnacle","Janela: pré-jogo apenas"]',
  '["Jogo mata-mata ou favorito joga por título — não é Armadilha","Sem acesso à Exchange — não é Armadilha"]'
),
('INVASAO', 'Plano Invasão', '⚔️', 'PUNTER',
  'Resultado Final — Fora',
  'Pré-jogo', 'MÉDIO',
  'Visitante estatisticamente superior com odd inflada por viés de mandante. Valor real está no back do time de fora.',
  'Back Visitante nas casas com maior edge (Superbet > Betano > Bet365)',
  'Viés de mandante é sistemático. Times visitantes de qualidade são cronicamente subprecificados.',
  '["xG médio visitante: >= 30% superior ao mandante","Mandante: <= 2 vitórias em casa nos últimos 5","Odd do visitante: >= 2.20","Edge vs Pinnacle: >= 5% na odd do visitante","Confiança Mycroft: >= 68%","Janela: pré-jogo apenas"]',
  '["Odd visitante < 2.20 — não é Invasão","Jogo fora do pré-jogo — não é Invasão"]'
),
('BUNKER', 'Plano Bunker', '🛡️', 'PUNTER',
  'Under 2.5 / Under 1.5',
  'Pré-jogo', 'BAIXO-MÉDIO',
  'Confronto entre times de perfil defensivo. xG combinado historicamente baixo. Under está com valor.',
  'Back Under 2.5 pré-jogo',
  'Verificar se algum time precisa de vitória (pode abrir o jogo). Confrontos de rival tendem a ser fechados.',
  '["Média de gols combinada: <= 2.0 por jogo","xG médio combinado: <= 1.8","H2H últimos 5: <= 2 gols em pelo menos 3 jogos","Odd Under 2.5: >= 1.70","Edge vs Pinnacle: >= 4% no Under","Janela: pré-jogo apenas"]',
  '["Algum time precisa desesperadamente de vitória — não é Bunker","Jogo fora do pré-jogo — não é Bunker"]'
),
('RESSURREICAO', 'Plano Ressurreição', '⚡', 'TRADER',
  'Resultado Final / Asian Handicap',
  'Até 5 minutos após gol sofrido', 'ALTO',
  'Time favorito leva gol inesperado e passa a buscar empate/virada. Odd sobe por pânico. Momento de entrar a favor da reação.',
  'Back no favorito imediatamente após a queda de odds (janela de 2-5 minutos)',
  'Requer atenção constante. Configurar alerta para favoritos que levam gol nos primeiros 35 minutos.',
  '["Favorito com odd pré-jogo <= 1.80 leva gol","Minuto do gol sofrido: entre 1 e 35","Odd do favorito sobe para >= 2.50 após o gol","Favorito mantém domínio estatístico após o gol","Placar: 0x1 ou 1x2 (déficit de apenas 1 gol)","Entrada: até 5 minutos após o gol"]',
  '["Gol sofrido após 35 minutos — não é Ressurreição","Favorito perde domínio estatístico após gol — não é Ressurreição","Déficit de 2 ou mais gols — não é Ressurreição"]'
),
('FANTASMA', 'Plano Fantasma', '👻', 'TRADER',
  'Lay Vencedor / Back Empate ou Virada',
  '60'' - 75''', 'MÉDIO',
  'Time que dominou o 1T some completamente no 2T. Pressão cai, xG cai, mercado ainda precifica como dominante.',
  'Lay no vencedor em andamento ou Back no adversário',
  'Comum em times que constroem vantagem e recuam. Verificar se adversário tem jogadores ofensivos no banco.',
  '["Time A dominou 1T: xG 1T >= 1.0","Minuto atual: entre 60 e 75","xG do Time A no 2T: <= 0.2","Ataques perigosos 2T: <= 3 vs >= 8 no 1T","Posse no 2T caiu >= 15pp vs 1T","Placar: Time A vencendo por apenas 1 gol"]',
  '["Time A ainda dominando no 2T — não é Fantasma","Time A vencendo por 2 ou mais — não é Fantasma","Fora da janela 60-75 minutos — não é Fantasma"]'
),
('AVALANCHE', 'Plano Avalanche', '❄️', 'TRADER',
  'Próximo Gol / Over 0.5 Restantes',
  '40'' - 50'' ou 75'' - 85''', 'MÉDIO',
  'Pressão do time vai aumentando progressivamente a cada 15 minutos. Padrão de acúmulo que antecede gol estatisticamente.',
  'Back no time em crescimento ou Over próximos gols',
  'Mais confiável quando adversário não tem capacidade de contra-ataque.',
  '["Ataques perigosos crescendo por período: 0-15 <= 3, 15-30 <= 6, 30-45 >= 9","Volume de chutes crescente em cada período","xG acumulado >= 1.5 SEM GOL (placar obrigatoriamente 0x0)","Adversário sem capacidade de contra (posse baixa)","Minuto >= 40 ou >= 75"]',
  '["Já existe gol no placar — não é Avalanche","Pressão não crescente, estável ou caindo — não é Avalanche","Placar diferente de 0x0 — não é Avalanche"]'
),
('TSUNAMI', 'Plano Tsunami', '🌊', 'TRADER',
  'Ambas Marcam / Over 2.5 ao vivo',
  'Até 10 minutos após gol sofrido entre 50''-75''', 'ALTO',
  'Após levar gol, time inteiro sobe. Momento de caos tático que cria oportunidade em Over ou Ambas Marcam ao vivo.',
  'Back Ambas Marcam ao vivo ou Over 2.5 se já com 1 gol',
  'Efeito Tsunami dura 10-15 minutos. Se empate não vem até 85, time tende a abrir defensivamente.',
  '["Time competitivo leva gol entre 50 e 75 minutos","Resposta imediata: >= 4 ataques nos 5 minutos seguintes ao gol","Técnico faz substituição ofensiva em até 5 minutos do gol","Odd Ambas Marcam ao vivo: >= 1.85","Placar: 0x1 ou 1x2","Entrada: até 10 minutos após o gol"]',
  '["Sem substituição ofensiva do técnico — não é Tsunami","Time não reage nos primeiros 5 minutos — não é Tsunami","Gol sofrido fora da janela 50-75 — não é Tsunami"]'
);
