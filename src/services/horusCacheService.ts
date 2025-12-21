// Horus Cache Service - Pre-caches all Horus phrases on app start
// This ZEROES ElevenLabs API calls for standard game moments
// All phrases come from Supabase Storage cache

import { getCachedAudio } from './audioCacheService';
import { 
  ROUND_START_PHRASES, 
  CORRECT_ANSWER_PHRASES, 
  WRONG_ANSWER_PHRASES,
  BLUFF_SUCCESS_PHRASES,
  BLUFF_FAIL_PHRASES,
  VICTORY_PHRASES,
  ELIMINATION_PHRASES,
  BRIEFCASE_OFFER_PHRASES,
  ALL_IN_LOSS_PHRASES,
  CASH_OUT_PHRASES,
  STREAK_PHRASES,
  COMEBACK_PHRASES
} from './horusPhrasesPool';

// Track pre-cache progress
let preCacheProgress = {
  total: 0,
  cached: 0,
  inProgress: false,
  completed: false,
};

export function getHorusCacheProgress() {
  return { ...preCacheProgress };
}

// Pre-cache all Horus fixed phrases on app start
export async function preCacheHorusPhrases(): Promise<void> {
  if (preCacheProgress.inProgress || preCacheProgress.completed) {
    console.log('[HorusCache] Pre-cache already running or completed, skipping...');
    return;
  }

  preCacheProgress.inProgress = true;
  console.log('[HorusCache] 🦅 Starting Horus pre-cache...');
  
  // Collect all phrases to cache
  const allPhrases = [
    ...ROUND_START_PHRASES,
    ...CORRECT_ANSWER_PHRASES,
    ...WRONG_ANSWER_PHRASES,
    ...BLUFF_SUCCESS_PHRASES,
    ...BLUFF_FAIL_PHRASES,
    ...VICTORY_PHRASES,
    ...ELIMINATION_PHRASES,
    ...BRIEFCASE_OFFER_PHRASES,
    ...ALL_IN_LOSS_PHRASES,
    ...CASH_OUT_PHRASES,
    ...STREAK_PHRASES,
    ...COMEBACK_PHRASES,
  ];

  preCacheProgress.total = allPhrases.length;
  console.log(`[HorusCache] 📝 ${allPhrases.length} phrases to pre-cache`);

  let cached = 0;
  let fromStorage = 0;
  let newlyGenerated = 0;
  let errors = 0;

  // Process ONE at a time to avoid rate limits (ElevenLabs limit: 5 concurrent)
  for (let i = 0; i < allPhrases.length; i++) {
    const phrase = allPhrases[i];
    
    try {
      const result = await getCachedAudio({
        text: phrase,
        personaId: 'horus',
        moment: 'round_start',
      });
      
      if (result) {
        cached++;
        if (result.fromCache) {
          fromStorage++;
          // Cache hit - no delay needed
        } else {
          newlyGenerated++;
          // API call made - wait 500ms before next request
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      preCacheProgress.cached = cached;
      
      // Log progress every 10 phrases
      if ((i + 1) % 10 === 0) {
        console.log(`[HorusCache] Progress: ${i + 1}/${allPhrases.length} (${fromStorage} from cache, ${newlyGenerated} generated)`);
      }
    } catch (error) {
      errors++;
      console.warn('[HorusCache] Error pre-caching:', phrase.substring(0, 30), error);
      // Wait longer on error (likely rate limited)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  preCacheProgress.completed = true;
  preCacheProgress.inProgress = false;
  
  console.log(`[HorusCache] ✅ Pre-cache complete!`);
  console.log(`[HorusCache] 📊 Stats: ${cached}/${allPhrases.length} cached`);
  console.log(`[HorusCache] 🟢 From Storage: ${fromStorage}`);
  console.log(`[HorusCache] 🔴 Newly Generated: ${newlyGenerated}`);
  console.log(`[HorusCache] 💰 Next session will have ${cached} phrases ready from cache!`);
}

// Reset cache progress (useful for testing)
export function resetHorusCacheProgress(): void {
  preCacheProgress = {
    total: 0,
    cached: 0,
    inProgress: false,
    completed: false,
  };
}
