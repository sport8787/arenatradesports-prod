// Hook for Hórus narration with audio caching
// Manages all Hórus speech during the game climax moments

import { useState, useCallback, useRef, useEffect } from 'react';
import { getCachedAudio } from '@/services/audioCacheService';
import { centralAudioQueue, AUDIO_PRIORITY, clearAllAudio } from '@/services/centralAudioQueue';
import { GameMoment } from '@/types/personas';

// Fixed phrases that should always be cached (used in climax moments)
export const HORUS_CLIMAX_PHRASES = {
  // Acordo de Ouro - shown when player is bluffing
  ACORDO_OURO: 'Seu destino já está selado, mas eu tenho um Acordo de Ouro para você. Pega ou larga?',
  
  // Maleta Final - All-in round (15)
  MALETA_FINAL: 'Esta é sua última chance. A Maleta Final te aguarda, ou você arrisca tudo no All-in?',
  
  // Recusa - player clicked "REVELAR DESTINO" and lost
  RECUSA_DERROTA: 'Poxa, que pena! Você errou a pergunta. Deveria ter aceitado a Maleta Misteriosa... agora, sai de mãos vazias.',
  
  // All-in loss - sarcastic mockery
  ALL_IN_TRIPUDIO: 'A ganância é uma armadilha mortal! Você apostou tudo e perdeu TUDO. Deveria ter aceitado minha oferta!',
  
  // Victory - player won
  VITORIA_REVELADA: 'Inacreditável! Você acertou! A verdade estava do seu lado o tempo todo!',
  
  // Bluff success after rejection
  BLEFE_SUCEDIDO: 'Você tinha razão em confiar na sua mentira! O júri caiu como patinhos!',
};

type HorusClimaxMoment = keyof typeof HORUS_CLIMAX_PHRASES;

interface UseHorusNarrationOptions {
  enabled?: boolean;
  onNarrationStart?: () => void;
  onNarrationEnd?: () => void;
}

interface UseHorusNarrationReturn {
  isNarrating: boolean;
  isLoading: boolean;
  currentPhrase: string | null;
  narrateClimaxMoment: (moment: HorusClimaxMoment) => Promise<void>;
  narrateCustomPhrase: (phrase: string, moment?: GameMoment) => Promise<void>;
  stopNarration: () => void;
  error: string | null;
}

export function useHorusNarration(options: UseHorusNarrationOptions = {}): UseHorusNarrationReturn {
  const { enabled = true, onNarrationStart, onNarrationEnd } = options;
  
  const [isNarrating, setIsNarrating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      clearAllAudio();
    };
  }, []);

  const narrateClimaxMoment = useCallback(async (moment: HorusClimaxMoment) => {
    if (!enabled) return;

    const phrase = HORUS_CLIMAX_PHRASES[moment];
    if (!phrase) {
      console.error('[HorusNarration] Unknown climax moment:', moment);
      return;
    }

    abortRef.current = false;
    setIsLoading(true);
    setError(null);
    setCurrentPhrase(phrase);

    try {
      console.log('[HorusNarration] Fetching cached audio for:', moment);

      // Map climax moments to game moments for caching
      const gameMoment: GameMoment = moment.includes('ALL_IN') 
        ? 'all_in_loss' 
        : moment.includes('VITORIA') 
          ? 'victory' 
          : 'post_vote_bribe';

      const result = await getCachedAudio({
        text: phrase,
        personaId: 'horus',
        moment: gameMoment,
      });

      if (abortRef.current) {
        console.log('[HorusNarration] Aborted before playback');
        setIsLoading(false);
        return;
      }

      if (!result) {
        throw new Error('Failed to get audio');
      }

      console.log('[HorusNarration] Audio ready:', result.fromCache ? 'from cache' : 'freshly generated');

      setIsLoading(false);
      setIsNarrating(true);
      onNarrationStart?.();

      // Use CENTRAL queue
      centralAudioQueue.enqueue(result.audioUrl, {
        label: `horus_${moment}`,
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
        onComplete: () => {
          console.log('[HorusNarration] Narration complete');
          setIsNarrating(false);
          setCurrentPhrase(null);
          onNarrationEnd?.();
        },
        onError: (err) => {
          console.error('[HorusNarration] Playback error:', err);
          setIsNarrating(false);
          setError('Erro ao reproduzir áudio');
          onNarrationEnd?.();
        }
      });
    } catch (err) {
      console.error('[HorusNarration] Error:', err);
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      // Still trigger callback even on error
      onNarrationEnd?.();
    }
  }, [enabled, onNarrationStart, onNarrationEnd]);

  const narrateCustomPhrase = useCallback(async (phrase: string, moment: GameMoment = 'taunt') => {
    if (!enabled) return;

    abortRef.current = false;
    setIsLoading(true);
    setError(null);
    setCurrentPhrase(phrase);

    try {
      console.log('[HorusNarration] Fetching cached audio for custom phrase');

      const result = await getCachedAudio({
        text: phrase,
        personaId: 'horus',
        moment,
      });

      if (abortRef.current) {
        setIsLoading(false);
        return;
      }

      if (!result) {
        throw new Error('Failed to get audio');
      }

      setIsLoading(false);
      setIsNarrating(true);
      onNarrationStart?.();

      // Use CENTRAL queue
      centralAudioQueue.enqueue(result.audioUrl, {
        label: `horus_custom`,
        priority: AUDIO_PRIORITY.HORUS_DIALOGUE,
        onComplete: () => {
          setIsNarrating(false);
          setCurrentPhrase(null);
          onNarrationEnd?.();
        },
        onError: (err) => {
          console.error('[HorusNarration] Playback error:', err);
          setIsNarrating(false);
          setError('Erro ao reproduzir áudio');
          onNarrationEnd?.();
        }
      });
    } catch (err) {
      console.error('[HorusNarration] Error:', err);
      setIsLoading(false);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      onNarrationEnd?.();
    }
  }, [enabled, onNarrationStart, onNarrationEnd]);

  const stopNarration = useCallback(() => {
    abortRef.current = true;
    clearAllAudio();
    setIsNarrating(false);
    setIsLoading(false);
    setCurrentPhrase(null);
  }, []);

  return {
    isNarrating,
    isLoading,
    currentPhrase,
    narrateClimaxMoment,
    narrateCustomPhrase,
    stopNarration,
    error,
  };
}
