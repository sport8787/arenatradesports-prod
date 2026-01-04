// Mycroft Block Service - Splits Mycroft narration into 3 cacheable parts
// INTRO (Fixed/Cached) + FACT (Dynamic/Short) + BEHAVIOR (Pool of 20 cached phrases)
// This dramatically reduces ElevenLabs credit consumption
// 
// MODULAR "LEGO" APPROACH:
// - [INTRO] = From cache (Supabase Storage)
// - [FACT] = Dynamic, MAX 150 CHARS (only part sent to ElevenLabs API)
// - [CLOSING] = From cache (Supabase Storage)

import { getCachedAudio, getRandomMycroftBehavior, getRandomMycroftIntro, MYCROFT_BEHAVIOR_POOL, MYCROFT_INTRO_PHRASES } from './audioCacheService';
import { centralAudioQueue, AUDIO_PRIORITY, clearAllAudio } from './centralAudioQueue';

// HARD LIMIT: Maximum characters for dynamic fact (matches edge function)
const MAX_DYNAMIC_CHARS = 150;

export interface MycroftVerdictBlocks {
  intro: string;       // Fixed phrase - cached
  fact: string;        // Dynamic - short text about the specific answer (MAX 150 chars)
  behavior: string;    // From pool - cached
}

// Pre-cache all Mycroft fixed phrases on app start
// CRITICAL: Uses cacheOnly=true to NEVER call ElevenLabs during pre-cache
export async function preCacheMycroftPhrases(): Promise<void> {
  console.log('[MycroftBlock] Pre-caching Mycroft phrases (cache check only, no ElevenLabs calls)...');
  
  const phrasesToCache = [
    ...MYCROFT_INTRO_PHRASES,
    ...MYCROFT_BEHAVIOR_POOL,
  ];
  
  let cached = 0;
  for (const phrase of phrasesToCache) {
    try {
      // CRITICAL: cacheOnly=true means we ONLY check if audio exists in cache
      // We NEVER call ElevenLabs during pre-cache - zero credit consumption
      const result = await getCachedAudio({
        text: phrase,
        personaId: 'mycroft',
        moment: 'verdict',
        cacheOnly: true, // ⚠️ NEVER call ElevenLabs, only check cache
      });
      if (result?.fromCache) {
        cached++;
      }
    } catch (error) {
      console.warn('[MycroftBlock] Error pre-caching:', phrase, error);
    }
  }
  
  console.log(`[MycroftBlock] Found ${cached}/${phrasesToCache.length} phrases in cache (no ElevenLabs calls made)`);
}

// Generate the 3 blocks for Mycroft verdict
// MODULAR LEGO: Only the FACT portion is dynamic and costs API credits
export function generateMycroftBlocks(
  isCorrect: boolean,
  userAnswer: string,
  correctAnswer: string,
  aiGeneratedFact?: string // Optional AI-generated fact from mycroft-ai edge function
): MycroftVerdictBlocks {
  // 1. INTRO - Fixed phrase (will be cached) - FREE
  const intro = getRandomMycroftIntro();
  
  // 2. FACT - Dynamic but HARD LIMITED to MAX_DYNAMIC_CHARS
  // This is the ONLY part that costs API credits per unique answer
  let fact: string;
  
  if (aiGeneratedFact) {
    // Use AI-generated fact, but enforce hard limit
    fact = aiGeneratedFact.length > MAX_DYNAMIC_CHARS 
      ? aiGeneratedFact.substring(0, MAX_DYNAMIC_CHARS) + '...'
      : aiGeneratedFact;
  } else {
    // Fallback: Generate locally (even shorter, no API cost)
    fact = isCorrect
      ? `Resposta "${correctAnswer.substring(0, 25)}" validada.`
      : `Erro: "${userAnswer.substring(0, 15)}" ≠ "${correctAnswer.substring(0, 15)}".`;
  }
  
  // Log credit estimate
  console.log(`💸 Créditos Estimados para FATO dinâmico: ${fact.length} caracteres (limite: ${MAX_DYNAMIC_CHARS})`);
  
  // 3. BEHAVIOR - From pool (will be cached) - FREE
  const behavior = getRandomMycroftBehavior();
  
  return { intro, fact, behavior };
}

// Validate that a fact string is within the hard limit
export function validateFactLength(fact: string): { isValid: boolean; length: number; limit: number } {
  return {
    isValid: fact.length <= MAX_DYNAMIC_CHARS,
    length: fact.length,
    limit: MAX_DYNAMIC_CHARS
  };
}

// Play Mycroft verdict in 3 sequential audio blocks via CENTRAL QUEUE
export async function playMycroftVerdictBlocks(
  blocks: MycroftVerdictBlocks,
  onComplete?: () => void,
  onBlockStart?: (blockName: 'intro' | 'fact' | 'behavior') => void
): Promise<void> {
  console.log('[MycroftBlock] Playing verdict in 3 blocks via centralQueue:', blocks);
  
  const playBlock = async (
    text: string, 
    blockName: 'intro' | 'fact' | 'behavior'
  ): Promise<void> => {
    return new Promise(async (resolve) => {
      onBlockStart?.(blockName);
      
      const result = await getCachedAudio({
        text,
        personaId: 'mycroft',
        moment: 'verdict',
      });
      
      if (!result) {
        console.warn(`[MycroftBlock] Failed to get audio for ${blockName}`);
        resolve();
        return;
      }
      
      console.log(`[MycroftBlock] Playing ${blockName}: ${result.fromCache ? '🟢 CACHE' : '🔴 API'}`);
      
      // Usa CENTRAL queue para evitar sobreposição
      centralAudioQueue.enqueue(result.audioUrl, {
        label: `mycroft_${blockName}`,
        priority: AUDIO_PRIORITY.MYCROFT,
        onComplete: () => {
          setTimeout(resolve, 150); // Small gap between blocks
        },
        onError: () => {
          resolve(); // Continue even on error
        }
      });
    });
  };
  
  // Play blocks sequentially
  await playBlock(blocks.intro, 'intro');
  await playBlock(blocks.fact, 'fact');
  await playBlock(blocks.behavior, 'behavior');
  
  console.log('[MycroftBlock] All blocks complete');
  onComplete?.();
}

// Get full verdict text (for display purposes)
export function getFullVerdictText(blocks: MycroftVerdictBlocks): string {
  return `${blocks.intro} ${blocks.fact} ${blocks.behavior}`;
}

// Stop any playing Mycroft audio
export function stopMycroftAudio(): void {
  clearAllAudio();
}
