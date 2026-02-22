export interface TrainingScenario {
  id: number;
  difficulty: number;
  match: string;
  competition: string;
  minute: number;
  score: string;
  stats: {
    attacks_home: number;
    attacks_away: number;
    xG_home: number;
    xG_away: number;
    possession_home: number;
  };
  market: string;
  odd: number;
  horusQuote: string;
  correctDecision: 'ENTRO' | 'AGUARDO' | 'NAO_ENTRO';
  outcome: {
    happened: string;
    result: string;
  };
  mycroftFeedback: {
    correct: string;
    wrong: string;
  };
  rewards: {
    correct: number;
    wrong: number;
    loseLife: boolean;
  };
}

export const trainingScenarios: TrainingScenario[] = [
  {
    id: 1,
    difficulty: 2,
    match: "Real Madrid vs Barcelona",
    competition: "Copa do Rei 2024",
    minute: 28,
    score: "0-0",
    stats: { attacks_home: 8, attacks_away: 2, xG_home: 1.3, xG_away: 0.4, possession_home: 58 },
    market: "Over 0.5 HT",
    odd: 1.88,
    horusQuote: "Real tá pressionando forte. Odd tá caindo. Vai entrar AGORA ou esperar virar 1.50? A coragem custa.",
    correctDecision: "ENTRO",
    outcome: { happened: "Gol saiu no minuto 35' (Benzema)", result: "GREEN +88%" },
    mycroftFeedback: {
      correct: "Você identificou o padrão correto. Real Madrid estava com xG > 1.0 e atacando intensamente. Odd @ 1.88 tinha value. No jogo real, gol saiu no minuto 35' (Benzema). Resultado: GREEN +88%.",
      wrong: "Você perdeu uma entrada com +EV. Real Madrid tinha TODOS os sinais:\n• xG > 1.0 ✅\n• Ataques perigosos > 5 ✅\n• Odd com value ✅\n\nNo jogo real, gol saiu no minuto 35' (Benzema). Você deixou lucro na mesa por MEDO.\n\nMark Douglas: 'Medo é inimigo do lucro.'"
    },
    rewards: { correct: 300, wrong: -100, loseLife: true },
  },
  {
    id: 2,
    difficulty: 3,
    match: "Flamengo vs Palmeiras",
    competition: "Brasileirão 2025",
    minute: 15,
    score: "0-0",
    stats: { attacks_home: 2, attacks_away: 1, xG_home: 0.3, xG_away: 0.2, possession_home: 52 },
    market: "Over 0.5 HT",
    odd: 2.20,
    horusQuote: "Jogo morno. Mas a odd tá alta... Vai arriscar ou esperar o jogo esquentar?",
    correctDecision: "AGUARDO",
    outcome: { happened: "Nenhum gol no 1º tempo", result: "Aguardar foi correto" },
    mycroftFeedback: {
      correct: "Disciplina! Jogo estava frio (xG < 0.5). Não havia padrão de pressão. Aguardar era a decisão certa. A odd alta era armadilha.",
      wrong: "Você entrou por EMOÇÃO, não por matemática. xG baixíssimo (0.3) indicava jogo frio. Nenhum time estava pressionando. Resultado: Nenhum gol no 1º tempo."
    },
    rewards: { correct: 250, wrong: -200, loseLife: true },
  },
  {
    id: 3,
    difficulty: 1,
    match: "Manchester City vs Burnley",
    competition: "Premier League 2024",
    minute: 22,
    score: "1-0",
    stats: { attacks_home: 12, attacks_away: 0, xG_home: 2.1, xG_away: 0.0, possession_home: 75 },
    market: "Over 1.5 HT",
    odd: 1.65,
    horusQuote: "City MASSACRANDO. xG acima de 2 com 20 minutos. Isso é uma máquina de gols. Vai ou não vai?",
    correctDecision: "ENTRO",
    outcome: { happened: "City marcou 2-0 aos 31' (Haaland)", result: "GREEN +65%" },
    mycroftFeedback: {
      correct: "Entrada textbook. xG > 2.0 com apenas 22 minutos jogados. City dominava completamente. Padrão 'Rolo Compressor' identificado corretamente.",
      wrong: "Erro de leitura grave. xG de 2.1 aos 22 minutos é sinal CLARÍSSIMO. City já tinha 12 ataques perigosos e Burnley ZERO. Esse era o cenário mais óbvio possível."
    },
    rewards: { correct: 200, wrong: -150, loseLife: true },
  },
  {
    id: 4,
    difficulty: 4,
    match: "Atlético Madrid vs Real Sociedad",
    competition: "La Liga 2024",
    minute: 40,
    score: "0-0",
    stats: { attacks_home: 4, attacks_away: 5, xG_home: 0.6, xG_away: 0.7, possession_home: 48 },
    market: "Under 0.5 HT",
    odd: 1.45,
    horusQuote: "0-0 faltando 5 minutos pro intervalo. Jogo equilibrado. Odd curta no Under. Entra ou é armadilha?",
    correctDecision: "NAO_ENTRO",
    outcome: { happened: "Gol aos 43' (Griezmann). Under perdeu.", result: "Não entrar foi correto" },
    mycroftFeedback: {
      correct: "Excelente leitura! Odd @ 1.45 não compensava o risco com 5 minutos restantes. Griezmann marcou aos 43'. Quem entrou no Under perdeu.",
      wrong: "Odd @ 1.45 para 5 minutos de jogo parece 'seguro', mas o risco/retorno era péssimo. Griezmann marcou aos 43'. Lição: Odds curtas perto do intervalo = armadilha."
    },
    rewards: { correct: 400, wrong: -250, loseLife: false },
  },
  {
    id: 5,
    difficulty: 2,
    match: "Brasil vs Colômbia",
    competition: "Copa América 2024",
    minute: 55,
    score: "0-1",
    stats: { attacks_home: 6, attacks_away: 3, xG_home: 0.9, xG_away: 0.4, possession_home: 63 },
    market: "Brasil Empatar (Draw)",
    odd: 2.10,
    horusQuote: "Brasil atrás no placar. Tá pressionando mas falta gol. Time forte atrás costuma empatar. Aposta no empate?",
    correctDecision: "ENTRO",
    outcome: { happened: "Brasil empatou 1-1 aos 62' (Vini Jr)", result: "GREEN +110%" },
    mycroftFeedback: {
      correct: "Padrão 'Favorito Atrás'. Brasil com xG de 0.9 e 63% de posse pressiona naturalmente. Historicamente, 68% dos favoritos atrás no 2º tempo empatam. Vini Jr marcou aos 62'.",
      wrong: "Você ignorou o padrão 'Favorito Atrás'. Brasil dominava com xG 0.9 e posse alta. Estatisticamente, 68% dos favoritos empatam nessa situação. Vini Jr marcou aos 62'."
    },
    rewards: { correct: 350, wrong: -150, loseLife: true },
  },
  {
    id: 6,
    difficulty: 5,
    match: "Liverpool vs Napoli",
    competition: "Champions League 2024",
    minute: 70,
    score: "2-2",
    stats: { attacks_home: 5, attacks_away: 4, xG_home: 1.8, xG_away: 1.9, possession_home: 51 },
    market: "Over 4.5 Goals",
    odd: 3.50,
    horusQuote: "JOGO ABERTO! 2-2 e ambos atacando. Odd 3.50 no Over 4.5. Alto risco, alto retorno. Coragem ou loucura?",
    correctDecision: "AGUARDO",
    outcome: { happened: "Jogo terminou 2-2. Nenhum gol nos últimos 20 min.", result: "Aguardar foi correto" },
    mycroftFeedback: {
      correct: "Controle emocional! Jogo aberto NÃO significa mais gols. Após 70', times costumam recuar. xG já estava distribuído. Odd @ 3.50 era atrativa mas sem fundamento estatístico.",
      wrong: "Caiu na armadilha do 'jogo aberto'. Após os 70', a intensidade cai. O xG já estava 'gasto'. Odd alta não significa value. Precisa de padrão, não de emoção."
    },
    rewards: { correct: 500, wrong: -300, loseLife: true },
  },
  {
    id: 7,
    difficulty: 1,
    match: "Bayern Munich vs Darmstadt",
    competition: "Bundesliga 2024",
    minute: 10,
    score: "0-0",
    stats: { attacks_home: 5, attacks_away: 0, xG_home: 0.8, xG_away: 0.0, possession_home: 72 },
    market: "Bayern Vencer 1º Tempo",
    odd: 1.55,
    horusQuote: "Bayern com 72% de posse contra o LANTERNA. É questão de tempo. Odd @ 1.55. Moleza ou cilada?",
    correctDecision: "ENTRO",
    outcome: { happened: "Bayern abriu 1-0 aos 18' (Musiala)", result: "GREEN +55%" },
    mycroftFeedback: {
      correct: "Cenário clássico: Favorito gigante vs lanterna. Bayern com domínio absoluto. xG 0.8 em 10 minutos. Musiala marcou aos 18'. Entry segura.",
      wrong: "Cenário de alta probabilidade ignorado. Bayern dominava com 72% de posse e xG 0.8 em apenas 10 minutos. Darmstadt era lanterna. Musiala marcou aos 18'."
    },
    rewards: { correct: 200, wrong: -100, loseLife: false },
  },
  {
    id: 8,
    difficulty: 3,
    match: "Argentina vs Uruguai",
    competition: "Eliminatórias 2026",
    minute: 35,
    score: "1-0",
    stats: { attacks_home: 6, attacks_away: 4, xG_home: 1.1, xG_away: 0.8, possession_home: 55 },
    market: "Both Teams To Score (BTTS)",
    odd: 2.00,
    horusQuote: "Uruguai tá vivo no jogo. xG quase 1.0 já. Eles SEMPRE marcam contra Argentina. BTTS @ 2.00. Paga ou não paga?",
    correctDecision: "ENTRO",
    outcome: { happened: "Uruguai empatou aos 52' (Núñez). BTTS pagou.", result: "GREEN +100%" },
    mycroftFeedback: {
      correct: "Leitura perfeita do histórico! Uruguai tinha xG de 0.8 e 4 ataques perigosos. Historicamente, marcam em 73% dos jogos contra Argentina. Núñez empatou aos 52'.",
      wrong: "Ignorou dados históricos. Uruguai marca em 73% dos jogos contra Argentina. xG de 0.8 confirmava a tendência. Núñez empatou aos 52'. BTTS @ 2.00 era value puro."
    },
    rewards: { correct: 350, wrong: -150, loseLife: true },
  },
  {
    id: 9,
    difficulty: 4,
    match: "PSG vs Monaco",
    competition: "Ligue 1 2024",
    minute: 80,
    score: "3-1",
    stats: { attacks_home: 3, attacks_away: 2, xG_home: 0.4, xG_away: 0.3, possession_home: 45 },
    market: "Over 4.5 Goals",
    odd: 2.80,
    horusQuote: "3-1 com 10 minutos restantes. Mais um gol paga Over 4.5. Mas o jogo tá morrendo. O que você faz?",
    correctDecision: "NAO_ENTRO",
    outcome: { happened: "Jogo terminou 3-1. Sem gols nos 10 min finais.", result: "Não entrar foi correto" },
    mycroftFeedback: {
      correct: "Disciplina nos minutos finais! xG dos últimos 10 min era 0.4 + 0.3 = 0.7. Probabilidade real de +1 gol era baixa. Jogo já estava decidido, intensidade caiu.",
      wrong: "Entrou baseado no placar, não nos dados. xG combinado dos últimos 10min era apenas 0.7. Jogo decidido = menos intensidade. Não confunda jogo alto com jogo vivo."
    },
    rewards: { correct: 400, wrong: -200, loseLife: false },
  },
  {
    id: 10,
    difficulty: 5,
    match: "Boca Juniors vs River Plate",
    competition: "Copa Libertadores 2024",
    minute: 45,
    score: "1-1",
    stats: { attacks_home: 7, attacks_away: 6, xG_home: 1.4, xG_away: 1.2, possession_home: 50 },
    market: "Over 2.5 Goals",
    odd: 2.40,
    horusQuote: "SUPERCLÁSSICO empatado no intervalo. Ambos com xG alto. 2º tempo costuma ser FOGO. Over 2.5 @ 2.40. Último cenário. O que você decide?",
    correctDecision: "ENTRO",
    outcome: { happened: "Boca 2-1 River (gol aos 67'). Over 2.5 pagou!", result: "GREEN +140%" },
    mycroftFeedback: {
      correct: "Final perfeito! Superclássico com xG combinado de 2.6 no 1º tempo. Historicamente, 81% dos Superclássicos com >2.0 xG no 1ºT passam de 2.5 gols. Boca marcou aos 67'.",
      wrong: "Último cenário e você vacilou. xG combinado de 2.6 no 1º tempo. Superclássico = intensidade máxima no 2º tempo. 81% passam de 2.5 gols nessa situação. Boca 2-1 River aos 67'."
    },
    rewards: { correct: 500, wrong: -300, loseLife: true },
  },
];
