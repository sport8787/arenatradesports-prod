// NarrativeEngine - Controla a progressão narrativa e eventos ocultos do jogo

export type NarrativeAct = 'initiation' | 'trial' | 'ascension' | 'fall' | 'climax';

export interface ActConfig {
  id: NarrativeAct;
  name: string;
  rounds: [number, number]; // [start, end]
  horusTone: 'neutral' | 'questioning' | 'respectful' | 'tense' | 'dramatic';
  timerDuration: number;
  timerVisible: boolean;
  pressureLevel: number; // 0-100
  enableBeeps: boolean;
  enableBombEvent: boolean;
}

export interface NarrativeState {
  currentAct: NarrativeAct;
  currentRound: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  bombEventTriggered: boolean;
  silentObserverActive: boolean;
  totalCorrect: number;
  totalWrong: number;
}

export interface HiddenEvent {
  id: string;
  name: string;
  trigger: (state: NarrativeState) => boolean;
  effect: string;
  audioFile?: string;
}

// Configuração dos 5 Atos Narrativos
export const NARRATIVE_ACTS: Record<NarrativeAct, ActConfig> = {
  initiation: {
    id: 'initiation',
    name: 'A Iniciação',
    rounds: [1, 3],
    horusTone: 'neutral',
    timerDuration: 30,
    timerVisible: true,
    pressureLevel: 20,
    enableBeeps: false,
    enableBombEvent: false,
  },
  trial: {
    id: 'trial',
    name: 'A Provação',
    rounds: [4, 7],
    horusTone: 'questioning',
    timerDuration: 25,
    timerVisible: true,
    pressureLevel: 40,
    enableBeeps: false,
    enableBombEvent: true,
  },
  ascension: {
    id: 'ascension',
    name: 'A Ascensão',
    rounds: [8, 10],
    horusTone: 'respectful',
    timerDuration: 20,
    timerVisible: true,
    pressureLevel: 60,
    enableBeeps: false,
    enableBombEvent: true,
  },
  fall: {
    id: 'fall',
    name: 'A Queda',
    rounds: [11, 12],
    horusTone: 'tense',
    timerDuration: 15,
    timerVisible: true,
    pressureLevel: 80,
    enableBeeps: true,
    enableBombEvent: false,
  },
  climax: {
    id: 'climax',
    name: 'O Clímax',
    rounds: [13, 15],
    horusTone: 'dramatic',
    timerDuration: 15,
    timerVisible: false, // Timer invisível na rodada 15
    pressureLevel: 100,
    enableBeeps: true,
    enableBombEvent: false,
  },
};

// Eventos Ocultos - Agora com novos áudios
export const HIDDEN_EVENTS: HiddenEvent[] = [
  {
    id: 'silent_observer',
    name: 'O Observador Silencioso',
    trigger: (state) => state.consecutiveCorrect >= 5,
    effect: 'Hórus faz uma pausa dramática e menciona que "alguém está observando"',
    audioFile: '/audio/horus/evento_oculto_1.mp3', // NEW: Áudio específico
  },
  {
    id: 'doubt_seed',
    name: 'A Semente da Dúvida',
    trigger: (state) => state.consecutiveWrong >= 3,
    effect: 'Hórus questiona se o jogador realmente conhece as técnicas',
    audioFile: '/audio/horus/evento_oculto_2.mp3', // NEW: Áudio específico
  },
  {
    id: 'perfect_run',
    name: 'Corrida Perfeita',
    trigger: (state) => state.totalCorrect >= 10 && state.totalWrong === 0,
    effect: 'Mycroft intervém com uma análise especial',
    audioFile: '/audio/horus/evento_oculto_3.mp3', // NEW: Áudio específico
  },
  {
    id: 'checkpoint_10',
    name: 'Marco da Rodada 10',
    trigger: (state) => state.currentRound === 10,
    effect: 'Você chegou à rodada 10! A Ascensão está completa.',
    audioFile: '/audio/horus/rodada_10.mp3', // NEW: Áudio específico
  },
  {
    id: 'porto_seguro',
    name: 'Porto Seguro Desbloqueado',
    trigger: (state) => state.consecutiveCorrect >= 2 && state.currentRound >= 3,
    effect: 'Você desbloqueou o Porto Seguro! Seus ganhos estão protegidos.',
    audioFile: '/audio/horus/tem_porto_seguro.mp3', // NEW: Áudio específico
  },
];

// Frases do Hórus por tom
export const HORUS_PHRASES_BY_TONE: Record<ActConfig['horusTone'], string[]> = {
  neutral: [
    'Interessante... vamos ver como você se sai.',
    'Uma escolha segura. Próxima pergunta.',
    'O caminho do vendedor é longo. Continue.',
    'Hmm, anotado. Prossigamos.',
  ],
  questioning: [
    'Tem certeza? Parece... conveniente demais.',
    'Acertou, mas será que foi sorte ou conhecimento?',
    'Curioso... muito curioso essa sua resposta.',
    'Interessante escolha. Veremos se mantém esse padrão.',
  ],
  respectful: [
    'Impressionante. Você realmente conhece o caminho.',
    'O Observador está notando sua performance.',
    'Poucos chegam tão longe com tanta precisão.',
    'Você me surpreende. Continue assim.',
  ],
  tense: [
    'A pressão aumenta... você sente?',
    'Cada segundo conta agora. Escolha sabiamente.',
    'O erro aqui custa caro. Muito caro.',
    'Sua mente está clara? Ou a dúvida se instala?',
  ],
  dramatic: [
    'Este é o momento da verdade!',
    'Tudo se resume a esta escolha.',
    'O destino do vendedor se decide AGORA.',
    'All-In ou Maleta? Sua escolha definirá tudo.',
  ],
};

// Determina o ato atual baseado na rodada
export function getCurrentAct(round: number): ActConfig {
  for (const act of Object.values(NARRATIVE_ACTS)) {
    if (round >= act.rounds[0] && round <= act.rounds[1]) {
      return act;
    }
  }
  return NARRATIVE_ACTS.climax; // Default para rodadas além do planejado
}

// Calcula o tempo do cronômetro baseado na rodada
export function getTimerDuration(round: number): number {
  if (round <= 5) return 30;
  if (round <= 9) return 25;
  if (round <= 12) return 20;
  if (round <= 14) return 15;
  return 15; // Rodada 15
}

// Verifica se o timer deve ser visível
export function isTimerVisible(round: number): boolean {
  return round < 15;
}

// Verifica se deve disparar o evento Bomba
export function shouldTriggerBomb(round: number, bombTriggered: boolean): boolean {
  if (bombTriggered) return false;
  if (round < 6 || round > 10) return false;
  // 30% de chance por rodada no intervalo
  return Math.random() < 0.3;
}

// Gera intervalos irregulares para os beeps
export function generateBeepIntervals(round: number): number[] {
  if (round < 11) return [];
  
  const baseIntervals = [2000, 3500, 5000, 7500, 10000];
  const variance = round >= 13 ? 1500 : 1000;
  
  return baseIntervals.map(interval => 
    interval + (Math.random() * variance * 2) - variance
  ).filter(i => i > 0).sort((a, b) => a - b);
}

// Obtém uma frase do Hórus baseada no tom do ato atual
export function getHorusPhrase(tone: ActConfig['horusTone']): string {
  const phrases = HORUS_PHRASES_BY_TONE[tone];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// Verifica eventos ocultos
export function checkHiddenEvents(state: NarrativeState): HiddenEvent | null {
  for (const event of HIDDEN_EVENTS) {
    if (event.trigger(state)) {
      return event;
    }
  }
  return null;
}

// Estado inicial do engine
export function createInitialNarrativeState(): NarrativeState {
  return {
    currentAct: 'initiation',
    currentRound: 1,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    bombEventTriggered: false,
    silentObserverActive: false,
    totalCorrect: 0,
    totalWrong: 0,
  };
}

// Atualiza o estado após uma resposta
export function updateNarrativeState(
  state: NarrativeState,
  wasCorrect: boolean
): NarrativeState {
  const newRound = state.currentRound + 1;
  const newAct = getCurrentAct(newRound);
  
  return {
    ...state,
    currentRound: newRound,
    currentAct: newAct.id,
    consecutiveCorrect: wasCorrect ? state.consecutiveCorrect + 1 : 0,
    consecutiveWrong: wasCorrect ? 0 : state.consecutiveWrong + 1,
    totalCorrect: wasCorrect ? state.totalCorrect + 1 : state.totalCorrect,
    totalWrong: wasCorrect ? state.totalWrong : state.totalWrong + 1,
    silentObserverActive: state.consecutiveCorrect + (wasCorrect ? 1 : 0) >= 5,
  };
}

// Log para debug
export function logNarrativeState(state: NarrativeState): void {
  const act = getCurrentAct(state.currentRound);
  console.log('[NarrativeEngine]', {
    round: state.currentRound,
    act: act.name,
    tone: act.horusTone,
    timer: getTimerDuration(state.currentRound),
    timerVisible: isTimerVisible(state.currentRound),
    pressure: act.pressureLevel,
    consecutiveCorrect: state.consecutiveCorrect,
    silentObserver: state.silentObserverActive,
  });
}
