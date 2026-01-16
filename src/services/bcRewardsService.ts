/**
 * BC (BluffCoins) Rewards Service
 * Sistema centralizado de recompensas conforme tabela oficial
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TABELA DE RECOMPENSAS BC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const BC_REWARDS = {
  // BASE - COMPLETAR PARTIDA: 60 BC (sempre ao final)
  COMPLETE_GAME: 60,
  
  // PERGUNTAS - ACERTO: 6 BC por pergunta correta (máx 10 = 60 BC)
  CORRECT_ANSWER: 6,
  MAX_CORRECT_ANSWERS_REWARDED: 10, // Máximo de 10 perguntas recompensadas
  
  // BLEFE PERFEITO: 120 BC (errou mas convenceu TODOS 3 desafiantes)
  PERFECT_BLUFF: 120,
  
  // BLEFE BOM: 60 BC (errou mas convenceu 2 desafiantes)
  GOOD_BLUFF: 60,
  
  // ACORDO HÓRUS: 180 BC (usou Hórus E venceu a rodada)
  HORUS_DEAL_WIN: 180,
  
  // CARTA IMUNIDADE: 150 BC (conquistar - blefe perfeito 3/3)
  IMMUNITY_CARD_UNLOCK: 150,
  
  // MALETA MISTERIOSA: 50-500 BC aleatório (vencer rodada 14)
  MYSTERY_BRIEFCASE_MIN: 50,
  MYSTERY_BRIEFCASE_MAX: 500,
  MYSTERY_BRIEFCASE_ROUND: 14,
  
  // VITÓRIA FINAL: 1000 BC (completar rodada 15)
  FINAL_VICTORY: 1000,
  
  // STREAK DIÁRIO: 20 BC por dia consecutivo (máx 7 dias = 140 BC)
  DAILY_STREAK: 20,
  MAX_DAILY_STREAK_DAYS: 7,
  
  // DESAFIANTE CERTEIRO: 30 BC (5+ votos corretos em 10 rodadas)
  CHALLENGER_ACCURACY: 30,
  CHALLENGER_MIN_CORRECT_VOTES: 5,
} as const;

// Carta Porto Seguro: valor aumenta com a rodada (máx 100 BC na rodada 10)
export const getSafeHarborCardReward = (round: number): number => {
  // Escala linear: rodada 1 = 10 BC, rodada 10 = 100 BC
  const maxRound = 10;
  const minReward = 10;
  const maxReward = 100;
  
  const clampedRound = Math.min(round, maxRound);
  return Math.round(minReward + ((maxReward - minReward) * (clampedRound - 1)) / (maxRound - 1));
};

// Maleta Misteriosa: valor aleatório entre 50-500 BC
export const generateMysteryBriefcaseReward = (): number => {
  return Math.floor(Math.random() * (BC_REWARDS.MYSTERY_BRIEFCASE_MAX - BC_REWARDS.MYSTERY_BRIEFCASE_MIN + 1)) + BC_REWARDS.MYSTERY_BRIEFCASE_MIN;
};

// Interface para rastrear recompensas durante a partida
export interface GameRewardsTracker {
  correctAnswers: number;        // Contador de respostas corretas
  perfectBluffs: number;         // Blefes perfeitos (3/3)
  goodBluffs: number;            // Blefes bons (2/3)
  horusDealWins: number;         // Vitórias com acordo Hórus
  safeHarborUnlocked: boolean;   // Carta Porto Seguro desbloqueada
  safeHarborRound: number;       // Rodada em que desbloqueou
  immunityUnlocked: boolean;     // Carta Imunidade desbloqueada
  mysteryBriefcaseOpened: boolean; // Maleta misteriosa aberta
  mysteryBriefcaseValue: number;   // Valor da maleta
  completedGame: boolean;        // Completou a partida
  wonFinalRound: boolean;        // Venceu rodada 15 (modo extremo)
  challengerCorrectVotes: number; // Votos corretos do desafiante (para modo multiplayer)
}

// Cria um rastreador de recompensas limpo
export const createRewardsTracker = (): GameRewardsTracker => ({
  correctAnswers: 0,
  perfectBluffs: 0,
  goodBluffs: 0,
  horusDealWins: 0,
  safeHarborUnlocked: false,
  safeHarborRound: 0,
  immunityUnlocked: false,
  mysteryBriefcaseOpened: false,
  mysteryBriefcaseValue: 0,
  completedGame: false,
  wonFinalRound: false,
  challengerCorrectVotes: 0,
});

// Calcula o total de BC acumulados baseado no tracker
export const calculateTotalRewards = (tracker: GameRewardsTracker): number => {
  let total = 0;
  
  // Base - Completar partida
  if (tracker.completedGame) {
    total += BC_REWARDS.COMPLETE_GAME;
  }
  
  // Perguntas corretas (máx 10)
  const correctAnswersRewarded = Math.min(tracker.correctAnswers, BC_REWARDS.MAX_CORRECT_ANSWERS_REWARDED);
  total += correctAnswersRewarded * BC_REWARDS.CORRECT_ANSWER;
  
  // Blefes perfeitos
  total += tracker.perfectBluffs * BC_REWARDS.PERFECT_BLUFF;
  
  // Blefes bons
  total += tracker.goodBluffs * BC_REWARDS.GOOD_BLUFF;
  
  // Acordo Hórus + vitória
  total += tracker.horusDealWins * BC_REWARDS.HORUS_DEAL_WIN;
  
  // Carta Porto Seguro
  if (tracker.safeHarborUnlocked) {
    total += getSafeHarborCardReward(tracker.safeHarborRound);
  }
  
  // Carta Imunidade
  if (tracker.immunityUnlocked) {
    total += BC_REWARDS.IMMUNITY_CARD_UNLOCK;
  }
  
  // Maleta Misteriosa
  if (tracker.mysteryBriefcaseOpened) {
    total += tracker.mysteryBriefcaseValue;
  }
  
  // Vitória Final (rodada 15)
  if (tracker.wonFinalRound) {
    total += BC_REWARDS.FINAL_VICTORY;
  }
  
  // Desafiante Certeiro (5+ votos corretos)
  if (tracker.challengerCorrectVotes >= BC_REWARDS.CHALLENGER_MIN_CORRECT_VOTES) {
    total += BC_REWARDS.CHALLENGER_ACCURACY;
  }
  
  return total;
};

// Gera um breakdown detalhado das recompensas
export const getRewardsBreakdown = (tracker: GameRewardsTracker): { label: string; amount: number }[] => {
  const breakdown: { label: string; amount: number }[] = [];
  
  // Base - Completar partida
  if (tracker.completedGame) {
    breakdown.push({ label: 'Partida Completa', amount: BC_REWARDS.COMPLETE_GAME });
  }
  
  // Perguntas corretas
  const correctAnswersRewarded = Math.min(tracker.correctAnswers, BC_REWARDS.MAX_CORRECT_ANSWERS_REWARDED);
  if (correctAnswersRewarded > 0) {
    breakdown.push({ 
      label: `${correctAnswersRewarded} Resposta${correctAnswersRewarded > 1 ? 's' : ''} Correta${correctAnswersRewarded > 1 ? 's' : ''}`, 
      amount: correctAnswersRewarded * BC_REWARDS.CORRECT_ANSWER 
    });
  }
  
  // Blefes perfeitos
  if (tracker.perfectBluffs > 0) {
    breakdown.push({ 
      label: `${tracker.perfectBluffs} Blefe${tracker.perfectBluffs > 1 ? 's' : ''} Perfeito${tracker.perfectBluffs > 1 ? 's' : ''}`, 
      amount: tracker.perfectBluffs * BC_REWARDS.PERFECT_BLUFF 
    });
  }
  
  // Blefes bons
  if (tracker.goodBluffs > 0) {
    breakdown.push({ 
      label: `${tracker.goodBluffs} Blefe${tracker.goodBluffs > 1 ? 's' : ''} Bom${tracker.goodBluffs > 1 ? 'ns' : ''}`, 
      amount: tracker.goodBluffs * BC_REWARDS.GOOD_BLUFF 
    });
  }
  
  // Acordo Hórus
  if (tracker.horusDealWins > 0) {
    breakdown.push({ 
      label: `${tracker.horusDealWins} Acordo${tracker.horusDealWins > 1 ? 's' : ''} Hórus`, 
      amount: tracker.horusDealWins * BC_REWARDS.HORUS_DEAL_WIN 
    });
  }
  
  // Carta Porto Seguro
  if (tracker.safeHarborUnlocked) {
    breakdown.push({ 
      label: 'Carta Porto Seguro', 
      amount: getSafeHarborCardReward(tracker.safeHarborRound) 
    });
  }
  
  // Carta Imunidade
  if (tracker.immunityUnlocked) {
    breakdown.push({ label: 'Carta Imunidade', amount: BC_REWARDS.IMMUNITY_CARD_UNLOCK });
  }
  
  // Maleta Misteriosa
  if (tracker.mysteryBriefcaseOpened) {
    breakdown.push({ label: 'Maleta Misteriosa', amount: tracker.mysteryBriefcaseValue });
  }
  
  // Vitória Final
  if (tracker.wonFinalRound) {
    breakdown.push({ label: 'Vitória Final (1M)', amount: BC_REWARDS.FINAL_VICTORY });
  }
  
  // Desafiante Certeiro
  if (tracker.challengerCorrectVotes >= BC_REWARDS.CHALLENGER_MIN_CORRECT_VOTES) {
    breakdown.push({ label: 'Desafiante Certeiro', amount: BC_REWARDS.CHALLENGER_ACCURACY });
  }
  
  return breakdown;
};

// Log de debug das recompensas
export const logRewardsStatus = (tracker: GameRewardsTracker): void => {
  console.log('[BC Rewards] Status atual:');
  console.log(`  - Respostas corretas: ${tracker.correctAnswers}`);
  console.log(`  - Blefes perfeitos: ${tracker.perfectBluffs}`);
  console.log(`  - Blefes bons: ${tracker.goodBluffs}`);
  console.log(`  - Acordos Hórus: ${tracker.horusDealWins}`);
  console.log(`  - Porto Seguro: ${tracker.safeHarborUnlocked ? `Sim (rodada ${tracker.safeHarborRound})` : 'Não'}`);
  console.log(`  - Imunidade: ${tracker.immunityUnlocked ? 'Sim' : 'Não'}`);
  console.log(`  - Maleta: ${tracker.mysteryBriefcaseOpened ? `${tracker.mysteryBriefcaseValue} BC` : 'Não aberta'}`);
  console.log(`  - Total acumulado: ${calculateTotalRewards(tracker)} BC`);
};
