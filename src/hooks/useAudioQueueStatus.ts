import { useState, useEffect } from 'react';
import { audioQueue } from '@/services/audioQueueManager';

/**
 * Hook para observar o estado da fila de áudio centralizada.
 * Útil para sincronizar UI com estado de reprodução (ex: Mycroft só anima quando não há áudio).
 */
export function useAudioQueueStatus() {
  const [isPlaying, setIsPlaying] = useState(audioQueue.getIsPlaying());

  useEffect(() => {
    // Subscribe para mudanças de estado
    const unsubscribe = audioQueue.subscribe((playing) => {
      setIsPlaying(playing);
    });

    return unsubscribe;
  }, []);

  return {
    isPlaying,
    addToQueue: audioQueue.addToQueue.bind(audioQueue),
    clearQueue: audioQueue.clearQueue.bind(audioQueue),
    getQueueLength: audioQueue.getQueueLength.bind(audioQueue),
  };
}
