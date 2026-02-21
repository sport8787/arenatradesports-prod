import type { Candle } from '@/pages/ArenaTrader';

export function calculateSMA(candles: Candle[], period: number): (number | null)[] {
  return candles.map((_, i) => {
    if (i < period - 1) return null;
    const slice = candles.slice(i - period + 1, i + 1);
    const sum = slice.reduce((acc, c) => acc + c.close, 0);
    return +(sum / period).toFixed(2);
  });
}

export function calculateBollingerBands(candles: Candle[], period = 20, multiplier = 2) {
  const sma = calculateSMA(candles, period);
  return candles.map((_, i) => {
    if (sma[i] === null) return { upper: null, middle: null, lower: null };
    const slice = candles.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const variance = slice.reduce((acc, c) => acc + (c.close - mean) ** 2, 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
      upper: +(mean + multiplier * stdDev).toFixed(2),
      middle: mean,
      lower: +(mean - multiplier * stdDev).toFixed(2),
    };
  });
}

export function calculateRSI(candles: Candle[], period = 14): (number | null)[] {
  if (candles.length < period + 1) return candles.map(() => null);

  const result: (number | null)[] = new Array(candles.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  // Initial average
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(1);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : +(100 - 100 / (1 + avgGain / avgLoss)).toFixed(1);
  }

  return result;
}
