/**
 * Sistema de Pressão Cognitiva Progressiva
 * 
 * Cronômetro Dinâmico:
 * - Rodadas 1-5: 30 segundos
 * - Rodadas 6-9: 20 segundos
 * - Rodadas 10-14: 15 segundos com estímulo sonoro (bips irregulares)
 * - Rodada 15: Timer INVISÍVEL (máxima pressão psicológica)
 * 
 * Efeito Bips Irregulares:
 * - Ativado rodadas 10-14
 * - Intervalos aleatórios para desestabilizar raciocínio
 * 
 * Evento de Ruptura (A Bomba):
 * - Dispara UMA VEZ por partida entre rodadas 6-10
 * - Som estridente + flash visual
 */

import { playBombEvent } from './centralAudioQueue';

// Duração do timer por faixa de rodada
export function getTimerDuration(round: number): number {
  if (round <= 5) return 30;
  if (round <= 9) return 20;
  return 15; // Rodadas 10-15
}

// Timer visível ou não
export function isTimerVisible(round: number): boolean {
  return round < 15; // Invisível apenas na rodada 15
}

// Verificar se bips devem estar ativos
export function shouldEnableBeeps(round: number): boolean {
  return round >= 10 && round <= 14;
}

// Verificar se evento de ruptura pode ocorrer nesta rodada
export function canTriggerBombEvent(round: number, alreadyTriggered: boolean): boolean {
  return !alreadyTriggered && round >= 6 && round <= 10;
}

// Gerar intervalos irregulares para bips (em ms)
export function generateBeepIntervals(round: number): number[] {
  if (round < 10) return [];
  
  const intervals: number[] = [];
  const baseInterval = round >= 13 ? 1500 : 2500; // Mais frequente nas rodadas finais
  let currentTime = 0;
  const maxTime = getTimerDuration(round) * 1000;
  
  // Gerar intervalos irregulares
  while (currentTime < maxTime - 2000) {
    // Variação de -40% a +60% do intervalo base
    const variation = baseInterval * (0.6 + Math.random() * 1.0);
    currentTime += variation;
    
    if (currentTime < maxTime - 1000) {
      intervals.push(currentTime);
    }
  }
  
  return intervals;
}

// Estado do sistema de pressão
interface PressureState {
  bombTriggered: boolean;
  currentRound: number;
}

let pressureState: PressureState = {
  bombTriggered: false,
  currentRound: 0,
};

// Resetar estado para nova partida
export function resetPressureState(): void {
  pressureState = {
    bombTriggered: false,
    currentRound: 0,
  };
  console.log('[PressureTimer] Estado resetado para nova partida');
}

// Atualizar rodada atual
export function setPressureRound(round: number): void {
  pressureState.currentRound = round;
}

// Verificar e disparar evento de ruptura (A Bomba)
// Retorna true se disparou, false caso contrário
export function checkAndTriggerBomb(round: number): boolean {
  if (pressureState.bombTriggered) {
    return false;
  }
  
  if (!canTriggerBombEvent(round, pressureState.bombTriggered)) {
    return false;
  }
  
  // Chance de 25% por rodada elegível
  // Isso dá ~76% de chance de acontecer em algum momento entre rodadas 6-10
  const shouldTrigger = Math.random() < 0.25;
  
  if (shouldTrigger) {
    pressureState.bombTriggered = true;
    console.log(`[PressureTimer] 💥 EVENTO DE RUPTURA disparado na rodada ${round}!`);
    
    // Tocar áudio de bomba via fila centralizada
    playBombEvent('/audio/horus/bomb.mp3');
    
    return true;
  }
  
  return false;
}

// Verificar se bomba já foi disparada nesta partida
export function isBombTriggered(): boolean {
  return pressureState.bombTriggered;
}

// Obter configuração completa de pressão para a rodada
export interface PressureConfig {
  timerDuration: number;
  timerVisible: boolean;
  enableBeeps: boolean;
  beepIntervals: number[];
  canBomb: boolean;
  pressureLevel: number; // 0-100
}

export function getPressureConfig(round: number): PressureConfig {
  // Nível de pressão baseado na rodada
  let pressureLevel = 0;
  if (round <= 3) pressureLevel = 20;
  else if (round <= 5) pressureLevel = 35;
  else if (round <= 7) pressureLevel = 50;
  else if (round <= 10) pressureLevel = 65;
  else if (round <= 12) pressureLevel = 80;
  else pressureLevel = 100;
  
  return {
    timerDuration: getTimerDuration(round),
    timerVisible: isTimerVisible(round),
    enableBeeps: shouldEnableBeeps(round),
    beepIntervals: generateBeepIntervals(round),
    canBomb: canTriggerBombEvent(round, pressureState.bombTriggered),
    pressureLevel,
  };
}
