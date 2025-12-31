/**
 * Hook React para o Sistema Central de Fila de Áudio
 * Fornece estado reativo e métodos para controlar a fila
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  centralAudioQueue, 
  AUDIO_PRIORITY,
  clearAllAudio 
} from '@/services/centralAudioQueue';

interface AudioQueueState {
  isPlaying: boolean;
  currentLabel: string | null;
  queueLength: number;
}

export function useCentralAudioQueue() {
  const [state, setState] = useState<AudioQueueState>({
    isPlaying: false,
    currentLabel: null,
    queueLength: 0
  });

  useEffect(() => {
    const unsubscribe = centralAudioQueue.subscribe((newState) => {
      setState(newState);
    });
    
    return unsubscribe;
  }, []);

  const enqueue = useCallback((
    audioUrl: string,
    options?: {
      label?: string;
      priority?: number;
      onComplete?: () => void;
      onError?: (error: Error) => void;
      interruptCurrent?: boolean;
    }
  ) => {
    return centralAudioQueue.enqueue(audioUrl, options);
  }, []);

  const clear = useCallback(() => {
    clearAllAudio();
  }, []);

  const remove = useCallback((id: string) => {
    return centralAudioQueue.remove(id);
  }, []);

  return {
    ...state,
    enqueue,
    clear,
    remove,
    AUDIO_PRIORITY
  };
}

// Hook para cleanup automático ao desmontar
export function useAudioCleanup() {
  useEffect(() => {
    return () => {
      clearAllAudio();
    };
  }, []);
}
