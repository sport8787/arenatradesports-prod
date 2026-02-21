
-- =============================================
-- ARENA TRADER SEASON MODE - DATABASE SCHEMA
-- =============================================

-- 1. Scenarios table (pre-configured market scenarios)
CREATE TABLE public.arena_trader_scenarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  explanation TEXT NOT NULL,
  common_mistake TEXT,
  bankroll_multiplier_win NUMERIC NOT NULL DEFAULT 1.5,
  bankroll_multiplier_loss NUMERIC NOT NULL DEFAULT 0.7,
  difficulty TEXT NOT NULL DEFAULT 'easy' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_trader_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scenarios are publicly readable"
  ON public.arena_trader_scenarios FOR SELECT
  USING (true);

-- 2. Seasons table (player season sessions)
CREATE TABLE public.arena_trader_seasons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  season_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned', 'bankrupt')),
  current_day INTEGER NOT NULL DEFAULT 1,
  current_bankroll INTEGER NOT NULL DEFAULT 10000,
  initial_bankroll INTEGER NOT NULL DEFAULT 10000,
  total_rounds INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  jury_convinced INTEGER NOT NULL DEFAULT 0,
  offers_received INTEGER NOT NULL DEFAULT 0,
  offers_accepted INTEGER NOT NULL DEFAULT 0,
  tilt_warnings INTEGER NOT NULL DEFAULT 0,
  ignored_warnings INTEGER NOT NULL DEFAULT 0,
  all_in_moments INTEGER NOT NULL DEFAULT 0,
  loss_streak INTEGER NOT NULL DEFAULT 0,
  win_streak INTEGER NOT NULL DEFAULT 0,
  best_win_streak INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

ALTER TABLE public.arena_trader_seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own seasons"
  ON public.arena_trader_seasons FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own seasons"
  ON public.arena_trader_seasons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own seasons"
  ON public.arena_trader_seasons FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Rounds table (individual round results)
CREATE TABLE public.arena_trader_rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.arena_trader_seasons(id) ON DELETE CASCADE,
  day INTEGER NOT NULL,
  scenario_id UUID NOT NULL REFERENCES public.arena_trader_scenarios(id),
  chosen_option TEXT NOT NULL CHECK (chosen_option IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL DEFAULT false,
  transcription TEXT,
  jury_votes JSONB,
  jury_convinced_count INTEGER NOT NULL DEFAULT 0,
  bankroll_before INTEGER NOT NULL,
  bankroll_after INTEGER NOT NULL,
  mycroft_analysis JSONB,
  tilt_detected BOOLEAN NOT NULL DEFAULT false,
  time_to_choose INTEGER, -- milliseconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.arena_trader_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own rounds"
  ON public.arena_trader_rounds FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.arena_trader_seasons s
    WHERE s.id = arena_trader_rounds.session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own rounds"
  ON public.arena_trader_rounds FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.arena_trader_seasons s
    WHERE s.id = arena_trader_rounds.session_id AND s.user_id = auth.uid()
  ));

-- 4. Horus offers table (deal or no deal)
CREATE TABLE public.horus_trader_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.arena_trader_seasons(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('bankroll_doubled', 'win_streak', 'last_round', 'tilt_detected')),
  offered_bankroll INTEGER NOT NULL,
  accepted BOOLEAN,
  current_bankroll_at_offer INTEGER NOT NULL,
  day_offered INTEGER NOT NULL,
  next_round_result TEXT, -- what would have happened
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.horus_trader_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own offers"
  ON public.horus_trader_offers FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.arena_trader_seasons s
    WHERE s.id = horus_trader_offers.session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own offers"
  ON public.horus_trader_offers FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.arena_trader_seasons s
    WHERE s.id = horus_trader_offers.session_id AND s.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own offers"
  ON public.horus_trader_offers FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.arena_trader_seasons s
    WHERE s.id = horus_trader_offers.session_id AND s.user_id = auth.uid()
  ));

-- =============================================
-- SEED: 10 Educational Market Scenarios
-- =============================================

INSERT INTO public.arena_trader_scenarios (title, description, option_a, option_b, option_c, option_d, correct_option, explanation, common_mistake, bankroll_multiplier_win, bankroll_multiplier_loss, difficulty, category) VALUES

-- EASY (Days 1-10)
('ETF de Bitcoin Aprovado', 'A SEC acabou de aprovar o primeiro ETF spot de Bitcoin. O BTC sobe 8% em 30 minutos. O volume dispara 400%. Redes sociais explodem com "vai a 100k". O que você faz?', 
'Compro imediatamente com 50% da banca - é a maior notícia do ano!', 
'Espero um pullback de 3-5% para entrar com 20% da banca', 
'Abro short - "Buy the rumor, sell the news"', 
'Fico de fora e observo o volume nas próximas 4 horas',
'B', 'Após grandes notícias, o mercado costuma fazer um pullback de 3-5% antes de continuar a tendência. Entrar no FOMO máximo geralmente resulta em comprar no topo local. A estratégia correta é esperar a consolidação.', 'Comprar no FOMO sem esperar pullback', 1.4, 0.75, 'easy', 'crypto'),

('Flash Crash no Mini Índice', 'O WINFUT cai 2.000 pontos em 3 minutos sem notícia aparente. O book de ofertas fica fino. Seu stop foi acionado. O que você faz?',
'Reentro comprado imediatamente - é uma oportunidade!',
'Espero o mercado estabilizar e analiso o fluxo antes de agir',
'Abro venda a descoberto para surfar o pânico',
'Desligo a plataforma e volto amanhã',
'B', 'Flash crashes são eventos de liquidez. Operar durante um flash crash sem entender a causa é jogar roleta. A resposta correta é esperar a estabilização, analisar o fluxo institucional, e só então tomar uma decisão informada.', 'Tentar "pegar a faca caindo" sem análise', 1.3, 0.8, 'easy', 'futuros'),

('Lateralização Prolongada', 'BTC está entre 60.000 e 62.000 há 2 semanas. Volume diminuindo a cada dia. Bollinger Bands se apertando. Você tem posição neutra. O que faz?',
'Compro no suporte (60k) com stop curto a 59.500',
'Monto uma posição gradual de compra (DCA) durante a lateralização',
'Espero o rompimento com volume para definir direção',
'Abro posição em ambos os lados (straddle) para pegar o breakout',
'C', 'Quando as Bollinger Bands se apertam, indica um grande movimento próximo, mas NÃO indica a direção. A estratégia correta é esperar o rompimento confirmado com volume acima da média antes de entrar.', 'Tentar adivinhar a direção do rompimento', 1.3, 0.8, 'easy', 'crypto'),

('FOMO em Alta Parabólica', 'PETR4 sobe 15% em 3 dias após resultados trimestrais acima do esperado. Todos os influencers recomendam compra. RSI está em 85. Você não tem posição. O que faz?',
'Compro agora - os resultados justificam a alta!',
'Espero uma correção para o RSI voltar a 50-60 antes de entrar',
'Abro uma posição pequena (5% da banca) com stop apertado',
'Fico de fora - o trem já passou',
'B', 'RSI acima de 80 indica sobrecompra extrema. Mesmo com fundamentos positivos, entrar com RSI a 85 é comprar euforia. A correção técnica é inevitável. Esperar o RSI normalizar oferece uma entrada muito mais segura.', 'Comprar no topo por FOMO ignorando indicadores técnicos', 1.4, 0.7, 'easy', 'acoes'),

-- MEDIUM (Days 11-20)
('Revenge Trading Após Perda', 'Você acabou de perder 15% da banca numa operação de VALE3. Sente raiva e quer recuperar. Aparece uma oportunidade em ITUB4 com setup mediano. O que faz?',
'Entro com o dobro do tamanho normal para recuperar rápido',
'Entro com tamanho normal - a oportunidade parece boa',
'Paro de operar por hoje e reviso o que deu errado',
'Reduzo o tamanho pela metade e entro com cautela extra',
'C', 'Após uma perda significativa, o estado emocional compromete a tomada de decisão. Revenge trading é a principal causa de contas zeradas. A decisão correta é parar, analisar friamente o erro, e voltar no dia seguinte com a mente limpa.', 'Aumentar posição para "recuperar" (revenge trading clássico)', 1.5, 0.6, 'medium', 'comportamental'),

('Correlação WIN/WDO Divergente', 'O WINFUT sobe forte (+1.500 pts) mas o WDOFUT também sobe (+30 pts). Normalmente são inversamente correlacionados. O que essa divergência indica?',
'O dólar vai cair em breve - abro venda em WDOFUT',
'Algo anormal está acontecendo - reduzo exposição e observo',
'A correlação quebrou permanentemente - ignoro o WDOFUT',
'O WINFUT vai corrigir - abro venda no mini índice',
'B', 'Quando ativos normalmente correlacionados divergem, é sinal de stress no mercado ou fluxo atípico (ex: entrada massiva de capital estrangeiro). A resposta prudente é reduzir exposição até entender a causa da divergência.', 'Apostar na reversão da correlação sem entender a causa', 1.5, 0.65, 'medium', 'futuros'),

('Armadilha de Volume no BTC', 'BTC rompe resistência de 65.000 com volume 3x acima da média. Porém, nos 15 minutos seguintes, o volume despenca e o preço volta para 64.800. O que aconteceu?',
'Falso rompimento (fakeout) - os institucionais venderam no breakout',
'É normal - o preço vai testar o suporte e subir de novo',
'O volume alto confirma o rompimento - compro no reteste',
'Impossível saber - fico de fora',
'A', 'Volume alto no rompimento seguido de queda abrupta de volume é o padrão clássico de fakeout institucional. Os market makers usam o breakout para liquidar posições de varejo. Identificar este padrão evita cair na armadilha.', 'Confiar cegamente no volume sem observar a price action pós-rompimento', 1.6, 0.6, 'medium', 'crypto'),

('Zona de Milhar no Mini Índice', 'O WINFUT está a 50 pontos da zona de milhar (ex: 129.000). O fluxo mostra compradores agressivos. Você está comprado desde 128.500. O que faz?',
'Mantenho a posição - o fluxo está a meu favor!',
'Realizo parcial (50%) na zona de milhar e ajusto stop',
'Fecho tudo - zonas de milhar são resistências fortes',
'Aumento a posição para maximizar o lucro',
'B', 'Zonas de milhar no mini índice são pontos de forte liquidez onde grandes players frequentemente realizam. A estratégia ótima é realizar parcial no milhar, garantindo lucro, e deixar o restante com stop no zero a zero para capturar continuação.', 'Não realizar na zona de milhar e devolver o lucro', 1.5, 0.65, 'medium', 'futuros'),

-- HARD (Days 21-30)
('Cisne Negro: Intervenção do Banco Central', 'O Banco Central anuncia intervenção surpresa no câmbio. O dólar cai 3% em 1 hora. Você tem posição comprada em WDOFUT. O stop não foi acionado ainda mas a perda é de 8% da banca. O que faz?',
'Mantenho - o BC não pode segurar o dólar para sempre',
'Fecho imediatamente e aceito a perda de 8%',
'Aumento a posição (preço médio) para reduzir o custo',
'Abro hedge comprado no WINFUT para neutralizar',
'B', 'Contra o Banco Central não se opera. Quando uma autoridade monetária intervém, a direção do mercado muda fundamentalmente. Aceitar a perda de 8% é muito melhor do que arriscar uma perda de 20-30% lutando contra uma força irresistível.', 'Fazer preço médio contra intervenção do BC (erro fatal)', 1.8, 0.5, 'hard', 'macro'),

('Fim de Temporada: All-In ou Cash-Out?', 'É o último dia da temporada. Sua banca cresceu 80% (18.000 BC). Aparece um cenário de alta convicção com probabilidade estimada de 70% de acerto. Se acertar, termina com 27.000 BC. Se errar, termina com 12.600 BC. O que faz?',
'All-in! 70% é uma probabilidade excelente',
'Entro com metade da banca - equilíbrio entre risco e retorno',
'Cash-out - 80% de retorno já é excepcional',
'Entro com 30% da banca - preservo o lucro garantido',
'C', 'Com 80% de retorno no último dia, o valor marginal de ganhar mais é menor que a dor de perder o que foi construído. Em gestão de risco, preservar um retorno excepcional é mais racional do que arriscar por ganância. O Kelly Criterion sugere posições muito menores neste cenário.', 'Arriscar lucros consolidados por ganância no último dia', 1.8, 0.5, 'hard', 'comportamental');
