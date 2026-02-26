// ══════════════════════════════════════════════════════════
// COUNTING SYSTEM (automático) & TRAP DETECTOR
// Hi-Lo card counting + Pattern detection
// ══════════════════════════════════════════════════════════

export interface CountingState {
  runningCount: number;
  decksRemaining: number;
  trueCount: number;
  playerEdge: number;
  recommendedBetUnits: number;
}

const HI_LO_VALUES: Record<string, -1 | 0 | 1> = {
  '2': 1, '3': 1, '4': 1, '5': 1, '6': 1,
  '7': 0, '8': 0, '9': 0,
  '10': -1, 'J': -1, 'Q': -1, 'K': -1, 'A': -1
};

export function getHiLoValue(card: string): -1 | 0 | 1 {
  const rank = card.slice(0, -1);
  return HI_LO_VALUES[rank] || 0;
}

export function updateCount(currentRunningCount: number, card: string): number {
  return currentRunningCount + getHiLoValue(card);
}

export function updateCountBatch(currentRunningCount: number, cards: string[]): number {
  return cards.reduce((count, card) => count + getHiLoValue(card), currentRunningCount);
}

export function calculateTrueCount(runningCount: number, decksRemaining: number): number {
  if (decksRemaining <= 0) return 0;
  return Math.round((runningCount / decksRemaining) * 100) / 100;
}

export function estimateDecksRemaining(totalDecks: number, cardsSeen: number): number {
  const cardsPerDeck = 52;
  const totalCards = totalDecks * cardsPerDeck;
  const cardsRemaining = totalCards - cardsSeen;
  return Math.max(0.5, cardsRemaining / cardsPerDeck);
}

export function calculatePlayerEdge(trueCount: number): number {
  return -0.5 + (trueCount * 0.5);
}

export function getRecommendedBetUnits(trueCount: number): number {
  if (trueCount < 0) return 0;
  if (trueCount <= 1) return 1;
  if (trueCount === 2) return 2;
  if (trueCount === 3) return 3;
  if (trueCount === 4) return 4;
  return 5;
}

export function getCountingState(runningCount: number, decksRemaining: number): CountingState {
  const trueCount = calculateTrueCount(runningCount, decksRemaining);
  return {
    runningCount,
    decksRemaining,
    trueCount,
    playerEdge: calculatePlayerEdge(trueCount),
    recommendedBetUnits: getRecommendedBetUnits(trueCount)
  };
}

export function getCountIndicator(trueCount: number): {
  color: 'red' | 'yellow' | 'green';
  label: string;
  emoji: string;
} {
  if (trueCount < 0) return { color: 'red', label: 'Desfavorável', emoji: '🔴' };
  if (trueCount < 2) return { color: 'yellow', label: 'Neutro', emoji: '🟡' };
  return { color: 'green', label: 'Favorável', emoji: '🟢' };
}

// ═══ TRAP DETECTOR ═══

export interface TrapDetection {
  detected: boolean;
  type: TrapType | null;
  confidence: number;
  severity: 'alert' | 'warning' | 'danger';
  message: string;
  recommendation: string;
}

export type TrapType = 'consecutive_losses' | 'low_winrate' | 'win2lose4_pattern' | 'negative_variance';

export interface SessionStats {
  handsPlayed: number;
  handsWon: number;
  handsLost: number;
  consecutiveLosses: number;
  currentBankroll: number;
  initialBankroll: number;
  resultHistory?: ('win' | 'loss' | 'push')[];
}

export function detectTrap(
  stats: SessionStats,
  thresholds: { consecutiveLossAlert: number; consecutiveLossDanger: number; minHandsForPattern: number; minWinRate: number; }
): TrapDetection {
  if (stats.consecutiveLosses >= thresholds.consecutiveLossDanger) {
    return { detected: true, type: 'consecutive_losses', confidence: 0.95, severity: 'danger',
      message: `🛑 ${stats.consecutiveLosses} derrotas consecutivas!`,
      recommendation: 'PARE AGORA. Troque de mesa ou modalidade imediatamente.' };
  }
  if (stats.consecutiveLosses >= thresholds.consecutiveLossAlert) {
    return { detected: true, type: 'consecutive_losses', confidence: 0.8, severity: 'warning',
      message: `⚠️ ${stats.consecutiveLosses} derrotas consecutivas`,
      recommendation: 'Considere trocar de mesa ou reduzir aposta.' };
  }

  if (stats.handsPlayed >= thresholds.minHandsForPattern) {
    const winRate = (stats.handsWon / stats.handsPlayed) * 100;
    if (winRate < thresholds.minWinRate) {
      return { detected: true, type: 'low_winrate', confidence: 0.85, severity: 'warning',
        message: `📉 Win rate de ${winRate.toFixed(1)}% (esperado ~48%)`,
        recommendation: 'Mesa pode estar desfavorável. Considere trocar.' };
    }
  }

  if (stats.resultHistory && stats.resultHistory.length >= 12) {
    const recent = stats.resultHistory.slice(-12);
    const wins = recent.filter(r => r === 'win').length;
    const losses = recent.filter(r => r === 'loss').length;
    const winRateRecent = wins / (wins + losses) * 100;
    if (winRateRecent >= 30 && winRateRecent <= 36) {
      return { detected: true, type: 'win2lose4_pattern', confidence: 0.8, severity: 'danger',
        message: '🎯 Padrão detectado: Ganha 2, Perde 4',
        recommendation: 'ARMADILHA! Troque de mesa ou modalidade agora.' };
    }
  }

  const loss = stats.initialBankroll - stats.currentBankroll;
  const lossPercent = (loss / stats.initialBankroll) * 100;
  if (lossPercent > 15 && stats.handsPlayed >= 20) {
    return { detected: true, type: 'negative_variance', confidence: 0.7, severity: 'warning',
      message: `💸 Perda de ${lossPercent.toFixed(1)}% em ${stats.handsPlayed} mãos`,
      recommendation: 'Variância negativa alta. Considere pausa.' };
  }

  return { detected: false, type: null, confidence: 0, severity: 'alert', message: '', recommendation: '' };
}

export function getSuggestedAction(trap: TrapDetection): {
  action: 'continue' | 'reduce_bet' | 'change_table' | 'stop';
  message: string;
} {
  if (!trap.detected) return { action: 'continue', message: 'Continue jogando normalmente.' };
  if (trap.severity === 'danger') return { action: 'stop', message: trap.recommendation };
  if (trap.type === 'consecutive_losses') return { action: 'reduce_bet', message: 'Reduza aposta para mínima por 5 mãos.' };
  return { action: 'change_table', message: trap.recommendation };
}
