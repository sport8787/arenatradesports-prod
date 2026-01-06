/**
 * Hórus 2.0 Engine - Sistema de Áudio Híbrido
 * 
 * USA FILA CENTRALIZADA v2.0 (centralAudioQueue)
 * Garante que apenas UM áudio toque por vez em toda a aplicação.
 * 
 * Prioridades:
 * 1. LOCAL: Arquivos MP3 gravados em /public/audio/horus/ (custo zero)
 * 2. CACHE: Cache SHA-256 no Supabase Storage (88.3% eficiência)
 * 3. API: ElevenLabs Turbo/Flash para perguntas inéditas
 * 
 * Voz: Callum v3 com entonação "Husky Trickster"
 */

import { GameMoment } from '@/types/personas';
import { 
  HORUS_AUDIO_FILES, 
  MOMENT_TO_AUDIO_CATEGORY, 
  getRandomAudioFile,
  hasLocalAudio 
} from './horusLocalAudio';
import { getCachedAudio } from './audioCacheService';
import { 
  centralAudioQueue, 
  AUDIO_PRIORITY,
  clearAllAudio 
} from './centralAudioQueue';

// Callum v3 voice ID (ElevenLabs)
export const CALLUM_VOICE_ID = 'N2lVS1w4EtoT3dr4eOWO';

// Husky Trickster voice settings for dynamic content
export const HUSKY_TRICKSTER_SETTINGS = {
  stability: 0.35,        // Mais expressivo/variável
  similarityBoost: 0.85,  // Mantém características da voz
  style: 0.65,            // Estilizado para tom provocador
  useSpeakerBoost: true,
  speed: 1.05,            // Ligeiramente mais rápido
};

// Mapeamento de momentos para categorias de áudio local
export const MOMENT_AUDIO_MAP: Record<string, string> = {
  // Abertura / Início
  'round_start': 'abertura',
  'game_start': 'abertura',
  
  // Erro na resposta
  'wrong_answer': 'erro',
  'bluff_fail': 'erro',
  
  // Acordo de Ouro / Proposta
  'bribe_offer': 'acordo',
  'bribe_intro': 'acordo',
  'post_vote_bribe': 'acordo',
  
  // Vitória / Acerto
  'victory': 'vitoria',
  'cash_out': 'vitoria',
  'bluff_success': 'vitoria',
  'correct_answer': 'vitoria',
  
  // Eliminação / Derrota
  'elimination': 'derrota',
  'all_in_loss': 'derrota',
  
  // All-in
  'all_in': 'all_in',
  'all_in_temptation': 'all_in',
  
  // Bordões / Taunts (inclui novos momentos)
  'taunt': 'bordao',
  'waiting': 'bordao',
  'round_transition': 'bordao',
  'player_timeout': 'bordao',
  'thinking_taunt': 'bordao',
  
  // Mycroft (confirmação de resposta)
  'answer_confirm': 'mycroft',
};

// Estado de abertura - garante que a leitura da pergunta espera a abertura terminar
let isOpeningPlaying = false;
let openingEndedCallbacks: Array<() => void> = [];

/**
 * Verifica se a abertura está tocando
 */
export function isOpeningInProgress(): boolean {
  return isOpeningPlaying;
}

/**
 * Registra callback para quando a abertura terminar
 * Se não houver abertura tocando, executa imediatamente
 */
export function onOpeningEnded(callback: () => void): void {
  if (!isOpeningPlaying) {
    callback();
  } else {
    openingEndedCallbacks.push(callback);
  }
}

/**
 * Marca início da abertura
 */
function markOpeningStart(): void {
  console.log('[Hórus 2.0] Opening audio STARTED');
  isOpeningPlaying = true;
}

/**
 * Marca fim da abertura e executa callbacks pendentes
 */
function markOpeningEnd(): void {
  console.log('[Hórus 2.0] Opening audio ENDED, executing', openingEndedCallbacks.length, 'pending callbacks');
  isOpeningPlaying = false;
  const callbacks = [...openingEndedCallbacks];
  openingEndedCallbacks = [];
  callbacks.forEach(cb => cb());
}

/**
 * Para qualquer áudio em reprodução (limpa a fila global)
 */
export function stopHorus2Audio(): void {
  clearAllAudio();
}

/**
 * Verifica se há áudio local disponível para o momento
 */
export function hasLocalAudioForMoment(moment: GameMoment | string): boolean {
  const category = MOMENT_AUDIO_MAP[moment] || MOMENT_TO_AUDIO_CATEGORY[moment as GameMoment];
  if (!category) return false;
  
  const files = HORUS_AUDIO_FILES[category];
  return files && files.length > 0;
}

/**
 * Obtém um arquivo de áudio local aleatório para o momento
 */
export function getLocalAudioForMoment(moment: GameMoment | string): string | null {
  const category = MOMENT_AUDIO_MAP[moment] || MOMENT_TO_AUDIO_CATEGORY[moment as GameMoment];
  if (!category) return null;
  
  return getRandomAudioFile(category);
}

/**
 * Interface para resultado do áudio
 */
export interface Horus2AudioResult {
  audioUrl: string;
  source: 'local' | 'cache' | 'api';
  category?: string;
}

/**
 * Obtém áudio para um momento do jogo usando o sistema híbrido
 * 
 * @param moment - Momento do jogo (ex: 'round_start', 'victory', 'erro')
 * @param dynamicText - Texto dinâmico para TTS (opcional, usado apenas se não houver local)
 * @returns Promise com URL do áudio e fonte
 */
export async function getHorus2Audio(
  moment: GameMoment | string,
  dynamicText?: string
): Promise<Horus2AudioResult | null> {
  console.log('[Hórus 2.0] Getting audio for moment:', moment);
  
  // PRIORIDADE 1: Áudio local gravado
  const localAudio = getLocalAudioForMoment(moment);
  if (localAudio) {
    console.log('[Hórus 2.0] ✓ Using LOCAL audio:', localAudio);
    return {
      audioUrl: localAudio,
      source: 'local',
      category: MOMENT_AUDIO_MAP[moment] || MOMENT_TO_AUDIO_CATEGORY[moment as GameMoment],
    };
  }
  
  // Sem texto dinâmico e sem áudio local = sem áudio
  if (!dynamicText) {
    console.log('[Hórus 2.0] No local audio and no dynamic text for:', moment);
    return null;
  }
  
  // PRIORIDADE 2 & 3: Cache SHA-256 ou ElevenLabs API
  try {
    console.log('[Hórus 2.0] Checking cache/API for:', moment);
    const result = await getCachedAudio({
      text: dynamicText,
      personaId: 'horus',
      moment: moment as GameMoment,
    });
    
    if (result) {
      console.log('[Hórus 2.0] ✓ Using', result.fromCache ? 'CACHE' : 'API', 'audio');
      return {
        audioUrl: result.audioUrl,
        source: result.fromCache ? 'cache' : 'api',
      };
    }
  } catch (error) {
    console.error('[Hórus 2.0] Error getting cached/API audio:', error);
  }
  
  return null;
}

/**
 * Reproduz áudio para um momento do jogo
 * 
 * @param moment - Momento do jogo
 * @param dynamicText - Texto dinâmico (opcional)
 * @param onEnd - Callback quando áudio terminar
 * @param onError - Callback em caso de erro
 */
/**
 * Reproduz áudio para um momento do jogo USANDO A FILA CENTRALIZADA
 * 
 * @param moment - Momento do jogo
 * @param dynamicText - Texto dinâmico (opcional)
 * @param onEnd - Callback quando áudio terminar
 * @param onError - Callback em caso de erro (ignorado na nova implementação)
 */
export async function playHorus2Audio(
  moment: GameMoment | string,
  dynamicText?: string,
  onEnd?: () => void,
  _onError?: (error: Error) => void
): Promise<void> {
  // Detecta tipo de áudio para definir prioridade
  const isOpeningAudio = moment === 'game_start' || moment === 'round_start';
  const isQuestionRead = moment === 'question_read';
  const isBordao = moment === 'taunt' || moment === 'thinking_taunt' || moment === 'waiting';
  const isBombEvent = moment === 'bomb_event';
  
  try {
    const result = await getHorus2Audio(moment, dynamicText);
    
    if (!result) {
      console.warn('[Hórus 2.0] No audio available for moment:', moment);
      onEnd?.();
      return;
    }
    
    // Marca início da abertura
    if (isOpeningAudio) {
      markOpeningStart();
    }
    
    // Determinar prioridade usando o novo sistema
    let priority: number = AUDIO_PRIORITY.HORUS_DIALOGUE;
    let label = `horus_${moment}`;
    
    if (isBombEvent) {
      priority = AUDIO_PRIORITY.BOMB_EVENT;
      label = 'bomb_event';
    } else if (isQuestionRead) {
      priority = AUDIO_PRIORITY.QUESTION_READ;
      label = 'question_read';
    } else if (isOpeningAudio) {
      priority = AUDIO_PRIORITY.NARRATIVE_EVENT;
      label = 'opening';
    } else if (isBordao) {
      priority = AUDIO_PRIORITY.BORDAO;
      label = 'bordao';
    }
    
    // ✅ USAR enqueueExternal para integração com fila central
    centralAudioQueue.enqueueExternal(
      result.audioUrl,
      'horus',
      priority,
      () => {
        // Marca fim da abertura e executa callbacks pendentes
        if (isOpeningAudio) {
          markOpeningEnd();
        }
        onEnd?.();
      }
    );
    
    console.log('[Hórus 2.0] Queued audio from', result.source, ':', result.audioUrl, `(${label}, priority: ${priority})`);
  } catch (error) {
    console.error('[Hórus 2.0] Error queuing audio:', error);
    
    // Mesmo com erro, marca fim da abertura
    if (isOpeningAudio) {
      markOpeningEnd();
    }
    
    onEnd?.();
  }
}

/**
 * Reproduz áudio Mycroft (confirmação de resposta)
 */
export async function playMycroftConfirmation(
  onEnd?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  return playHorus2Audio('answer_confirm', undefined, onEnd, onError);
}

/**
 * Reproduz bordão aleatório (taunt)
 */
export async function playRandomBordao(
  onEnd?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  return playHorus2Audio('taunt', undefined, onEnd, onError);
}

/**
 * Verifica se está reproduzindo áudio (usa fila global)
 */
export function isHorus2Playing(): boolean {
  return centralAudioQueue.getIsPlaying();
}

/**
 * Pré-carrega áudios locais para reprodução mais rápida
 */
export function preloadLocalAudios(): void {
  console.log('[Hórus 2.0] Preloading local audios...');
  
  Object.values(HORUS_AUDIO_FILES).forEach(files => {
    files.forEach(file => {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = file;
    });
  });
  
  console.log('[Hórus 2.0] Preload initiated for', Object.values(HORUS_AUDIO_FILES).flat().length, 'files');
}

/**
 * Estatísticas do engine
 */
export function getHorus2Stats(): {
  localFilesCount: number;
  categories: string[];
  momentsWithLocal: string[];
} {
  const categories = Object.keys(HORUS_AUDIO_FILES);
  const localFilesCount = Object.values(HORUS_AUDIO_FILES).flat().length;
  const momentsWithLocal = Object.keys(MOMENT_AUDIO_MAP).filter(
    m => hasLocalAudioForMoment(m)
  );
  
  return {
    localFilesCount,
    categories,
    momentsWithLocal,
  };
}
