/**
 * Kelly Criterion Calculator for stake sizing
 * 
 * Formula: stake% = (p * o - 1) / (o - 1)
 * Where: p = estimated probability, o = decimal odds
 * 
 * Uses fractional Kelly (25%) for safety
 */

export interface KellyResult {
  fullKelly: number;      // Full Kelly %
  fractionalKelly: number; // 25% Kelly (safe)
  stakePercent: number;    // Final capped stake %
  stakeAmount: number;     // R$ amount
  edge: number;            // Expected edge
}

function normalizeProbability(probability: number): number {
  if (!Number.isFinite(probability)) return 0;

  // Accept both formats: 0-1 (decimal) and 0-100 (percentage)
  const percentage = probability <= 1 ? probability * 100 : probability;
  return Math.min(100, Math.max(0, percentage));
}

export function calculateKellyStake(params: {
  probability: number;  // 0-1 or 0-100 (estimated real probability)
  odd: number;          // Decimal odd (e.g. 2.05)
  bankroll: number;     // Current balance
  fraction?: number;    // Kelly fraction (default 0.25 = 25%)
  minStake?: number;    // Min % (default 1%)
  maxStake?: number;    // Max % (default 5%)
}): KellyResult {
  const {
    probability,
    odd,
    bankroll,
    fraction = 0.25,
    minStake = 1,
    maxStake = 5,
  } = params;

  const p = normalizeProbability(probability) / 100;
  const edge = (p * odd - 1) * 100;

  // Invalid odd or no edge = don't bet
  if (odd <= 1) {
    return {
      fullKelly: 0,
      fractionalKelly: 0,
      stakePercent: 0,
      stakeAmount: 0,
      edge: Math.round(edge * 100) / 100,
    };
  }

  // Kelly formula: f* = (p * o - 1) / (o - 1)
  const fullKelly = ((p * odd - 1) / (odd - 1)) * 100;

  if (fullKelly <= 0) {
    return {
      fullKelly: 0,
      fractionalKelly: 0,
      stakePercent: 0,
      stakeAmount: 0,
      edge: Math.round(edge * 100) / 100,
    };
  }

  const fractionalKelly = fullKelly * fraction;
  const stakePercent = Math.min(maxStake, Math.max(minStake, fractionalKelly));
  const stakeAmount = Math.round(bankroll * (stakePercent / 100) * 100) / 100;

  return {
    fullKelly: Math.round(fullKelly * 100) / 100,
    fractionalKelly: Math.round(fractionalKelly * 100) / 100,
    stakePercent: Math.round(stakePercent * 100) / 100,
    stakeAmount,
    edge: Math.round(edge * 100) / 100,
  };
}
