// AI Personas for the game - Hórus (Presenter) and Mycroft (Analyst)

export type PersonaId = 'horus' | 'mycroft';

export interface Persona {
  id: PersonaId;
  name: string;
  title: string;
  voiceId: string; // ElevenLabs voice ID
  description: string;
  icon: 'pharaoh' | 'analyst';
}

export const PERSONAS: Record<PersonaId, Persona> = {
  horus: {
    id: 'horus',
    name: 'HÓRUS',
    title: 'O Apresentador',
    voiceId: 'JBFqnCBsd6RMkjVDRZzb', // George - deep, authoritative voice
    description: 'Imponente e sarcástico. Comanda o palco com carisma.',
    icon: 'pharaoh',
  },
  mycroft: {
    id: 'mycroft',
    name: 'MYCROFT',
    title: 'O Especialista',
    voiceId: 'onwK4e9ZLuTAKqWW03F9', // Daniel - analytical, calm voice
    description: 'Frio e analítico. Só fala quando há dados a analisar.',
    icon: 'analyst',
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
  | 'briefcase_offer'
  | 'briefcase_open'
  | 'briefcase_refuse'
  | 'elimination'
  | 'victory'
  | 'taunt'
  | 'waiting'
  | 'voting_start'
  | 'verdict'; // Mycroft's analysis

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
  { moment: 'briefcase_offer', persona: 'horus', useLiveAI: false },
  { moment: 'briefcase_open', persona: 'horus', useLiveAI: false },
  { moment: 'briefcase_refuse', persona: 'horus', useLiveAI: false },
  { moment: 'elimination', persona: 'horus', useLiveAI: false },
  { moment: 'victory', persona: 'horus', useLiveAI: false },
  { moment: 'taunt', persona: 'horus', useLiveAI: false },
  { moment: 'waiting', persona: 'horus', useLiveAI: false },
  { moment: 'voting_start', persona: 'horus', useLiveAI: false },
  { moment: 'verdict', persona: 'mycroft', useLiveAI: true }, // Live AI for analysis
];

export function getDialogConfig(moment: GameMoment): DialogConfig {
  return DIALOG_RULES.find(r => r.moment === moment) || DIALOG_RULES[0];
}

export function getPersona(id: PersonaId): Persona {
  return PERSONAS[id];
}
