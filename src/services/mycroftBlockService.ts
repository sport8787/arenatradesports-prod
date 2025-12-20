// Mycroft Block Service - Splits Mycroft narration into 3 cacheable parts
// INTRO (Fixed/Cached) + FACT (Dynamic/Short) + BEHAVIOR (Pool of 20 cached phrases)
// This dramatically reduces ElevenLabs credit consumption

import { getCachedAudio, getRandomMycroftBehavior, getRandomMycroftIntro, MYCROFT_BEHAVIOR_POOL, MYCROFT_INTRO_PHRASES } from './audioCacheService';
import { playGlobalAudio, stopGlobalAudio } from './globalAudioContext';

export interface MycroftVerdictBlocks {
  intro: string;       // Fixed phrase - cached
  fact: string;        // Dynamic - short text about the specific answer
  behavior: string;    // From pool - cached
}

// Pre-cache all Mycroft fixed phrases on app start
export async function preCacheMycroftPhrases(): Promise<void> {
  console.log('[MycroftBlock] Pre-caching Mycroft phrases...');
  
  const phrasesToCache = [
    ...MYCROFT_INTRO_PHRASES,
    ...MYCROFT_BEHAVIOR_POOL,
  ];
  
  let cached = 0;
  for (const phrase of phrasesToCache) {
    try {
      const result = await getCachedAudio({
        text: phrase,
        personaId: 'mycroft',
        moment: 'verdict',
      });
      if (result?.fromCache) {
        cached++;
      }
    } catch (error) {
      console.warn('[MycroftBlock] Error pre-caching:', phrase, error);
    }
  }
  
  console.log(`[MycroftBlock] Pre-cached ${cached}/${phrasesToCache.length} phrases`);
}

// Generate the 3 blocks for Mycroft verdict
export function generateMycroftBlocks(
  isCorrect: boolean,
  userAnswer: string,
  correctAnswer: string
): MycroftVerdictBlocks {
  // 1. INTRO - Fixed phrase (will be cached)
  const intro = getRandomMycroftIntro();
  
  // 2. FACT - Dynamic but SHORT (10-15 words max)
  // This is the ONLY part that costs API credits per unique answer
  const fact = isCorrect
    ? `Resposta correta confirmada: ${correctAnswer.substring(0, 30)}.`
    : `Erro detectado. Você disse ${userAnswer.substring(0, 20)}, mas era ${correctAnswer.substring(0, 20)}.`;
  
  // 3. BEHAVIOR - From pool (will be cached)
  const behavior = getRandomMycroftBehavior();
  
  return { intro, fact, behavior };
}

// Play Mycroft verdict in 3 sequential audio blocks
export async function playMycroftVerdictBlocks(
  blocks: MycroftVerdictBlocks,
  onComplete?: () => void,
  onBlockStart?: (blockName: 'intro' | 'fact' | 'behavior') => void
): Promise<void> {
  console.log('[MycroftBlock] Playing verdict in 3 blocks:', blocks);
  
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
      
      playGlobalAudio(
        result.audioUrl,
        () => {
          setTimeout(resolve, 200); // Small gap between blocks
        },
        () => {
          resolve(); // Continue even on error
        }
      );
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
  stopGlobalAudio();
}
