/**
 * Hórus 2.0 Engine - Sistema de Áudio Híbrido
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
import { playGlobalAudio, stopGlobalAudio } from './globalAudioContext';

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

// Estado interno do engine
let currentAudio: HTMLAudioElement | null = null;
let isPlaying = false;

/**
 * Para qualquer áudio em reprodução
 */
export function stopHorus2Audio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  stopGlobalAudio();
  isPlaying = false;
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
export async function playHorus2Audio(
  moment: GameMoment | string,
  dynamicText?: string,
  onEnd?: () => void,
  onError?: (error: Error) => void
): Promise<void> {
  // Para áudio anterior
  stopHorus2Audio();
  
  try {
    const result = await getHorus2Audio(moment, dynamicText);
    
    if (!result) {
      console.warn('[Hórus 2.0] No audio available for moment:', moment);
      onEnd?.();
      return;
    }
    
    isPlaying = true;
    
    // Usa playGlobalAudio para consistência com o resto do sistema
    currentAudio = playGlobalAudio(
      result.audioUrl,
      () => {
        isPlaying = false;
        currentAudio = null;
        onEnd?.();
      },
      (error) => {
        isPlaying = false;
        currentAudio = null;
        onError?.(error);
      }
    );
    
    console.log('[Hórus 2.0] Playing audio from', result.source, ':', result.audioUrl);
  } catch (error) {
    console.error('[Hórus 2.0] Error playing audio:', error);
    isPlaying = false;
    onError?.(error instanceof Error ? error : new Error(String(error)));
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
 * Verifica se está reproduzindo áudio
 */
export function isHorus2Playing(): boolean {
  return isPlaying;
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
