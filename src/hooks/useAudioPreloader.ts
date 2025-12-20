// Hook for managing audio preloading in the lobby
import { useState, useEffect, useCallback } from 'react';
import { preloadCommonPhrases, isPreloadComplete, resetPreloadState } from '@/services/audioPreloader';

interface PreloadState {
  isLoading: boolean;
  progress: number;
  total: number;
  isComplete: boolean;
  currentPhrase?: string;
}

export function useAudioPreloader(autoStart = true) {
  const [state, setState] = useState<PreloadState>({
    isLoading: false,
    progress: 0,
    total: 0,
    isComplete: isPreloadComplete(),
  });

  const startPreload = useCallback(async () => {
    if (state.isComplete || state.isLoading) return;

    setState(prev => ({ ...prev, isLoading: true }));

    await preloadCommonPhrases((progress) => {
      setState({
        isLoading: !progress.isComplete,
        progress: progress.loaded,
        total: progress.total,
        isComplete: progress.isComplete,
        currentPhrase: progress.currentPhrase,
      });
    });
  }, [state.isComplete, state.isLoading]);

  const reset = useCallback(() => {
    resetPreloadState();
    setState({
      isLoading: false,
      progress: 0,
      total: 0,
      isComplete: false,
    });
  }, []);

  // Auto-start preloading when component mounts
  useEffect(() => {
    if (autoStart && !state.isComplete && !state.isLoading) {
      // Delay start to not compete with initial page load
      const timer = setTimeout(() => {
        startPreload();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [autoStart, state.isComplete, state.isLoading, startPreload]);

  return {
    ...state,
    startPreload,
    reset,
    progressPercent: state.total > 0 ? Math.round((state.progress / state.total) * 100) : 0,
  };
}
