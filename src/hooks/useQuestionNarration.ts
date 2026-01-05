// Hook for managing question narration with audio caching
// Questions are cached globally - once synthesized, available to all players
// + Web Speech API fallback when ElevenLabs fails

import { useState, useCallback, useRef, useEffect } from 'react';
import { Question } from '@/types/game';
import { getCachedAudio } from '@/services/audioCacheService';
import { centralAudioQueue, AUDIO_PRIORITY, clearAllAudio } from '@/services/centralAudioQueue';
import { speakWithQueue, isWebSpeechSupported } from '@/services/webSpeechFallbackService';

interface UseQuestionNarrationOptions {
  enabled?: boolean;
  onNarrationStart?: () => void;
  onNarrationEnd?: () => void;
}

interface UseQuestionNarrationReturn {
  isNarrating: boolean;
  isLoading: boolean;
  narrateQuestion: (question: Question) => Promise<void>;
  stopNarration: () => void;
  error: string | null;
  usedFallback: boolean;
}

export function useQuestionNarration(options: UseQuestionNarrationOptions = {}): UseQuestionNarrationReturn {
  const { enabled = true, onNarrationStart, onNarrationEnd } = options;
  
  const [isNarrating, setIsNarrating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallback, setUsedFallback] = useState(false);
  const abortRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      clearAllAudio();
    };
  }, []);

  const narrateQuestion = useCallback(async (question: Question) => {
    if (!enabled) return;

    abortRef.current = false;
    setIsLoading(true);
    setError(null);
    setUsedFallback(false);

    try {
      // Build the full narration text including category
      const categoryIntro = `Categoria: ${question.category}. `;
      const fullText = categoryIntro + question.question_text;

      console.log('[QuestionNarration] Fetching audio for question:', question.id);

      // Use getCachedAudio - this will check cache first, then generate if needed
      const result = await getCachedAudio({
        text: fullText,
        personaId: 'horus',
        moment: 'question_read',
      });

      if (abortRef.current) {
        console.log('[QuestionNarration] Aborted before playback');
        return;
      }

      // Check if we got a Web Speech fallback marker
      if (result?.audioUrl.startsWith('webspeech://')) {
        console.log('[QuestionNarration] 🔄 Using Web Speech fallback');
        setIsLoading(false);
        setIsNarrating(true);
        setUsedFallback(true);
        onNarrationStart?.();

        await speakWithQueue(
          fullText,
          'horus',
          AUDIO_PRIORITY.QUESTION_READ,
          `question_${question.id}_fallback`,
          () => {
            console.log('[QuestionNarration] Fallback narration complete');
            setIsNarrating(false);
            onNarrationEnd?.();
          }
        );
        return;
      }

      if (!result) {
        // No audio and no fallback available
        if (isWebSpeechSupported()) {
          console.log('[QuestionNarration] 🔄 Direct Web Speech fallback');
          setIsLoading(false);
          setIsNarrating(true);
          setUsedFallback(true);
          onNarrationStart?.();

          await speakWithQueue(
            fullText,
            'horus',
            AUDIO_PRIORITY.QUESTION_READ,
            `question_${question.id}_fallback`,
            () => {
              setIsNarrating(false);
              onNarrationEnd?.();
            }
          );
          return;
        }
        
        throw new Error('Failed to get audio for question');
      }

      console.log('[QuestionNarration] Audio ready:', result.fromCache ? 'from cache' : 'freshly generated');

      setIsLoading(false);
      setIsNarrating(true);
      onNarrationStart?.();

      // Play using CENTRAL audio queue
      centralAudioQueue.enqueue(result.audioUrl, {
        label: `question_${question.id}`,
        priority: AUDIO_PRIORITY.QUESTION_READ,
        onComplete: () => {
          console.log('[QuestionNarration] Narration complete');
          setIsNarrating(false);
          onNarrationEnd?.();
        },
        onError: (err) => {
          console.error('[QuestionNarration] Playback error:', err);
          setIsNarrating(false);
          setError('Erro ao reproduzir áudio');
          onNarrationEnd?.();
        }
      });
    } catch (err) {
      console.error('[QuestionNarration] Error:', err);
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [enabled, onNarrationStart, onNarrationEnd]);

  const stopNarration = useCallback(() => {
    abortRef.current = true;
    clearAllAudio();
    setIsNarrating(false);
    setIsLoading(false);
  }, []);

  return {
    isNarrating,
    isLoading,
    narrateQuestion,
    stopNarration,
    error,
    usedFallback,
  };
}
