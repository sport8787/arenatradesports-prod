import type { LiveSessionState, RoundResult } from './liveTypes';
import { quickKelly } from '@/services/bankrollAiService';

export interface BetSuggestion {
  amount: number;
  reason: string;
  basedOn: 'base' | 'martingale_recovery' | 'true_count_high' | 'kelly';
}

/**
 * Calcula a aposta sugerida para a próxima mão.
 * Override: TC >= 4 sempre sobrepõe Martingale.
 */
export function suggestNextBet(state: LiveSessionState, trueCount: number): BetSuggestion {
  const { config, currentBet, redStreak } = state;
  const base = config.baseBet;

  // Override TC alto — todos os sistemas
  if (trueCount >= 5) {
    return {
      amount: Math.max(currentBet, base * 5),
      reason: `TC +${trueCount}: baralho dourado, aposta máxima`,
      basedOn: 'true_count_high',
    };
  }
  if (trueCount >= 3) {
    return {
      amount: Math.max(currentBet, base * (1 + trueCount)),
      reason: `TC +${trueCount}: aumentar aposta`,
      basedOn: 'true_count_high',
    };
  }

  if (config.bettingSystem === 'kelly') {
    // Kelly aproximado: p = 0.50 + 0.005*TC (edge ~ 0.5% por TC), odd 2.0
    const p = Math.max(0.45, Math.min(0.55, 0.50 + 0.005 * trueCount));
    const k = quickKelly(p, 2.0, state.bankroll);
    const amount = Math.max(base, Math.round(k.stakeAmount || base));
    return {
      amount,
      reason: k.edge > 0 ? `Kelly fracionário (edge ${k.edge.toFixed(2)}%)` : 'Kelly mínimo — sem edge',
      basedOn: 'kelly',
    };
  }

  // Martingale Conservador
  if (redStreak > 0) {
    return {
      amount: Math.min(base + 2 * redStreak, base * 6),
      reason: `Recovery Martingale (${redStreak} red${redStreak > 1 ? 's' : ''})`,
      basedOn: 'martingale_recovery',
    };
  }

  return { amount: base, reason: 'Aposta base', basedOn: 'base' };
}

/** Atualiza estado após resultado de uma rodada (sem mutar o original). */
export function applyRoundResult(
  state: LiveSessionState,
  result: RoundResult,
  trueCount: number,
): LiveSessionState {
  const bet = state.currentBet;
  const profit =
    result === 'blackjack' ? bet * 1.5 :
    result === 'win' ? bet :
    result === 'loss' ? -bet :
    0;

  const isWin = result === 'win' || result === 'blackjack';
  const newRedStreak = isWin ? 0 : result === 'loss' ? state.redStreak + 1 : state.redStreak;

  // próximo bet base segundo Martingale Conservador
  let nextBet = state.config.baseBet;
  if (state.config.bettingSystem === 'martingale') {
    if (result === 'loss') nextBet = Math.min(state.currentBet + 2, state.config.baseBet * 6);
    else if (isWin && state.currentBet > state.config.baseBet) nextBet = Math.max(state.config.baseBet, state.currentBet - 2);
    else nextBet = state.currentBet;
  }

  const newBankroll = +(state.bankroll + profit).toFixed(2);
  const record = {
    id: state.history.length + 1,
    bet,
    result,
    profit,
    trueCount,
    bankrollAfter: newBankroll,
    timestamp: Date.now(),
  };

  const paused = newRedStreak >= state.config.maxRedStreak;

  return {
    ...state,
    bankroll: newBankroll,
    currentBet: nextBet,
    redStreak: newRedStreak,
    paused,
    pauseReason: paused ? `${newRedStreak} reds consecutivos — sessão pausada` : undefined,
    count: { ...state.count, history: [...state.count.history, trueCount] },
    history: [...state.history, record],
  };
}
