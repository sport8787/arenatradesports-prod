// ══════════════════════════════════════════════════════════
// BETTING SYSTEM - MARTINGALE INTELIGENTE + GESTÃO DE BANCA
// ══════════════════════════════════════════════════════════

export interface BettingConfig {
  baseUnit: number;
  increment: number;
  maxBet: number;
  stopLoss: number;
  stopWin: number;
  blackjackPayout: number;
  useCounting: boolean;
}

export interface BetRecommendation {
  amount: number;
  units: number;
  reason: string;
  basedOn: 'martingale' | 'true_count' | 'both';
  warning?: string;
}

export function calculateNextBet(
  config: BettingConfig,
  result: 'win' | 'loss' | 'push' | 'blackjack',
  currentBet: number,
  lastWinBet: number
): { newBet: number; newLastWinBet: number } {
  if (result === 'push') return { newBet: currentBet, newLastWinBet: lastWinBet };
  if (result === 'win' || result === 'blackjack') {
    if (currentBet === config.baseUnit) return { newBet: config.baseUnit, newLastWinBet: config.baseUnit };
    const previousBet = Math.max(config.baseUnit, currentBet - config.increment);
    return { newBet: previousBet, newLastWinBet: currentBet };
  }
  const newBet = Math.min(currentBet + config.increment, config.maxBet);
  return { newBet, newLastWinBet: lastWinBet };
}

export function shouldStopBetting(
  config: BettingConfig,
  currentBankroll: number,
  initialBankroll: number
): { shouldStop: boolean; reason: 'stop_loss' | 'stop_win' | null } {
  const profit = currentBankroll - initialBankroll;
  if (Math.abs(profit) >= config.stopLoss && profit < 0) return { shouldStop: true, reason: 'stop_loss' };
  if (profit >= config.stopWin) return { shouldStop: true, reason: 'stop_win' };
  return { shouldStop: false, reason: null };
}

export function getOptimalBet(
  config: BettingConfig,
  martingaleBet: number,
  trueCount: number,
  bankroll: number
): BetRecommendation {
  if (!config.useCounting) {
    const safeBet = Math.min(martingaleBet, bankroll * 0.2);
    return {
      amount: safeBet, units: safeBet / config.baseUnit,
      reason: 'Progressão Martingale', basedOn: 'martingale',
      warning: safeBet < martingaleBet ? 'Limite por segurança da banca' : undefined
    };
  }

  if (trueCount < 0) {
    const safeBet = Math.min(config.baseUnit, bankroll * 0.1);
    return {
      amount: safeBet, units: 1,
      reason: `TC ${trueCount}: Baralho desfavorável`, basedOn: 'true_count',
      warning: 'Considere sair da mesa.'
    };
  }

  const tcMultiplier = Math.min(Math.floor(trueCount), 5);
  const tcBasedBet = config.baseUnit * Math.max(tcMultiplier, 1);
  let optimalBet = Math.max(martingaleBet, tcBasedBet);
  optimalBet = Math.min(optimalBet, config.maxBet, bankroll * 0.2);

  const reason = tcBasedBet > martingaleBet
    ? `TC +${trueCount}: Baralho favorável (${tcMultiplier}x base)`
    : 'TC neutro, progressão Martingale';

  return {
    amount: optimalBet,
    units: optimalBet / config.baseUnit,
    reason,
    basedOn: tcBasedBet > martingaleBet ? 'true_count' : 'martingale',
    warning: optimalBet >= config.maxBet ? 'Limite máximo atingido' : undefined
  };
}

export function calculateProfit(
  result: 'win' | 'loss' | 'push' | 'blackjack',
  bet: number,
  blackjackPayout: number
): number {
  switch (result) {
    case 'blackjack': return bet * blackjackPayout;
    case 'win': return bet;
    case 'loss': return -bet;
    case 'push': return 0;
    default: return 0;
  }
}

export function updateBankroll(
  bankroll: number,
  result: 'win' | 'loss' | 'push' | 'blackjack',
  bet: number,
  blackjackPayout: number
): number {
  return bankroll + calculateProfit(result, bet, blackjackPayout);
}

export function validateBettingConfig(
  config: BettingConfig,
  bankroll: number
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (config.baseUnit <= 0) errors.push('Aposta base deve ser > 0');
  if (config.increment <= 0) errors.push('Incremento deve ser > 0');
  if (config.maxBet < config.baseUnit) errors.push('Aposta máxima deve ser ≥ aposta base');
  if (config.stopLoss <= 0) errors.push('Stop loss deve ser > 0');
  if (config.stopWin <= 0) errors.push('Stop win deve ser > 0');
  if (config.baseUnit > bankroll * 0.05) warnings.push('Aposta base >5% da banca (risco alto)');
  if (config.maxBet > bankroll * 0.2) warnings.push('Aposta máxima >20% da banca');
  return { valid: errors.length === 0, errors, warnings };
}
