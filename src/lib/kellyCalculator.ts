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

export function calculateKellyStake(params: {
  probability: number;  // 0-100 (estimated real probability)
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

  const p = probability / 100;
  const q = 1 - p;

  // Kelly formula: f* = (p * o - 1) / (o - 1)
  const fullKelly = ((p * odd - 1) / (odd - 1)) * 100; // as percentage

  // If negative edge, Kelly says don't bet
  if (fullKelly <= 0) {
    return {
      fullKelly: 0,
      fractionalKelly: 0,
      stakePercent: 0,
      stakeAmount: 0,
      edge: (p * odd - 1) * 100,
    };
  }

  const fractionalKelly = fullKelly * fraction;

  // Cap between min and max
  const stakePercent = Math.min(maxStake, Math.max(minStake, fractionalKelly));
  const stakeAmount = Math.round(bankroll * (stakePercent / 100) * 100) / 100;

  return {
    fullKelly: Math.round(fullKelly * 100) / 100,
    fractionalKelly: Math.round(fractionalKelly * 100) / 100,
    stakePercent: Math.round(stakePercent * 100) / 100,
    stakeAmount,
    edge: Math.round((p * odd - 1) * 100 * 100) / 100,
  };
}
