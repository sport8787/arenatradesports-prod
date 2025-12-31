import { useEffect, useCallback } from 'react';
import { useNarrativeOptional } from '@/contexts/NarrativeContext';
import { getActPhraseText, getSilentObserverPhrase } from '@/data/horusActPhrases';
import { playHorus2Audio } from '@/services/horus2Engine';
import { checkAndTriggerSilentObserver } from '@/services/silentObserverService';
import { toast } from '@/hooks/use-toast';

interface UseNarrativeIntegrationOptions {
  currentRound: number;
  playerName?: string;
  onSilentObserver?: (phrase: string) => void;
}

/**
 * Hook to integrate NarrativeEngine with game logic
 * 
 * This hook provides:
 * - Automatic Horus phrase selection based on current act
 * - Round advancement with correct/wrong tracking
 * - Hidden event triggers (Silent Observer with ElevenLabs TTS)
 * - Pressure level and timer configuration
 */
export function useNarrativeIntegration(options: UseNarrativeIntegrationOptions) {
  const { currentRound, playerName = 'Jogador', onSilentObserver } = options;
  const narrative = useNarrativeOptional();

  // Sync narrative round with game round
  useEffect(() => {
    if (!narrative) return;
    
    // Only sync if rounds are different (avoid loops)
    if (narrative.state.currentRound !== currentRound && currentRound > 0) {
      // The narrative engine advances on its own via advanceRound
      // This is just for logging/debugging
      console.log(`[NarrativeIntegration] Round sync: game=${currentRound}, narrative=${narrative.state.currentRound}`);
    }
  }, [currentRound, narrative]);

  // Handle answer result and advance narrative
  const handleAnswerResult = useCallback(async (wasCorrect: boolean) => {
    if (!narrative) return;
    
    // Advance the narrative state
    narrative.advanceRound(wasCorrect);
    
    // Get appropriate phrase for the current act
    const act = narrative.currentAct;
    const trigger = wasCorrect ? 'correct' : 'wrong';
    const phrase = getActPhraseText(act.id, trigger);
    
    if (phrase) {
      console.log(`[NarrativeIntegration] Playing ${act.id} ${trigger} phrase: ${phrase}`);
      // Play the phrase using Horus audio engine
      playHorus2Audio(wasCorrect ? 'correct_answer' : 'wrong_answer', phrase);
    }
    
    // Check for Silent Observer event (5 consecutive correct)
    if (wasCorrect && narrative.state.consecutiveCorrect === 4) {
      // Will trigger on next state update (becomes 5)
      setTimeout(async () => {
        const result = await checkAndTriggerSilentObserver(
          5,
          playerName,
          () => {
            console.log('[NarrativeIntegration] Silent Observer audio completed');
          }
        );
        
        if (result.triggered) {
          onSilentObserver?.(result.phrase);
        }
      }, 2500);
    }
  }, [narrative, playerName, onSilentObserver]);

  // Get act-specific phrase for a trigger
  const getHorusActPhrase = useCallback((trigger: 'correct' | 'wrong' | 'bluff_success' | 'transition' | 'taunt' | 'opening') => {
    if (!narrative) return '';
    return getActPhraseText(narrative.currentAct.id, trigger);
  }, [narrative]);

  // Play act-specific audio
  const playActPhrase = useCallback((trigger: 'correct' | 'wrong' | 'bluff_success' | 'transition' | 'taunt' | 'opening') => {
    if (!narrative) return;
    
    const phrase = getActPhraseText(narrative.currentAct.id, trigger);
    if (phrase) {
      // Map triggers to audio moments
      const momentMap: Record<string, string> = {
        correct: 'correct_answer',
        wrong: 'wrong_answer',
        bluff_success: 'bluff_success',
        transition: 'round_transition',
        taunt: 'taunt',
        opening: 'opening',
      };
      
      playHorus2Audio(momentMap[trigger] || 'taunt', phrase);
    }
  }, [narrative]);

  // Reset narrative for new game
  const resetNarrativeForNewGame = useCallback(() => {
    narrative?.resetNarrative();
  }, [narrative]);

  return {
    // Narrative state
    narrativeState: narrative?.state ?? null,
    currentAct: narrative?.currentAct ?? null,
    timerDuration: narrative?.timerDuration ?? 30,
    timerVisible: narrative?.timerVisible ?? true,
    pressureLevel: narrative?.pressureLevel ?? 0,
    isClimaxRound: narrative?.isClimaxRound ?? false,
    isFinalChoice: narrative?.isFinalChoice ?? false,
    
    // Actions
    handleAnswerResult,
    getHorusActPhrase,
    playActPhrase,
    resetNarrativeForNewGame,
    advanceRound: narrative?.advanceRound,
    triggerBombEvent: narrative?.triggerBombEvent,
    
    // Helpers
    isEnabled: !!narrative,
  };
}
