// Método Hórus de Alavancagem — funções puras
// Meta inicial 5%, fator redutor 2,5% por green dentro do mesmo ciclo
// 5 ciclos: stake e saques proporcionais à banca inicial B

export const INITIAL_TARGET_PCT = 5;
export const REDUCTION_FACTOR = 0.025; // 2,5% redutor

export function nextTargetPct(greenStreak: number): number {
  return Number((INITIAL_TARGET_PCT * Math.pow(1 - REDUCTION_FACTOR, greenStreak)).toFixed(4));
}

export interface CycleConfig {
  cycle: number;
  stakeMultiplier: number;
  goalMultiplier: number;
  withdrawMultiplier: number;
  stake: number;
  goal: number;
  withdraw: number;
}

const CYCLE_TABLE: { stake: number; withdraw: number }[] = [
  { stake: 1.0, withdraw: 1.0 },   // ciclo 1
  { stake: 1.0, withdraw: 1.0 },   // ciclo 2
  { stake: 1.5, withdraw: 0.5 },   // ciclo 3
  { stake: 2.0, withdraw: 1.0 },   // ciclo 4
  { stake: 3.0, withdraw: 0 },     // ciclo 5
];

export function cycleConfig(initialBankroll: number, cycleNumber: number): CycleConfig {
  const idx = Math.max(1, Math.min(5, cycleNumber)) - 1;
  const t = CYCLE_TABLE[idx];
  const stake = Number((initialBankroll * t.stake).toFixed(2));
  return {
    cycle: cycleNumber,
    stakeMultiplier: t.stake,
    goalMultiplier: t.stake * 2,
    withdrawMultiplier: t.withdraw,
    stake,
    goal: Number((stake * 2).toFixed(2)),
    withdraw: Number((initialBankroll * t.withdraw).toFixed(2)),
  };
}

export function progressPct(currentBalance: number, stake: number): number {
  const goal = stake * 2;
  const progress = ((currentBalance - stake) / (goal - stake)) * 100;
  return Math.max(0, Math.min(100, progress));
}

export function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
