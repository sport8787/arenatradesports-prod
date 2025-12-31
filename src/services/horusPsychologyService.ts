/**
 * Hórus Psychology Service
 * Sistema de diálogos psicológicos dinâmicos baseados no comportamento do jogador
 */

import { playHorus2Audio } from './horus2Engine';
import { getRandomAudioFile } from './horusLocalAudio';

// ============= FRASES DE PRESSÃO PSICOLÓGICA =============
// Dispara aleatoriamente (20% chance por rodada)
export const PRESSAO_PSICOLOGICA = [
  "[Nome], você parece nervoso. Por quê?",
  "Essa última resposta... VOCÊ HESITOU. Eu percebi.",
  "Os desafiantes estão conversando sobre você. Não é bom sinal.",
  "Você confia na sua memória, [Nome]? Deveria?",
  "Essa rodada vale [VALOR] BC. Você está pronto para perder isso?",
  "Interessante... sua frequência cardíaca aumentou.",
  "Você está suando, [Nome]? Eu não suaria.",
  "O tempo está passando. A pressão está subindo.",
  "Quantos erros você pode cometer antes de quebrar?",
  "Eu vi esse olhar antes. Geralmente não termina bem.",
];

// ============= FRASES DE RECONHECIMENTO =============
// Dispara após 3 acertos seguidos
export const RECONHECIMENTO = [
  "[Nome]... você está IMPRESSIONANDO.",
  "Não esperava isso de você. Continue.",
  "Você está provando ser diferente dos outros.",
  "Talvez eu tenha subestimado você, [Nome].",
  "Habilidade reconhecida. Respeito conquistado.",
  "Três acertos seguidos... Você tem sorte ou talento?",
  "Interessante. Você está jogando melhor do que eu previ.",
  "Admito: você me surpreendeu, [Nome].",
  "Continue assim e talvez eu te leve a sério.",
  "Você está crescendo no jogo. Não deixe isso subir à cabeça.",
];

// ============= FRASES DE PROVOCAÇÃO =============
// Dispara após erro + quando jogador é eliminado por blefe
export const PROVOCACAO = [
  "[Nome], você veio aqui para ISSO? Decepcionante.",
  "Até minha IA faria melhor que você.",
  "Talvez esse jogo seja DEMAIS para você.",
  "Quer desistir agora? Ninguém vai te julgar... muito.",
  "Patético. Mas esperado.",
  "Você desperdiçou meu tempo, [Nome].",
  "Eu esperava mais. Você entregou menos.",
  "Isso foi... constrangedor de assistir.",
  "Volte quando aprender a jogar.",
  "Alguns nascem para vencer. Você... não.",
];

// ============= TIPOS =============
export type DialogueType = 'pressao' | 'reconhecimento' | 'provocacao';

export interface PlayerPsychologyState {
  consecutiveCorrect: number;
  consecutiveWrong: number;
  totalBluffs: number;
  wasEliminatedByBluff: boolean;
  lastDialogueRound: number;
  playerName: string;
  currentRound: number;
  currentValue: number;
}

// ============= FUNÇÕES =============

/**
 * Substitui placeholders nas frases
 */
function replacePlaceholders(phrase: string, state: PlayerPsychologyState): string {
  return phrase
    .replace(/\[Nome\]/g, state.playerName || 'Jogador')
    .replace(/\[VALOR\]/g, state.currentValue?.toString() || '???');
}

/**
 * Obtém frase aleatória de uma categoria
 */
function getRandomPhrase(phrases: string[]): string {
  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Verifica se deve disparar pressão psicológica (20% chance)
 */
export function shouldTriggerPressao(
  state: PlayerPsychologyState
): boolean {
  // Evita repetir diálogos na mesma rodada
  if (state.lastDialogueRound === state.currentRound) return false;
  
  // 20% de chance
  return Math.random() < 0.2;
}

/**
 * Verifica se deve disparar reconhecimento (3+ acertos seguidos)
 */
export function shouldTriggerReconhecimento(
  state: PlayerPsychologyState
): boolean {
  // Evita repetir diálogos na mesma rodada
  if (state.lastDialogueRound === state.currentRound) return false;
  
  // 3 ou mais acertos seguidos
  return state.consecutiveCorrect >= 3;
}

/**
 * Verifica se deve disparar provocação (eliminação por blefe)
 */
export function shouldTriggerProvocacao(
  state: PlayerPsychologyState
): boolean {
  return state.wasEliminatedByBluff;
}

/**
 * Obtém frase de pressão psicológica
 */
export function getPressaoPhrase(state: PlayerPsychologyState): string {
  const phrase = getRandomPhrase(PRESSAO_PSICOLOGICA);
  return replacePlaceholders(phrase, state);
}

/**
 * Obtém frase de reconhecimento
 */
export function getReconhecimentoPhrase(state: PlayerPsychologyState): string {
  const phrase = getRandomPhrase(RECONHECIMENTO);
  return replacePlaceholders(phrase, state);
}

/**
 * Obtém frase de provocação
 */
export function getProvocacaoPhrase(state: PlayerPsychologyState): string {
  const phrase = getRandomPhrase(PROVOCACAO);
  return replacePlaceholders(phrase, state);
}

/**
 * Dispara diálogo psicológico com áudio (usa bordão genérico como fallback)
 */
export async function triggerPsychologyDialogue(
  type: DialogueType,
  state: PlayerPsychologyState,
  onPhraseReady?: (phrase: string) => void
): Promise<void> {
  let phrase: string;
  
  switch (type) {
    case 'pressao':
      phrase = getPressaoPhrase(state);
      break;
    case 'reconhecimento':
      phrase = getReconhecimentoPhrase(state);
      break;
    case 'provocacao':
      phrase = getProvocacaoPhrase(state);
      break;
  }
  
  console.log(`[HorusPsychology] Triggering ${type}:`, phrase);
  
  // Notifica a UI sobre a frase
  onPhraseReady?.(phrase);
  
  // Toca áudio apropriado (usa bordão como fallback)
  // Mapeia tipo para momento de áudio
  const momentMap: Record<DialogueType, string> = {
    pressao: 'taunt',
    reconhecimento: 'vitoria',
    provocacao: 'elimination',
  };
  
  await playHorus2Audio(momentMap[type]);
}

/**
 * Verifica e dispara diálogos baseado no estado do jogador
 * Retorna o tipo de diálogo disparado ou null
 */
export async function checkAndTriggerDialogue(
  state: PlayerPsychologyState,
  onPhraseReady?: (phrase: string, type: DialogueType) => void
): Promise<DialogueType | null> {
  // Prioridade 1: Provocação (eliminação por blefe)
  if (shouldTriggerProvocacao(state)) {
    const phrase = getProvocacaoPhrase(state);
    onPhraseReady?.(phrase, 'provocacao');
    await playHorus2Audio('elimination');
    return 'provocacao';
  }
  
  // Prioridade 2: Reconhecimento (3+ acertos)
  if (shouldTriggerReconhecimento(state)) {
    const phrase = getReconhecimentoPhrase(state);
    onPhraseReady?.(phrase, 'reconhecimento');
    await playHorus2Audio('taunt'); // Usa bordão com tom mais respeitoso
    return 'reconhecimento';
  }
  
  // Prioridade 3: Pressão psicológica (20% chance)
  if (shouldTriggerPressao(state)) {
    const phrase = getPressaoPhrase(state);
    onPhraseReady?.(phrase, 'pressao');
    await playHorus2Audio('taunt');
    return 'pressao';
  }
  
  return null;
}

/**
 * Hook-friendly: cria estado inicial de psicologia
 */
export function createInitialPsychologyState(playerName: string = 'Jogador'): PlayerPsychologyState {
  return {
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    totalBluffs: 0,
    wasEliminatedByBluff: false,
    lastDialogueRound: 0,
    playerName,
    currentRound: 1,
    currentValue: 0,
  };
}

/**
 * Atualiza estado após resposta
 */
export function updatePsychologyState(
  state: PlayerPsychologyState,
  wasCorrect: boolean,
  wasBluff: boolean = false
): PlayerPsychologyState {
  return {
    ...state,
    consecutiveCorrect: wasCorrect ? state.consecutiveCorrect + 1 : 0,
    consecutiveWrong: wasCorrect ? 0 : state.consecutiveWrong + 1,
    totalBluffs: wasBluff ? state.totalBluffs + 1 : state.totalBluffs,
  };
}
