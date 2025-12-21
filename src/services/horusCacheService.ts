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

  // Process in batches of 3 to avoid overwhelming the API
  const batchSize = 3;
  for (let i = 0; i < allPhrases.length; i += batchSize) {
    const batch = allPhrases.slice(i, i + batchSize);
    
    const results = await Promise.allSettled(
      batch.map(async (phrase) => {
        try {
          const result = await getCachedAudio({
            text: phrase,
            personaId: 'horus',
            moment: 'round_start', // Generic moment for caching purposes
          });
          
          if (result) {
            cached++;
            if (result.fromCache) {
              fromStorage++;
            } else {
              newlyGenerated++;
            }
          }
          
          preCacheProgress.cached = cached;
          return result;
        } catch (error) {
          console.warn('[HorusCache] Error pre-caching:', phrase.substring(0, 30), error);
          return null;
        }
      })
    );

    // Small delay between batches to be gentle on the API
    if (i + batchSize < allPhrases.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
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
