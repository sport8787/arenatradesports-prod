// Hook for preloading audio for upcoming questions in background
// Eliminates delay by fetching audio ahead of time

import { useCallback, useRef, useEffect } from 'react';
import { Question } from '@/types/game';
import { getCachedAudio } from '@/services/audioCacheService';

interface UseQuestionAudioPreloaderOptions {
  enabled?: boolean;
  preloadCount?: number; // How many questions to preload (default: 3)
}

// Get difficulty for a given round
const getDifficultyForRound = (round: number): 'Easy' | 'Medium' | 'Hard' => {
  if (round <= 5) return 'Easy';
  if (round <= 10) return 'Medium';
  return 'Hard';
};

// Build narration text for a question
const buildNarrationText = (question: Question): string => {
  return `Categoria: ${question.category}. ${question.question_text}`;
};

export function useQuestionAudioPreloader(options: UseQuestionAudioPreloaderOptions = {}) {
  const { enabled = true, preloadCount = 3 } = options;
  
  // Cache of preloaded audio URLs by question ID
  const preloadCache = useRef<Map<string, string>>(new Map());
  
  // Track currently preloading questions to avoid duplicates
  const preloadingSet = useRef<Set<string>>(new Set());
  
  // Track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Preload audio for a single question (silently in background)
  const preloadQuestionAudio = useCallback(async (question: Question): Promise<void> => {
    if (!enabled) return;
    
    // Skip if already preloaded or currently preloading
    if (preloadCache.current.has(question.id) || preloadingSet.current.has(question.id)) {
      return;
    }

    preloadingSet.current.add(question.id);
    
    try {
      const text = buildNarrationText(question);
      
      console.log('[QuestionPreloader] Preloading audio for question:', question.id.substring(0, 8));
      
      const result = await getCachedAudio({
        text,
        personaId: 'horus',
        moment: 'question_read',
        cacheOnly: true,
      });

      if (result && isMounted.current) {
        preloadCache.current.set(question.id, result.audioUrl);
        console.log('[QuestionPreloader] Preloaded:', question.id.substring(0, 8), result.fromCache ? '(cached)' : '(new)');
      }
    } catch (error) {
      console.warn('[QuestionPreloader] Failed to preload:', question.id.substring(0, 8), error);
    } finally {
      preloadingSet.current.delete(question.id);
    }
  }, [enabled]);

  // Preload audio for multiple upcoming questions based on current round
  const preloadUpcomingQuestions = useCallback((
    questions: Question[],
    usedQuestionIds: Set<string>,
    currentRound: number
  ): void => {
    if (!enabled || questions.length === 0) return;

    // Calculate which rounds to preload for
    const roundsToPreload: number[] = [];
    for (let i = 1; i <= preloadCount; i++) {
      const nextRound = currentRound + i;
      if (nextRound <= 15) {
        roundsToPreload.push(nextRound);
      }
    }

    console.log('[QuestionPreloader] Preloading for rounds:', roundsToPreload);

    // Get questions for each upcoming round
    const questionsToPreload: Question[] = [];
    const usedForPreload = new Set<string>();
    
    for (const round of roundsToPreload) {
      const difficulty = getDifficultyForRound(round);
      
      // Find available questions for this difficulty
      const availableForDifficulty = questions.filter(
        q => !usedQuestionIds.has(q.id) && 
             !usedForPreload.has(q.id) &&
             q.difficulty === difficulty &&
             !preloadCache.current.has(q.id) &&
             !preloadingSet.current.has(q.id)
      );

      if (availableForDifficulty.length > 0) {
        // Pick a random one to preload
        const randomIndex = Math.floor(Math.random() * availableForDifficulty.length);
        const selected = availableForDifficulty[randomIndex];
        questionsToPreload.push(selected);
        usedForPreload.add(selected.id);
      }
    }

    // Preload all in parallel (silently, fire and forget)
    questionsToPreload.forEach(q => {
      preloadQuestionAudio(q);
    });
  }, [enabled, preloadCount, preloadQuestionAudio]);

  // Get preloaded audio URL for a question (if available)
  const getPreloadedAudio = useCallback((questionId: string): string | null => {
    return preloadCache.current.get(questionId) || null;
  }, []);

  // Check if audio is preloaded for a question
  const isPreloaded = useCallback((questionId: string): boolean => {
    return preloadCache.current.has(questionId);
  }, []);

  // Clear preload cache
  const clearPreloadCache = useCallback(() => {
    preloadCache.current.clear();
    preloadingSet.current.clear();
    console.log('[QuestionPreloader] Cache cleared');
  }, []);

  return {
    preloadQuestionAudio,
    preloadUpcomingQuestions,
    getPreloadedAudio,
    isPreloaded,
    clearPreloadCache,
  };
}
