// Audio Cache Service - Manages ElevenLabs TTS caching via Supabase Storage
// Reduces credit consumption by caching frequently used phrases

import { supabase } from '@/integrations/supabase/client';
import { PersonaId, PERSONAS, GameMoment, getDialogConfig } from '@/types/personas';

// Simple hash function for generating cache keys
async function generateHash(text: string, voiceId: string): Promise<string> {
  const data = `${voiceId}:${text}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.substring(0, 32); // Use first 32 chars for shorter filename
}

// Moments that should always be cached (static phrases)
const CACHEABLE_MOMENTS: GameMoment[] = [
  'round_start',
  'question_read', // Questions are now cached globally
  'correct_answer',
  'wrong_answer',
  'bluff_success',
  'bluff_fail',
  'briefcase_offer',
  'briefcase_open',
  'briefcase_refuse',
  'elimination',
  'victory',
  'taunt',
  'waiting',
  'voting_start',
  'bribe_offer',
  'special_challenge',
  'jury_deliberation',
  'post_vote_bribe',
  'comeback',
  'streak',
  'cash_out',
  'all_in_loss',
];

// Mycroft fixed introductions that can be cached
const MYCROFT_CACHEABLE_PHRASES = [
  'Protocolo de análise concluído',
  'Análise em processamento',
  'Desvio de padrão detectado',
  'Probabilidade calculada',
  'Verificação biométrica iniciada',
];

interface CacheResult {
  audioUrl: string;
  fromCache: boolean;
}

interface GetCachedAudioOptions {
  text: string;
  personaId: PersonaId;
  moment?: GameMoment;
  forceRefresh?: boolean;
  isHost?: boolean; // For Presencial mode
  gameMode?: string;
}

// In-memory cache for session
const memoryCache = new Map<string, string>();

export async function getCachedAudio(options: GetCachedAudioOptions): Promise<CacheResult | null> {
  const { 
    text, 
    personaId, 
    moment, 
    forceRefresh = false,
    isHost = true,
    gameMode = 'single'
  } = options;

  // In Presencial mode, only Host should generate/play audio
  if (gameMode === 'presencial' && !isHost) {
    console.log('[AudioCache] Skipping audio - not host in Presencial mode');
    return null;
  }

  const persona = PERSONAS[personaId];
  const voiceId = persona.voiceId;

  // Determine if this should be cached
  const shouldCache = shouldCacheAudio(personaId, moment, text);
  
  // Generate hash for cache key
  const hash = await generateHash(text, voiceId);
  const cacheFileName = `${hash}.mp3`;

  console.log('[AudioCache] Request:', { 
    text: text.substring(0, 50), 
    personaId, 
    moment, 
    shouldCache,
    hash: hash.substring(0, 8)
  });

  // Check memory cache first (fastest)
  if (!forceRefresh && memoryCache.has(hash)) {
    console.log('[AudioCache] Memory cache hit');
    return { audioUrl: memoryCache.get(hash)!, fromCache: true };
  }

  // Check Supabase Storage cache
  if (shouldCache && !forceRefresh) {
    try {
      const { data: existingFile } = await supabase.storage
        .from('audio-cache')
        .list('', { search: cacheFileName });

      if (existingFile && existingFile.length > 0) {
        const { data: { publicUrl } } = supabase.storage
          .from('audio-cache')
          .getPublicUrl(cacheFileName);
        
        console.log('[AudioCache] Storage cache hit:', publicUrl);
        memoryCache.set(hash, publicUrl);
        return { audioUrl: publicUrl, fromCache: true };
      }
    } catch (error) {
      console.warn('[AudioCache] Error checking cache:', error);
    }
  }

  // Generate new audio via ElevenLabs
  try {
    console.log('[AudioCache] Generating new audio via ElevenLabs');
    
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ 
          text, 
          voiceId,
          stability: persona.voiceSettings.stability,
          similarityBoost: persona.voiceSettings.similarityBoost,
          // Tell edge function to cache if applicable
          cacheKey: shouldCache ? cacheFileName : undefined,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`TTS error: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    
    // If response is JSON, it contains the cached URL
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      if (data.audioUrl) {
        memoryCache.set(hash, data.audioUrl);
        console.log('[AudioCache] Audio cached and returned:', data.audioUrl);
        return { audioUrl: data.audioUrl, fromCache: false };
      }
    }

    // Otherwise, it's a direct audio blob
    const audioBlob = await response.blob();
    if (audioBlob.size === 0) {
      throw new Error('Empty audio blob');
    }

    const audioUrl = URL.createObjectURL(audioBlob);
    memoryCache.set(hash, audioUrl);
    console.log('[AudioCache] Audio generated (not cached):', audioBlob.size, 'bytes');
    
    return { audioUrl, fromCache: false };
  } catch (error) {
    console.error('[AudioCache] Error generating audio:', error);
    return null;
  }
}

function shouldCacheAudio(personaId: PersonaId, moment?: GameMoment, text?: string): boolean {
  // Horus: Cache all standard phrases (non-dynamic moments)
  if (personaId === 'horus') {
    if (moment && CACHEABLE_MOMENTS.includes(moment)) {
      return true;
    }
    // Don't cache dynamic AI-generated content
    const config = moment ? getDialogConfig(moment) : null;
    if (config?.useLiveAI) {
      return false;
    }
    return true;
  }

  // Mycroft: Only cache fixed introductions
  if (personaId === 'mycroft') {
    if (!text) return false;
    
    // Check if the text starts with a cacheable phrase
    return MYCROFT_CACHEABLE_PHRASES.some(phrase => 
      text.toLowerCase().startsWith(phrase.toLowerCase())
    );
  }

  return false;
}

// Clear memory cache (useful for testing/debugging)
export function clearAudioMemoryCache(): void {
  memoryCache.forEach((url) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  });
  memoryCache.clear();
  console.log('[AudioCache] Memory cache cleared');
}

// Pre-cache common phrases for faster first-time playback
export async function preCacheCommonPhrases(): Promise<void> {
  console.log('[AudioCache] Pre-caching common phrases...');
  
  // This could be called on app initialization to warm up the cache
  // Implementation would iterate through common phrases and call getCachedAudio
  // For now, caching happens on-demand
}
