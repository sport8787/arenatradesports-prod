// Hook for managing question narration with audio caching
// Questions are cached globally - once synthesized, available to all players

import { useState, useCallback, useRef, useEffect } from 'react';
import { Question } from '@/types/game';
import { getCachedAudio } from '@/services/audioCacheService';
import { playGlobalAudio, stopGlobalAudio } from '@/services/globalAudioContext';
import { PERSONAS } from '@/types/personas';

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
}

export function useQuestionNarration(options: UseQuestionNarrationOptions = {}): UseQuestionNarrationReturn {
  const { enabled = true, onNarrationStart, onNarrationEnd } = options;
  
  const [isNarrating, setIsNarrating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      stopGlobalAudio();
    };
  }, []);

  const narrateQuestion = useCallback(async (question: Question) => {
    if (!enabled) return;

    abortRef.current = false;
    setIsLoading(true);
    setError(null);

    try {
      // Build the full narration text including category
      const categoryIntro = `Categoria: ${question.category}. `;
      const fullText = categoryIntro + question.question_text;

      console.log('[QuestionNarration] Fetching audio for question:', question.id);

      // Use getCachedAudio - this will check cache first, then generate if needed
      // The hash is based on text + voiceId, so identical questions will share cache
      const result = await getCachedAudio({
        text: fullText,
        personaId: 'horus',
        moment: 'question_read',
      });

      if (abortRef.current) {
        console.log('[QuestionNarration] Aborted before playback');
        return;
      }

      if (!result) {
        throw new Error('Failed to get audio for question');
      }

      console.log('[QuestionNarration] Audio ready:', result.fromCache ? 'from cache' : 'freshly generated');

      setIsLoading(false);
      setIsNarrating(true);
      onNarrationStart?.();

      // Play using global audio context
      audioRef.current = playGlobalAudio(
        result.audioUrl,
        () => {
          console.log('[QuestionNarration] Narration complete');
          setIsNarrating(false);
          onNarrationEnd?.();
        },
        (err) => {
          console.error('[QuestionNarration] Playback error:', err);
          setIsNarrating(false);
          setError('Erro ao reproduzir áudio');
          onNarrationEnd?.();
        }
      );
    } catch (err) {
      console.error('[QuestionNarration] Error:', err);
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    }
  }, [enabled, onNarrationStart, onNarrationEnd]);

  const stopNarration = useCallback(() => {
    abortRef.current = true;
    stopGlobalAudio();
    setIsNarrating(false);
    setIsLoading(false);
  }, []);

  return {
    isNarrating,
    isLoading,
    narrateQuestion,
    stopNarration,
    error,
  };
}
