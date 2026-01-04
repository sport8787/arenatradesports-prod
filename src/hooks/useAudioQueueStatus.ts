import { useState, useEffect } from 'react';
import { centralAudioQueue, clearAllAudio } from '@/services/centralAudioQueue';

/**
 * Hook para observar o estado da fila de áudio centralizada.
 * Útil para sincronizar UI com estado de reprodução (ex: Mycroft só anima quando não há áudio).
 */
export function useAudioQueueStatus() {
  const [isPlaying, setIsPlaying] = useState(centralAudioQueue.getIsPlaying());

  useEffect(() => {
    // Subscribe para mudanças de estado
    const unsubscribe = centralAudioQueue.subscribe((state) => {
      setIsPlaying(state.isPlaying);
    });

    return unsubscribe;
  }, []);

  return {
    isPlaying,
    enqueue: centralAudioQueue.enqueue.bind(centralAudioQueue),
    clearQueue: clearAllAudio,
    getQueueLength: centralAudioQueue.getQueueLength.bind(centralAudioQueue),
  };
}
