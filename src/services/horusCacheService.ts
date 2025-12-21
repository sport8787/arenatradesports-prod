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

// Pre-cache all Horus fixed phrases - ONLY CALLED MANUALLY or when entering game room
// This checks Supabase Storage but does NOT call ElevenLabs if audio exists
export async function preCacheHorusPhrases(): Promise<void> {
  if (preCacheProgress.inProgress || preCacheProgress.completed) {
    console.log('[HorusCache] Pre-cache already running or completed, skipping...');
    return;
  }

  preCacheProgress.inProgress = true;
  console.log('[HorusCache] 🦅 Starting Horus pre-cache (checking storage only, NO ElevenLabs calls if cached)...');
  
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
  console.log(`[HorusCache] 📝 ${allPhrases.length} phrases to check in storage`);

  let cached = 0;

  // Process ONE at a time - CHECK CACHE ONLY, never call ElevenLabs
  for (let i = 0; i < allPhrases.length; i++) {
    const phrase = allPhrases[i];
    
    try {
      // CRITICAL: cacheOnly=true means we ONLY check if audio exists in cache
      // We NEVER call ElevenLabs during pre-cache - zero credit consumption
      const result = await getCachedAudio({
        text: phrase,
        personaId: 'horus',
        moment: 'round_start',
        cacheOnly: true, // ⚠️ NEVER call ElevenLabs, only check cache
      });
      
      if (result) {
        cached++;
        // Cache hit - loaded into memory for fast playback
      }
      // Note: With cacheOnly=true, result is null if not in cache
      // No ElevenLabs calls are made - zero credit consumption
      
      preCacheProgress.cached = cached;
      
      // Log progress every 20 phrases
      if ((i + 1) % 20 === 0) {
        console.log(`[HorusCache] Progress: ${i + 1}/${allPhrases.length} (${cached} found in cache)`);
      }
    } catch (error) {
      console.warn('[HorusCache] Error checking cache:', phrase.substring(0, 30), error);
    }
  }

  preCacheProgress.completed = true;
  preCacheProgress.inProgress = false;
  
  console.log(`[HorusCache] ✅ Pre-cache complete!`);
  console.log(`[HorusCache] 📊 Stats: ${cached}/${allPhrases.length} found in cache`);
  console.log(`[HorusCache] 💰 ZERO ElevenLabs calls - pre-cache only loads from storage`);
  console.log(`[HorusCache] ℹ️ Audio not in cache will be generated on-demand during gameplay`);
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
