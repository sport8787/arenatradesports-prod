import { useRef, useCallback, useState } from 'react';

interface AudioQueueItem {
  id: string;
  generateAudio: () => Promise<string | null>;
  onComplete?: () => void;
  priority: number;
}

interface UseAudioQueueReturn {
  enqueue: (item: Omit<AudioQueueItem, 'id'>) => string;
  isPlaying: boolean;
  currentItemId: string | null;
  clear: () => void;
  waitForComplete: (itemId: string) => Promise<void>;
}

/**
 * Centralized audio queue to prevent audio overlap.
 * Items are played in order, respecting priority.
 * Higher priority items are played first.
 */
export function useAudioQueue(): UseAudioQueueReturn {
  const queueRef = useRef<AudioQueueItem[]>([]);
  const isProcessingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const waitingPromisesRef = useRef<Map<string, { resolve: () => void; reject: (err: Error) => void }[]>>(new Map());

  const generateId = () => `audio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;
    
    // Sort by priority (higher first)
    queueRef.current.sort((a, b) => b.priority - a.priority);
    
    const item = queueRef.current.shift()!;
    setCurrentItemId(item.id);
    setIsPlaying(true);

    try {
      const audioUrl = await item.generateAudio();

      if (audioUrl) {
        // Stop any current audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            console.log('[AudioQueue] Audio ended:', item.id);
            resolve();
          };
          audio.onerror = (e) => {
            console.error('[AudioQueue] Audio error:', e);
            reject(new Error('Audio playback error'));
          };
          
          audio.play().catch((err) => {
            console.error('[AudioQueue] Play error:', err);
            // Fallback: wait 4 seconds then continue
            setTimeout(resolve, 4000);
          });
        });
      } else {
        // No audio generated, wait a bit then continue
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('[AudioQueue] Error processing item:', error);
    } finally {
      // Call onComplete callback
      if (item.onComplete) {
        try {
          item.onComplete();
        } catch (e) {
          console.error('[AudioQueue] onComplete error:', e);
        }
      }

      // Resolve any waiting promises for this item
      const waiters = waitingPromisesRef.current.get(item.id);
      if (waiters) {
        waiters.forEach(w => w.resolve());
        waitingPromisesRef.current.delete(item.id);
      }

      setCurrentItemId(null);
      setIsPlaying(false);
      isProcessingRef.current = false;

      // Process next item after a small delay
      setTimeout(() => processQueue(), 300);
    }
  }, []);

  const enqueue = useCallback((item: Omit<AudioQueueItem, 'id'>): string => {
    const id = generateId();
    const fullItem: AudioQueueItem = { ...item, id };
    
    queueRef.current.push(fullItem);
    console.log('[AudioQueue] Enqueued item:', id, 'Queue length:', queueRef.current.length);
    
    // Start processing if not already
    if (!isProcessingRef.current) {
      processQueue();
    }

    return id;
  }, [processQueue]);

  const clear = useCallback(() => {
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Clear queue
    queueRef.current = [];
    
    // Reject all waiting promises
    waitingPromisesRef.current.forEach((waiters) => {
      waiters.forEach(w => w.reject(new Error('Queue cleared')));
    });
    waitingPromisesRef.current.clear();
    
    isProcessingRef.current = false;
    setIsPlaying(false);
    setCurrentItemId(null);
    
    console.log('[AudioQueue] Queue cleared');
  }, []);

  const waitForComplete = useCallback((itemId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if item is still in queue or being processed
      const inQueue = queueRef.current.some(i => i.id === itemId);
      const isCurrentItem = currentItemId === itemId;

      if (!inQueue && !isCurrentItem) {
        // Item already completed
        resolve();
        return;
      }

      // Add to waiting list
      const waiters = waitingPromisesRef.current.get(itemId) || [];
      waiters.push({ resolve, reject });
      waitingPromisesRef.current.set(itemId, waiters);
    });
  }, [currentItemId]);

  return {
    enqueue,
    isPlaying,
    currentItemId,
    clear,
    waitForComplete,
  };
}
