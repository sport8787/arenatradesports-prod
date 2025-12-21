// AI Personas for the game - Hórus (Presenter) and Mycroft (Analyst)

export type PersonaId = 'horus' | 'mycroft';

export interface VoiceSettings {
  stability: number;
  similarityBoost: number;
}

export interface Persona {
  id: PersonaId;
  name: string;
  title: string;
  voiceId: string; // ElevenLabs voice ID
  voiceSettings: VoiceSettings;
  systemPrompt: string;
  description: string;
  icon: 'eye' | 'monocle';
}

export const PERSONAS: Record<PersonaId, Persona> = {
  horus: {
    id: 'horus',
    name: 'HÓRUS',
    title: 'O Apresentador',
    voiceId: 'nPczCjzI2devNBz1zQrb', // Brian - deep, authoritative voice (similar to Adan)
    voiceSettings: {
      stability: 0.5,
      similarityBoost: 0.75,
    },
    systemPrompt: `Você é o Hórus, o faraó vivo e mestre de cerimônias deste Game Show. Sua missão é entreter e desestabilizar. Use bordões como 'A caçada começou', 'A maleta te chama' ou 'Eu vejo a verdade sob sua máscara'. Seja imponente e sarcástico. Suas falas devem ser teatrais, provocadoras e cheias de personalidade. Você adora criar tensão e drama.`,
    description: 'Imponente e sarcástico. Comanda o palco com carisma.',
    icon: 'eye',
  },
  mycroft: {
    id: 'mycroft',
    name: 'MYCROFT',
    title: 'O Especialista',
    voiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel - cold, analytical voice
    voiceSettings: {
      stability: 0.85, // 85% stability as requested
      similarityBoost: 0.9,
    },
    systemPrompt: `Você é o Mycroft, uma IA analítica especializada em microexpressões e padrões de fraude. Você é frio e direto. Suas frases devem começar com termos como 'Protocolo de Análise concluído', 'Probabilidade calculada' ou 'Desvio de padrão detectado'. Sem emoções, apenas dados. Seja breve e técnico.`,
    description: 'Frio e analítico. Só fala quando há dados a analisar.',
    icon: 'monocle',
  },
};

// Game moments and which persona should speak
export type GameMoment =
  | 'round_start'
  | 'question_read'
  | 'correct_answer'
  | 'wrong_answer'
  | 'bluff_success'
  | 'bluff_fail'
  | 'all_in'
  | 'all_in_loss' // Player lost on All-in round
  | 'briefcase_offer'
  | 'briefcase_open'
  | 'briefcase_refuse'
  | 'elimination'
  | 'victory'
  | 'taunt'
  | 'waiting'
  | 'voting_start'
  | 'verdict'
  | 'all_in_temptation' // Special moment for All-in vs Maleta decision
  | 'bribe_offer' // Hórus offer after Mycroft verdict
  | 'bribe_intro' // Frase fixa cacheável: intro do acordo
  | 'bribe_value' // Valor dinâmico do acordo (curto, ~15-20 créditos)
  | 'bribe_outro' // Frase fixa cacheável: "Pega ou larga?"
  | 'special_challenge' // Desafios especiais de alto risco
  | 'jury_deliberation' // Quando o júri está votando
  | 'post_vote_bribe' // Oferta após votação, antes do resultado
  | 'comeback' // Jogador se recuperando
  | 'streak' // Sequência de vitórias
  | 'cash_out' // Quando o jogador aceita sair com o prêmio
  | 'round_transition' // Transição entre rodadas
  | 'player_timeout' // Jogador demorou para responder
  | 'thinking_taunt' // Provocação enquanto jogador pensa
  | 'answer_confirm'; // Confirmação de resposta (Mycroft)

export interface DialogConfig {
  moment: GameMoment;
  persona: PersonaId;
  useLiveAI: boolean; // true = generate dynamically, false = use cached phrase
}

// Dialog rules - which persona speaks at each moment
export const DIALOG_RULES: DialogConfig[] = [
  { moment: 'round_start', persona: 'horus', useLiveAI: false },
  { moment: 'question_read', persona: 'horus', useLiveAI: false },
  { moment: 'correct_answer', persona: 'horus', useLiveAI: false },
  { moment: 'wrong_answer', persona: 'horus', useLiveAI: false },
  { moment: 'bluff_success', persona: 'horus', useLiveAI: false },
  { moment: 'bluff_fail', persona: 'horus', useLiveAI: false },
  { moment: 'all_in', persona: 'horus', useLiveAI: true }, // Live AI for dramatic moment
  { moment: 'all_in_loss', persona: 'horus', useLiveAI: false }, // Pre-recorded loss phrases
  { moment: 'all_in_temptation', persona: 'horus', useLiveAI: true }, // Live AI for temptation
  { moment: 'briefcase_offer', persona: 'horus', useLiveAI: false },
  { moment: 'briefcase_open', persona: 'horus', useLiveAI: false },
  { moment: 'briefcase_refuse', persona: 'horus', useLiveAI: false },
  { moment: 'elimination', persona: 'horus', useLiveAI: false },
  { moment: 'victory', persona: 'horus', useLiveAI: false },
  { moment: 'taunt', persona: 'horus', useLiveAI: false },
  { moment: 'waiting', persona: 'horus', useLiveAI: false },
  { moment: 'voting_start', persona: 'horus', useLiveAI: false },
  { moment: 'verdict', persona: 'mycroft', useLiveAI: true }, // Live AI for analysis
  { moment: 'bribe_offer', persona: 'horus', useLiveAI: false }, // Pre-recorded offer phrases
  { moment: 'bribe_intro', persona: 'horus', useLiveAI: false }, // Cacheável: "Seu destino já está selado..."
  { moment: 'bribe_value', persona: 'horus', useLiveAI: false }, // Dinâmico curto: "X BluffCoins"
  { moment: 'bribe_outro', persona: 'horus', useLiveAI: false }, // Cacheável: "Pega ou larga?"
  { moment: 'special_challenge', persona: 'horus', useLiveAI: false },
  { moment: 'jury_deliberation', persona: 'horus', useLiveAI: false },
  { moment: 'post_vote_bribe', persona: 'horus', useLiveAI: false },
  { moment: 'comeback', persona: 'horus', useLiveAI: false },
  { moment: 'streak', persona: 'horus', useLiveAI: false },
  { moment: 'cash_out', persona: 'horus', useLiveAI: false },
];

export function getDialogConfig(moment: GameMoment): DialogConfig {
  return DIALOG_RULES.find(r => r.moment === moment) || DIALOG_RULES[0];
}

export function getPersona(id: PersonaId): Persona {
  return PERSONAS[id];
}

// Generate temptation phrase for All-in vs Maleta decision
export function generateTemptationContext(playerName: string, currentScore: number, briefcaseValue: number): string {
  return `O jogador ${playerName} está com ${currentScore} pontos. A maleta oferece ${briefcaseValue} pontos garantidos. Gere uma frase de tentação questionando se o jogador prefere a segurança da maleta ou o risco do All-in. Seja teatral e provocador.`;
}
