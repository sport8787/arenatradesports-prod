import { useState, useCallback, useRef } from 'react';
import { PersonaId, PERSONAS, GameMoment, getDialogConfig } from '@/types/personas';
import { getRandomHorusPhrase } from '@/data/horusPhrases';

interface DialogState {
  activePersona: PersonaId | null;
  isSpeaking: boolean;
  currentText: string | null;
  isLoading: boolean;
  error: string | null;
}

interface QueueItem {
  moment: GameMoment;
  dynamicText?: string;
  onComplete?: () => void;
}

interface UseDialogManagerOptions {
  canPlayAudio?: boolean;
  onAudioGenerated?: (audioUrl: string, text: string, personaId: string) => void;
}

interface UseDialogManagerReturn {
  state: DialogState;
  speak: (moment: GameMoment, dynamicText?: string, priority?: number, onComplete?: () => void) => Promise<void>;
  stopSpeaking: () => void;
  getActivePersona: () => typeof PERSONAS.horus | typeof PERSONAS.mycroft | null;
  isQueueEmpty: () => boolean;
  clearQueue: () => void;
  playExternalAudio: (audioUrl: string, text: string, onComplete?: () => void) => void;
}

export function useDialogManager(options: UseDialogManagerOptions = {}): UseDialogManagerReturn {
  const { canPlayAudio = true, onAudioGenerated } = options;
  
  const [state, setState] = useState<DialogState>({
    activePersona: null,
    isSpeaking: false,
    currentText: null,
    isLoading: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());
  const queueRef = useRef<QueueItem[]>([]);
  const isProcessingRef = useRef(false);
  const retryCountRef = useRef<Map<string, number>>(new Map());
  const MAX_RETRIES = 2;

  // Clear old cache entries to prevent stale audio
  const clearOldCache = useCallback(() => {
    const maxCacheSize = 20;
    if (audioCache.current.size > maxCacheSize) {
      const entries = Array.from(audioCache.current.entries());
      const toRemove = entries.slice(0, entries.length - maxCacheSize);
      toRemove.forEach(([key, url]) => {
        URL.revokeObjectURL(url);
        audioCache.current.delete(key);
      });
      console.log('[DialogManager] Cleared', toRemove.length, 'old cache entries');
    }
  }, []);

  const generateTTS = useCallback(async (text: string, personaId: PersonaId, forceRefresh = false): Promise<string | null> => {
    const persona = PERSONAS[personaId];
    const cacheKey = `${persona.voiceId}:${text}`;
    
    // Force refresh clears the cache entry
    if (forceRefresh && audioCache.current.has(cacheKey)) {
      const oldUrl = audioCache.current.get(cacheKey)!;
      URL.revokeObjectURL(oldUrl);
      audioCache.current.delete(cacheKey);
      console.log('[DialogManager] Force refreshed cache for:', cacheKey.substring(0, 50));
    }
    
    if (audioCache.current.has(cacheKey)) {
      console.log('[DialogManager] Using cached audio for:', cacheKey.substring(0, 50));
      return audioCache.current.get(cacheKey)!;
    }

    // Clear old cache before adding new entries
    clearOldCache();

    const attemptFetch = async (attempt: number): Promise<string | null> => {
      try {
        console.log('[DialogManager] Generating TTS (attempt', attempt + 1, '):', text.substring(0, 50));
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ 
              text, 
              voiceId: persona.voiceId,
              stability: persona.voiceSettings.stability,
              similarityBoost: persona.voiceSettings.similarityBoost,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`TTS error: ${response.status} ${response.statusText}`);
        }

        const audioBlob = await response.blob();
        
        if (audioBlob.size === 0) {
          throw new Error('Empty audio blob received');
        }
        
        const audioUrl = URL.createObjectURL(audioBlob);
        audioCache.current.set(cacheKey, audioUrl);
        console.log('[DialogManager] TTS generated successfully:', audioBlob.size, 'bytes');
        return audioUrl;
      } catch (error) {
        console.error('[DialogManager] TTS error (attempt', attempt + 1, '):', error);
        
        if (attempt < MAX_RETRIES) {
          console.log('[DialogManager] Retrying in 1 second...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return attemptFetch(attempt + 1);
        }
        
        console.error('[DialogManager] TTS failed after', MAX_RETRIES + 1, 'attempts');
        setState(prev => ({ ...prev, error: `Erro ao gerar áudio: ${error}` }));
        return null;
      }
    };

    return attemptFetch(0);
  }, [clearOldCache]);

  // Play audio locally with proper loading wait
  const playAudioLocally = useCallback(async (audioUrl: string, onEnded: () => void) => {
    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    
    const audio = new Audio();
    audioRef.current = audio;
    
    // Set up event handlers before loading
    audio.onplay = () => {
      console.log('[DialogManager] Audio started playing');
      setState(prev => ({ ...prev, isSpeaking: true, isLoading: false }));
    };
    
    audio.onended = () => {
      console.log('[DialogManager] Audio ended naturally');
      onEnded();
    };
    
    audio.onerror = (e) => {
      console.error('[DialogManager] Audio playback error:', e);
      setState(prev => ({ ...prev, error: 'Erro ao reproduzir áudio' }));
      onEnded();
    };

    // Wait for audio to be fully loaded before playing
    audio.oncanplaythrough = async () => {
      console.log('[DialogManager] Audio ready to play, duration:', audio.duration);
      try {
        await audio.play();
      } catch (err) {
        console.error('[DialogManager] Play failed:', err);
        // Fallback: wait based on expected duration then continue
        setTimeout(onEnded, 4000);
      }
    };

    // Set source and start loading
    audio.src = audioUrl;
    audio.load();
    
    // Timeout fallback in case loading takes too long
    setTimeout(() => {
      if (!audio.currentTime && audio.readyState < 3) {
        console.warn('[DialogManager] Audio loading timeout, forcing continue');
        onEnded();
      }
    }, 15000);
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;
    
    isProcessingRef.current = true;
    const item = queueRef.current.shift()!;
    
    const config = getDialogConfig(item.moment);

    setState(prev => ({
      ...prev,
      activePersona: config.persona,
      isLoading: true,
      isSpeaking: false,
      error: null,
    }));

    let textToSpeak: string;
    if (item.moment === 'question_read' && item.dynamicText) {
      textToSpeak = item.dynamicText;
    } else if (config.useLiveAI && item.dynamicText) {
      textToSpeak = item.dynamicText;
    } else if (config.persona === 'horus') {
      const phrase = getRandomHorusPhrase(item.moment);
      textToSpeak = phrase?.text || 'Que os jogos comecem!';
    } else {
      textToSpeak = item.dynamicText || 'Análise em processamento...';
    }

    setState(prev => ({ ...prev, currentText: textToSpeak }));

    const audioUrl = await generateTTS(textToSpeak, config.persona);

    const finishAndProcessNext = () => {
      setState(prev => ({ ...prev, isSpeaking: false, activePersona: null, currentText: null }));
      if (item.onComplete) item.onComplete();
      isProcessingRef.current = false;
      setTimeout(() => processQueue(), 300);
    };

    if (audioUrl) {
      // If we have a callback for audio sync, notify it
      if (onAudioGenerated) {
        onAudioGenerated(audioUrl, textToSpeak, config.persona);
        // In sync mode, the audio will be played via broadcast
        // We still update state and wait for completion
        setState(prev => ({ ...prev, isSpeaking: true, isLoading: false }));
        
        // Estimate duration based on text length (rough: 150ms per character)
        const estimatedDuration = Math.max(3000, textToSpeak.length * 80);
        setTimeout(finishAndProcessNext, estimatedDuration);
      } else if (canPlayAudio) {
        // No sync - play locally
        await playAudioLocally(audioUrl, finishAndProcessNext);
      } else {
        // Can't play audio - just finish
        setTimeout(finishAndProcessNext, 500);
      }
    } else {
      setTimeout(finishAndProcessNext, 4000);
    }
  }, [generateTTS, canPlayAudio, onAudioGenerated, playAudioLocally]);

  const speak = useCallback(async (moment: GameMoment, dynamicText?: string, _priority?: number, onComplete?: () => void) => {
    queueRef.current.push({ moment, dynamicText, onComplete });
    if (!isProcessingRef.current) processQueue();
  }, [processQueue]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    queueRef.current = [];
    isProcessingRef.current = false;
    setState({ activePersona: null, isSpeaking: false, currentText: null, isLoading: false, error: null });
  }, []);

  const clearQueue = useCallback(() => {
    queueRef.current = [];
  }, []);

  const isQueueEmpty = useCallback(() => queueRef.current.length === 0 && !isProcessingRef.current, []);

  const getActivePersona = useCallback(() => state.activePersona ? PERSONAS[state.activePersona] : null, [state.activePersona]);

  // Play audio received from external source (sync)
  const playExternalAudio = useCallback((audioUrl: string, text: string, onComplete?: () => void) => {
    if (!canPlayAudio) return;

    setState(prev => ({
      ...prev,
      isSpeaking: true,
      currentText: text,
    }));

    if (audioRef.current) audioRef.current.pause();
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.onended = () => {
      setState(prev => ({ ...prev, isSpeaking: false, currentText: null }));
      if (onComplete) onComplete();
    };

    audio.onerror = () => {
      setState(prev => ({ ...prev, isSpeaking: false, currentText: null }));
      if (onComplete) onComplete();
    };

    audio.play().catch(() => {
      setState(prev => ({ ...prev, isSpeaking: false, currentText: null }));
      if (onComplete) onComplete();
    });
  }, [canPlayAudio]);

  return { 
    state, 
    speak, 
    stopSpeaking, 
    getActivePersona, 
    isQueueEmpty, 
    clearQueue,
    playExternalAudio,
  };
}
