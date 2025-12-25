// Audio Cache Service - Manages ElevenLabs TTS caching via Supabase Storage
// Reduces credit consumption by caching frequently used phrases
// OPTIMIZED: Added session-level deduplication, text normalization, and debug logging

import { supabase } from '@/integrations/supabase/client';
import { PersonaId, PERSONAS, GameMoment, getDialogConfig } from '@/types/personas';

import { safeHash } from '@/lib/hashUtils';

// Simple hash function for generating cache keys
async function generateHash(text: string, voiceId: string): Promise<string> {
  // CRITICAL: Normalize text before hashing to prevent duplicate cache entries
  const normalizedText = text.trim().toLowerCase();
  const data = `${voiceId}:${normalizedText}`;
  return safeHash(data);
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

// Mycroft behavior phrases pool (cached - 20 phrases)
export const MYCROFT_BEHAVIOR_POOL = [
  'Sinais indicam insegurança na voz.',
  'Padrão vocal consistente detectado.',
  'Microexpressões faciais neutras.',
  'Frequência cardíaca elevada identificada.',
  'Tom de voz indica confiança genuína.',
  'Hesitação detectada nas pausas.',
  'Linguagem corporal defensiva.',
  'Padrão de respiração alterado.',
  'Contato visual inconsistente.',
  'Gestos indicam nervosismo.',
  'Ritmo de fala acelerado.',
  'Pitch vocal estável.',
  'Sudorese detectada.',
  'Movimentos repetitivos observados.',
  'Postura indica desconforto.',
  'Dilatação pupilar anormal.',
  'Padrão de piscadas irregular.',
  'Tensão muscular facial.',
  'Modulação vocal artificial.',
  'Comportamento evasivo identificado.',
];

// Mycroft intro phrases (fixed - cached)
export const MYCROFT_INTRO_PHRASES = [
  'Protocolo 402 concluído.',
  'Análise biométrica finalizada.',
  'Escaneamento neural completo.',
  'Verificação de padrões encerrada.',
  'Protocolo de detecção ativo.',
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
  cacheOnly?: boolean; // true = never call ElevenLabs (only memory/storage hits)
  isHost?: boolean; // For Presencial mode
  gameMode?: string;
}

// In-memory cache for session
const memoryCache = new Map<string, string>();

// SESSION-LEVEL DEDUPLICATION: Track all requests made this session to prevent duplicate API calls
const sessionRequestLog = new Set<string>();

// RE-RENDER LOCK: Track lastSynthesizedText to block duplicate API calls from re-renders
let lastSynthesizedText: string | null = null;
let lastSynthesizedHash: string | null = null;

// Debug statistics
let cacheHits = 0;
let cacheMisses = 0;
let blockedDuplicates = 0;
let estimatedCreditsSaved = 0;

export function getAudioCacheStats() {
  return { 
    cacheHits, 
    cacheMisses, 
    blockedDuplicates,
    estimatedCreditsSaved,
    sessionRequests: sessionRequestLog.size, 
    memoryCacheSize: memoryCache.size 
  };
}

function isSilentDebugEnabled(): boolean {
  // Default ON (safety): set localStorage.blefador_silent_debug = '0' to disable
  try {
    return localStorage.getItem('blefador_silent_debug') !== '0';
  } catch {
    return true;
  }
}

function isAllowedInSilentDebug(moment?: GameMoment): boolean {
  // Only allow paid generation for the current question narration and Mycroft verdict
  return moment === 'question_read' || moment === 'verdict';
}

export async function getCachedAudio(options: GetCachedAudioOptions): Promise<CacheResult | null> {
  const { 
    text, 
    personaId, 
    moment, 
    forceRefresh = false,
    cacheOnly = false,
    isHost = true,
    gameMode = 'single'
  } = options;

  const silentDebug = isSilentDebugEnabled();
  const effectiveCacheOnly = cacheOnly || (silentDebug && !isAllowedInSilentDebug(moment));

  // In Presencial mode, only Host should generate/play audio
  if (gameMode === 'presencial' && !isHost) {
    console.log('[AudioCache] Skipping audio - not host in Presencial mode');
    return null;
  }

  const persona = PERSONAS[personaId];
  const voiceId = persona.voiceId;

  // CRITICAL: Normalize text for consistent hashing
  const normalizedText = text.trim();

  // 💸 CREDIT MONITOR: Log estimated credits for this speech
  console.log(`💸 Créditos Estimados para esta fala: ${normalizedText.length} caracteres`);

  // Determine if this should be cached
  const shouldCache = shouldCacheAudio(personaId, moment, normalizedText);
  
  // Generate hash for cache key (uses normalized text internally)
  const hash = await generateHash(normalizedText, voiceId);
  const cacheFileName = `${hash}.mp3`;

  // ⛔ RE-RENDER LOCK: Block if EXACT same text was just synthesized
  if (lastSynthesizedText === normalizedText || lastSynthesizedHash === hash) {
    blockedDuplicates++;
    estimatedCreditsSaved += normalizedText.length;
    console.log(`⛔ BLOQUEADO (RE-RENDER): Texto idêntico ao último sintetizado. Créditos salvos: ${normalizedText.length}`);
    if (memoryCache.has(hash)) {
      return { audioUrl: memoryCache.get(hash)!, fromCache: true };
    }
    return null;
  }

  // SESSION-LEVEL DEDUPLICATION: Block if EXACT same text was already requested
  if (sessionRequestLog.has(hash) && memoryCache.has(hash)) {
    cacheHits++;
    estimatedCreditsSaved += normalizedText.length;
    console.log(`🟢 CACHE HIT (SESSION BLOCK): ${cacheFileName} - Text: "${normalizedText.substring(0, 40)}..." | Créditos salvos: ${normalizedText.length}`);
    return { audioUrl: memoryCache.get(hash)!, fromCache: true };
  }

  // Check memory cache first (fastest)
  if (!forceRefresh && memoryCache.has(hash)) {
    cacheHits++;
    console.log(`🟢 CACHE HIT (MEMORY): ${cacheFileName} - Text: "${normalizedText.substring(0, 40)}..."`);
    sessionRequestLog.add(hash);
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
        
        cacheHits++;
        console.log(`🟢 CACHE HIT (STORAGE): ${cacheFileName} - Text: "${normalizedText.substring(0, 40)}..."`);
        memoryCache.set(hash, publicUrl);
        sessionRequestLog.add(hash);
        return { audioUrl: publicUrl, fromCache: true };
      }
    } catch (error) {
      console.warn('[AudioCache] Error checking cache:', error);
    }
  }

  // CACHE-ONLY MODE: never call ElevenLabs (used by preloaders and silent-debug to avoid credit burn)
  if (effectiveCacheOnly) {
    const reason = cacheOnly ? 'cacheOnly=true' : 'modo silencioso (debug)';
    console.log(`[AudioCache] 🧊 CACHE-ONLY MISS (${reason}): Bloqueando ElevenLabs para "${normalizedText.substring(0, 40)}..."`);
    return null;
  }

  // Generate new audio via ElevenLabs
  cacheMisses++;
  console.warn(`⚠️ TENTANDO GASTAR CRÉDITOS COM O TEXTO: ${normalizedText}`);
  console.log(`🔴 CACHE MISS: Chamando ElevenLabs - Text: "${normalizedText.substring(0, 40)}..." (${normalizedText.length} chars)`);
  console.log(`💸 CUSTO API: ${normalizedText.length} caracteres serão cobrados`);
  
  // Update re-render lock BEFORE making API call
  lastSynthesizedText = normalizedText;
  lastSynthesizedHash = hash;

  try {
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
          text: normalizedText, 
          voiceId,
          stability: persona.voiceSettings.stability,
          similarityBoost: persona.voiceSettings.similarityBoost,
          style: persona.voiceSettings.style,
          useSpeakerBoost: persona.voiceSettings.useSpeakerBoost,
          speed: persona.voiceSettings.speed,
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
        sessionRequestLog.add(hash);
        console.log(`🟡 AUDIO GENERATED & CACHED: ${cacheFileName}`);
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
    sessionRequestLog.add(hash);
    console.log(`🟡 AUDIO GENERATED (BLOB): ${audioBlob.size} bytes`);
    
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

  // Mycroft: Cache fixed introductions and behavior phrases
  if (personaId === 'mycroft') {
    if (!text) return false;
    
    const lowerText = text.toLowerCase();
    
    // Check if text is from intro pool
    if (MYCROFT_INTRO_PHRASES.some(phrase => lowerText.includes(phrase.toLowerCase()))) {
      return true;
    }
    
    // Check if text is from behavior pool
    if (MYCROFT_BEHAVIOR_POOL.some(phrase => lowerText.includes(phrase.toLowerCase()))) {
      return true;
    }
    
    // Check legacy cacheable phrases
    return MYCROFT_CACHEABLE_PHRASES.some(phrase => 
      lowerText.startsWith(phrase.toLowerCase())
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
  sessionRequestLog.clear();
  lastSynthesizedText = null;
  lastSynthesizedHash = null;
  cacheHits = 0;
  cacheMisses = 0;
  blockedDuplicates = 0;
  estimatedCreditsSaved = 0;
  console.log('[AudioCache] Memory cache, session log, and re-render lock cleared');
}

// Pre-cache common phrases for faster first-time playback
export async function preCacheCommonPhrases(): Promise<void> {
  console.log('[AudioCache] Pre-caching common phrases...');
  
  // This could be called on app initialization to warm up the cache
  // Implementation would iterate through common phrases and call getCachedAudio
  // For now, caching happens on-demand
}

// Get a random phrase from Mycroft behavior pool
export function getRandomMycroftBehavior(): string {
  return MYCROFT_BEHAVIOR_POOL[Math.floor(Math.random() * MYCROFT_BEHAVIOR_POOL.length)];
}

// Get a random Mycroft intro
export function getRandomMycroftIntro(): string {
  return MYCROFT_INTRO_PHRASES[Math.floor(Math.random() * MYCROFT_INTRO_PHRASES.length)];
}
