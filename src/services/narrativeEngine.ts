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
  // Event tracking
  blefePerfeitoUnlocked: boolean;
  cartaBonusUnlocked: boolean;
  horusRespectUnlocked: boolean;
  imunidadeUnlocked: boolean;
}

export interface HiddenEvent {
  id: string;
  name: string;
  trigger: (state: NarrativeState) => boolean;
  effect: string;
  audioFile?: string;
  reward?: {
    card?: 'porto_seguro' | 'imunidade';
    difficulty?: 'increase' | 'decrease';
    bluffcoins?: number;
  };
}

export interface CardUnlockRitual {
  title: string;
  narration: string;
  animation: 'card_golden_spin' | 'card_platinum_emerge' | 'card_diamond_shatter';
  soundEffect: string;
}

export interface NarrativeChoice {
  type: 'NARRATIVE_CHOICE';
  dialogue: string;
  choices: Array<{
    text: string;
    action: 'end_game_with_prize' | 'continue_to_final';
  }>;
}

export interface HorusDialogueContext {
  roundNumber: number;
  playerName: string;
  currentBC: number;
  streakCorrect: number;
  streakWrong: number;
  perfectBluff: boolean;
  lastAnswerCorrect: boolean;
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

// ============= DIÁLOGOS POR ATO =============

export const ACT_DIALOGUES = {
  1: { // Ato I - A Iniciação
    opening: [
      "Bem-vindo ao Tribunal do Blefe, [nome]. Vamos ver do que você é feito.",
      "[nome], você está prestes a entrar em um jogo onde a verdade é moeda de troca.",
      "O Blefador mais habilidoso vence. Você está pronto, [nome]?",
    ],
    correct: [
      "Hmm, conhecimento básico. Continue.",
      "Você sabe o óbvio. Vamos ver se sabe o essencial.",
      "Resposta correta. Não se empolgue ainda.",
    ],
    wrong: [
      "Um tropeço tão cedo? Interessante...",
      "Erro comum de iniciante. Vamos ver como você se recupera.",
      "Já começou vacilando, [nome]?",
    ],
    bluff_success: [
      "Seu primeiro blefe. Nada mal para um novato.",
      "Convenceu os outros... mas não me engana.",
      "Blefe aceito. Você tem potencial.",
    ],
    transition: [
      "O aquecimento terminou, [nome]. Agora a coisa fica séria.",
      "Você passou da iniciação. A verdadeira prova começa agora.",
    ],
  },
  2: { // Ato II - A Provação
    opening: [
      "A Provação começa, [nome]. É aqui que os fracos desistem.",
      "Chegou a hora de provar seu valor de verdade.",
    ],
    correct: [
      "Acertou, mas foi sorte ou conhecimento?",
      "Interessante... você parece saber algo.",
      "Curioso. Muito curioso essa sua resposta.",
    ],
    wrong: [
      "Aí está o erro que eu esperava.",
      "A pressão está subindo, [nome]?",
      "Nervoso? Eu notei a hesitação.",
    ],
    bluff_success: [
      "Seu blefe está melhorando. Tenha cuidado com a confiança excessiva.",
      "Convenceu os tolos. Mas e os espertos?",
    ],
    taunt: [
      "Você parece nervoso, [nome]. Por quê?",
      "Essa última resposta... VOCÊ HESITOU. Eu percebi.",
      "Os desafiantes estão conversando sobre você. Não é bom sinal.",
    ],
    transition: [
      "Você sobreviveu à provação. Mas o caminho fica mais estreito.",
    ],
  },
  3: { // Ato III - A Ascensão
    opening: [
      "A Ascensão, [nome]. Poucos chegam aqui.",
      "Você me impressionou. Não esperava isso de você.",
    ],
    correct: [
      "Impressionante. Você realmente conhece o caminho.",
      "O Observador está notando sua performance.",
      "Poucos chegam tão longe com tanta precisão.",
    ],
    wrong: [
      "Até os melhores tropeçam. A questão é: você se levanta?",
      "Um erro aqui custa caro. Muito caro.",
    ],
    bluff_success: [
      "Blefe de mestre! Você está evoluindo.",
      "Até eu teria dificuldade em detectar isso.",
    ],
    respect: [
      "[nome]... você está IMPRESSIONANDO.",
      "Talvez eu tenha subestimado você.",
      "Habilidade reconhecida. Respeito conquistado.",
    ],
    transition: [
      "A ascensão está completa. Agora vem a queda... ou a glória.",
    ],
  },
  4: { // Ato IV - A Queda
    opening: [
      "A Queda, [nome]. É aqui que a maioria desmorona.",
      "Pressão máxima. Cada segundo conta.",
    ],
    correct: [
      "Acertou sob pressão. Impressionante.",
      "Sua mente ainda está afiada. Por quanto tempo?",
    ],
    wrong: [
      "O erro mais esperado. A queda começou.",
      "Eu vi isso chegando. Você não?",
      "A pressão está te quebrando, [nome]?",
    ],
    bluff_success: [
      "Blefar sob essa pressão? Você tem sangue frio.",
    ],
    taunt: [
      "Você confia na sua memória, [nome]? Deveria?",
      "Quantos erros você pode cometer antes de quebrar?",
      "O tempo está passando. A pressão está subindo.",
    ],
    transition: [
      "Se você chegou até aqui, o clímax te aguarda.",
    ],
  },
  5: { // Ato V - O Clímax
    opening: [
      "O CLÍMAX, [nome]! Este é o momento da verdade!",
      "Tudo se resume a isso. All-in ou a Maleta. Escolha.",
    ],
    correct: [
      "VOCÊ CONSEGUIU! Um milhão de BluffCoins!",
      "Lendário! Você dominou o Tribunal do Blefe!",
    ],
    wrong: [
      "TÃO PERTO! E agora... tão longe.",
      "A queda de um herói. Trágico, mas previsível.",
    ],
    all_in: [
      "ALL-IN! Tudo ou nada, [nome]!",
      "Você apostou tudo. Coragem ou loucura?",
    ],
    briefcase_choice: [
      "A Maleta Misteriosa ou o ALL-IN. O que você escolhe, [nome]?",
      "Certeza vs Incerteza. Sua última decisão.",
    ],
    victory: [
      "[nome], você transcendeu! O Tribunal do Blefe tem um novo mestre!",
      "UM MILHÃO! Você provou ser o maior blefador!",
    ],
    defeat: [
      "Tão perto da glória... e agora, nada.",
      "O Tribunal do Blefe não perdoa erros no fim.",
    ],
  },
};

// Eventos Ocultos - Com tracking de unlock
export const HIDDEN_EVENTS: HiddenEvent[] = [
  {
    id: 'silent_observer',
    name: 'O Observador Silencioso',
    trigger: (state) => state.consecutiveCorrect >= 5 && !state.horusRespectUnlocked,
    effect: 'Hórus faz uma pausa dramática e menciona que "alguém está observando"',
    audioFile: '/audio/horus/evento_oculto_1.mp3',
    reward: { difficulty: 'increase' },
  },
  {
    id: 'doubt_seed',
    name: 'A Semente da Dúvida',
    trigger: (state) => state.consecutiveWrong >= 3,
    effect: 'Hórus questiona se o jogador realmente conhece as técnicas',
    audioFile: '/audio/horus/evento_oculto_2.mp3',
  },
  {
    id: 'perfect_run',
    name: 'Corrida Perfeita',
    trigger: (state) => state.totalCorrect >= 10 && state.totalWrong === 0,
    effect: 'Mycroft intervém com uma análise especial',
    audioFile: '/audio/horus/evento_oculto_3.mp3',
    reward: { bluffcoins: 500 },
  },
  {
    id: 'checkpoint_10',
    name: 'Marco da Rodada 10',
    trigger: (state) => state.currentRound === 10,
    effect: 'Você chegou à rodada 10! A Ascensão está completa.',
    audioFile: '/audio/horus/rodada_10.mp3',
  },
  {
    id: 'blefe_perfeito',
    name: 'Blefe Perfeito',
    trigger: (state) => state.blefePerfeitoUnlocked && !state.imunidadeUnlocked,
    effect: 'IMPOSSÍVEL! Você cometeu um BLEFE PERFEITO!',
    audioFile: '/audio/horus/blefe_perfeito.mp3',
    reward: { card: 'imunidade' },
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

// ============= RITUAIS DE DESBLOQUEIO DE CARTA =============

export const CARD_UNLOCK_RITUALS: Record<'porto_seguro' | 'imunidade', CardUnlockRitual> = {
  porto_seguro: {
    title: "CARTA BÔNUS DESBLOQUEADA",
    narration: `Parabéns! Você provou ser um ótimo Blefador e acaba de liberar uma conquista épica! A Carta Porto Seguro agora é sua.`,
    animation: 'card_golden_spin',
    soundEffect: '/audio/horus/carta_bonus_porto_seguro.mp3',
  },
  imunidade: {
    title: "CONQUISTA RARA DESBLOQUEADA",
    narration: `Você transcendeu. O Blefe Perfeito é uma arte. E você a dominou. Carta Imunidade concedida.`,
    animation: 'card_platinum_emerge',
    soundEffect: '/audio/horus/carta_bonus_imunidade.mp3',
  },
};

// ============= CLASSE PRINCIPAL =============

export class NarrativeEngine {
  private state: NarrativeState;
  private playerName: string;
  private triggeredEvents: Set<string> = new Set();

  constructor(playerName: string = 'Jogador') {
    this.playerName = playerName;
    this.state = createInitialNarrativeState();
  }

  // Getters
  getState(): NarrativeState {
    return { ...this.state };
  }

  getPlayerName(): string {
    return this.playerName;
  }

  setPlayerName(name: string): void {
    this.playerName = name;
  }

  // Determina qual Ato narrativo estamos
  getCurrentActNumber(roundNumber: number): number {
    if (roundNumber <= 3) return 1; // A Iniciação
    if (roundNumber <= 7) return 2; // A Provação
    if (roundNumber <= 10) return 3; // O Domínio/Ascensão
    if (roundNumber <= 12) return 4; // A Queda
    return 5; // O Clímax
  }

  // Diálogos contextuais do Hórus
  getHorusDialogue(context: HorusDialogueContext): string {
    const act = this.getCurrentActNumber(context.roundNumber);
    const dialogues = ACT_DIALOGUES[act as keyof typeof ACT_DIALOGUES];
    
    if (!dialogues) return '';

    let category: keyof typeof dialogues;
    
    // Determina a categoria do diálogo
    if (context.perfectBluff) {
      category = 'bluff_success' as keyof typeof dialogues;
    } else if (context.lastAnswerCorrect) {
      category = 'correct' as keyof typeof dialogues;
    } else {
      category = 'wrong' as keyof typeof dialogues;
    }

    const phrases = dialogues[category] as string[] | undefined;
    if (!phrases || phrases.length === 0) return '';

    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    return this.replacePlaceholders(phrase, context);
  }

  // Substitui placeholders nos diálogos
  private replacePlaceholders(text: string, context: Partial<HorusDialogueContext>): string {
    return text
      .replace(/\[nome\]/gi, context.playerName || this.playerName)
      .replace(/\[NOME\]/g, (context.playerName || this.playerName).toUpperCase())
      .replace(/\[BC\]/g, context.currentBC?.toLocaleString() || '???');
  }

  // Verifica se deve disparar evento oculto
  checkHiddenEvents(context: HorusDialogueContext): HiddenEvent | null {
    // Evento: 5 acertos seguidos - Respeito do Hórus
    if (context.streakCorrect >= 5 && !this.state.horusRespectUnlocked) {
      this.state.horusRespectUnlocked = true;
      this.triggeredEvents.add('silent_observer');
      
      return {
        id: 'observador_silencioso',
        name: 'O Observador Silencioso',
        trigger: () => true,
        effect: `${this.playerName}, eu estava OBSERVANDO você...`,
        audioFile: '/audio/horus/evento_oculto_1.mp3',
        reward: { difficulty: 'increase' },
      };
    }

    // Evento: Blefe perfeito (3 CLAROS após erro)
    if (context.perfectBluff && !this.state.blefePerfeitoUnlocked) {
      this.state.blefePerfeitoUnlocked = true;
      this.triggeredEvents.add('blefe_perfeito');
      
      return {
        id: 'blefe_perfeito',
        name: 'Blefe Perfeito',
        trigger: () => true,
        effect: `IMPOSSÍVEL! Você cometeu um BLEFE PERFEITO!`,
        audioFile: '/audio/horus/blefe_perfeito.mp3',
        reward: { card: 'imunidade' },
      };
    }

    return null;
  }

  // Ritual de liberação de Carta Bônus
  getCardUnlockRitual(cardType: 'porto_seguro' | 'imunidade'): CardUnlockRitual & { personalizedNarration: string } {
    const ritual = CARD_UNLOCK_RITUALS[cardType];
    const personalizedNarration = this.replacePlaceholders(
      `Parabéns, [nome]! ${ritual.narration}`,
      { playerName: this.playerName }
    );

    if (cardType === 'porto_seguro') {
      this.state.cartaBonusUnlocked = true;
    } else if (cardType === 'imunidade') {
      this.state.imunidadeUnlocked = true;
    }

    return {
      ...ritual,
      personalizedNarration,
    };
  }

  // Checkpoint com escolha narrativa (rodada 13)
  getCheckpointChoice(roundNumber: number, currentBC: number): NarrativeChoice | null {
    if (roundNumber !== 13) return null;

    return {
      type: 'NARRATIVE_CHOICE',
      dialogue: this.replacePlaceholders(
        `[nome], você tem ${currentBC.toLocaleString()} BluffCoins.\n\nVocê pode PARAR AGORA e sair vitorioso.\n\nOu pode ARRISCAR TUDO pelas próximas rodadas.\n\nO que você escolhe?`,
        { playerName: this.playerName, currentBC }
      ),
      choices: [
        {
          text: 'PARAR E SAIR VITORIOSO',
          action: 'end_game_with_prize',
        },
        {
          text: 'ARRISCAR TUDO',
          action: 'continue_to_final',
        },
      ],
    };
  }

  // Atualiza estado após resposta
  advanceRound(wasCorrect: boolean, wasPerfectBluff: boolean = false): void {
    this.state = updateNarrativeState(this.state, wasCorrect);
    
    if (wasPerfectBluff) {
      this.state.blefePerfeitoUnlocked = true;
    }
  }

  // Obtém diálogo de abertura do ato
  getActOpeningDialogue(): string {
    const act = this.getCurrentActNumber(this.state.currentRound);
    const dialogues = ACT_DIALOGUES[act as keyof typeof ACT_DIALOGUES];
    
    if (!dialogues?.opening) return '';

    const phrase = dialogues.opening[Math.floor(Math.random() * dialogues.opening.length)];
    return this.replacePlaceholders(phrase, { playerName: this.playerName });
  }

  // Obtém diálogo de transição
  getTransitionDialogue(): string {
    const act = this.getCurrentActNumber(this.state.currentRound);
    const dialogues = ACT_DIALOGUES[act as keyof typeof ACT_DIALOGUES] as any;
    
    if (!dialogues?.transition) return '';

    const transitions = dialogues.transition as string[];
    const phrase = transitions[Math.floor(Math.random() * transitions.length)];
    return this.replacePlaceholders(phrase, { playerName: this.playerName });
  }

  // Obtém diálogo de provocação
  getTauntDialogue(): string {
    const act = this.getCurrentActNumber(this.state.currentRound);
    const dialogues = ACT_DIALOGUES[act as keyof typeof ACT_DIALOGUES] as any;
    
    if (!dialogues?.taunt) {
      // Fallback to generic taunts
      const genericTaunts = [
        `[nome], você parece nervoso. Por quê?`,
        `Essa última resposta... VOCÊ HESITOU. Eu percebi.`,
        `Você confia na sua memória, [nome]? Deveria?`,
      ];
      return this.replacePlaceholders(
        genericTaunts[Math.floor(Math.random() * genericTaunts.length)],
        { playerName: this.playerName }
      );
    }

    const phrase = dialogues.taunt[Math.floor(Math.random() * dialogues.taunt.length)];
    return this.replacePlaceholders(phrase, { playerName: this.playerName });
  }

  // Reseta o engine
  reset(): void {
    this.state = createInitialNarrativeState();
    this.triggeredEvents.clear();
  }
}

// ============= FUNÇÕES UTILITÁRIAS =============

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

// Verifica eventos ocultos (versão funcional)
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
    blefePerfeitoUnlocked: false,
    cartaBonusUnlocked: false,
    horusRespectUnlocked: false,
    imunidadeUnlocked: false,
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
    events: {
      blefePerfeitoUnlocked: state.blefePerfeitoUnlocked,
      cartaBonusUnlocked: state.cartaBonusUnlocked,
      horusRespectUnlocked: state.horusRespectUnlocked,
    },
  });
}

// Singleton instance para uso global
let narrativeEngineInstance: NarrativeEngine | null = null;

export function getNarrativeEngine(playerName?: string): NarrativeEngine {
  if (!narrativeEngineInstance) {
    narrativeEngineInstance = new NarrativeEngine(playerName);
  } else if (playerName) {
    narrativeEngineInstance.setPlayerName(playerName);
  }
  return narrativeEngineInstance;
}

export function resetNarrativeEngine(): void {
  narrativeEngineInstance?.reset();
  narrativeEngineInstance = null;
}

export default NarrativeEngine;
