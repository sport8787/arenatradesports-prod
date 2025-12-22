// Hórus Local Audio Service
// Manages pre-recorded audio files for Hórus narration
// Uses local files instead of ElevenLabs API for faster, cheaper playback

import { GameMoment } from '@/types/personas';

// Audio file mappings - maps moment types to available audio files
export const HORUS_AUDIO_FILES: Record<string, string[]> = {
  // Abertura / Round start
  abertura: [
    '/audio/horus/abertura.mp3',
    '/audio/horus/abertura2.mp3',
    '/audio/horus/abertura3.mp3',
    '/audio/horus/abertura4.mp3',
  ],
  
  // Acordo / Bribe offer (usado em vez de "suborno")
  acordo: [
    '/audio/horus/acordo.mp3',
    '/audio/horus/acordo2.mp3',
    '/audio/horus/acordo3.mp3',
    '/audio/horus/acordo4.mp3',
    '/audio/horus/acordo5.mp3',
    '/audio/horus/acordo6.mp3',
    '/audio/horus/acordo7.mp3',
    '/audio/horus/acordo8.mp3',
    '/audio/horus/acordo9.mp3',
  ],
  
  // All-in
  all_in: [
    '/audio/horus/all_in.mp3',
    '/audio/horus/all_in_2.mp3',
    '/audio/horus/all_in_3.mp3',
    '/audio/horus/all_in_4.mp3',
  ],
  
  // Bordões / Taunts
  bordao: [
    '/audio/horus/bordao.mp3',
    '/audio/horus/bordao_1.mp3',
    '/audio/horus/bordao_2.mp3',
    '/audio/horus/bordao_3.mp3',
    '/audio/horus/bordao_4.mp3',
    '/audio/horus/bordao_5.mp3',
    '/audio/horus/bordao_6.mp3',
    '/audio/horus/bordao_7.mp3',
  ],
  
  // Derrota / Defeat
  derrota: [
    '/audio/horus/derrota.mp3',
    '/audio/horus/derrota2.mp3',
  ],
  
  // Eliminação / Elimination
  eliminacao: [
    '/audio/horus/eliminacao.mp3',
    '/audio/horus/eliminacao2.mp3',
  ],
  
  // Erro / Wrong answer
  erro: [
    '/audio/horus/erro.mp3',
    '/audio/horus/erro2.mp3',
    '/audio/horus/erro3.mp3',
    '/audio/horus/erro4.mp3',
    '/audio/horus/erro5.mp3',
  ],
  
  // Mycroft - para quando jogador confirma resposta
  mycroft: [
    '/audio/horus/mycroft.mp3',
    '/audio/horus/mycroft2.mp3',
  ],
  
  // Vitória / Victory
  vitoria: [
    '/audio/horus/vitoria.mp3',
    '/audio/horus/vitoria2.mp3',
    '/audio/horus/vitoria3.mp3',
    '/audio/horus/vitoria4.mp3',
  ],
};

// Mapping from GameMoment to audio category
export const MOMENT_TO_AUDIO_CATEGORY: Partial<Record<GameMoment, string>> = {
  'round_start': 'abertura',
  'bribe_offer': 'acordo',
  'bribe_intro': 'acordo',
  'post_vote_bribe': 'acordo',
  'all_in': 'all_in',
  'all_in_temptation': 'all_in',
  'taunt': 'bordao',
  'waiting': 'bordao',
  'round_transition': 'bordao',
  'player_timeout': 'bordao',
  'thinking_taunt': 'bordao',
  'bluff_fail': 'derrota',
  'all_in_loss': 'derrota',
  'elimination': 'derrota',
  'wrong_answer': 'erro',
  'victory': 'vitoria',
  'cash_out': 'vitoria',
  'bluff_success': 'vitoria',
  'correct_answer': 'vitoria',
  'answer_confirm': 'mycroft',
};

// Get a random audio file for a specific category
export function getRandomAudioFile(category: string): string | null {
  const files = HORUS_AUDIO_FILES[category];
  if (!files || files.length === 0) return null;
  return files[Math.floor(Math.random() * files.length)];
}

// Get audio file for a specific game moment
export function getAudioForMoment(moment: GameMoment): string | null {
  const category = MOMENT_TO_AUDIO_CATEGORY[moment];
  if (!category) return null;
  return getRandomAudioFile(category);
}

// Get random Mycroft audio - for when player confirms answer
export function getMycroftAudio(): string {
  const files = HORUS_AUDIO_FILES.mycroft;
  return files[Math.floor(Math.random() * files.length)];
}

// Check if a moment has local audio available
export function hasLocalAudio(moment: GameMoment): boolean {
  const category = MOMENT_TO_AUDIO_CATEGORY[moment];
  if (!category) return false;
  const files = HORUS_AUDIO_FILES[category];
  return files && files.length > 0;
}

// Get all available categories
export function getAvailableCategories(): string[] {
  return Object.keys(HORUS_AUDIO_FILES);
}

// Get total count of audio files
export function getTotalAudioFiles(): number {
  return Object.values(HORUS_AUDIO_FILES).reduce((total, files) => total + files.length, 0);
}

// Preload audio files for faster playback
export function preloadAudioFiles(categories?: string[]): void {
  const categoriesToPreload = categories || Object.keys(HORUS_AUDIO_FILES);
  
  categoriesToPreload.forEach(category => {
    const files = HORUS_AUDIO_FILES[category];
    if (files) {
      files.forEach(file => {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.src = file;
      });
    }
  });
}

// Play audio file with callback
export function playHorusAudio(
  audioPath: string,
  onEnded?: () => void,
  onError?: (error: Error) => void
): HTMLAudioElement {
  const audio = new Audio(audioPath);
  
  if (onEnded) {
    audio.addEventListener('ended', onEnded);
  }
  
  if (onError) {
    audio.addEventListener('error', () => {
      onError(new Error(`Failed to play audio: ${audioPath}`));
    });
  }
  
  audio.play().catch(error => {
    console.error('Error playing Horus audio:', error);
    if (onError) onError(error);
  });
  
  return audio;
}

// Play random audio for a game moment
export function playMomentAudio(
  moment: GameMoment,
  onEnded?: () => void,
  onError?: (error: Error) => void
): HTMLAudioElement | null {
  const audioPath = getAudioForMoment(moment);
  if (!audioPath) {
    console.warn(`No local audio available for moment: ${moment}`);
    return null;
  }
  return playHorusAudio(audioPath, onEnded, onError);
}

// Play random Mycroft audio (for answer confirmation)
export function playMycroftAudio(
  onEnded?: () => void,
  onError?: (error: Error) => void
): HTMLAudioElement {
  const audioPath = getMycroftAudio();
  return playHorusAudio(audioPath, onEnded, onError);
}
