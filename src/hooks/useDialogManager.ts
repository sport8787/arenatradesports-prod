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

  const generateTTS = useCallback(async (text: string, personaId: PersonaId): Promise<string | null> => {
    const persona = PERSONAS[personaId];
    const cacheKey = `${persona.voiceId}:${text}`;
    
    if (audioCache.current.has(cacheKey)) {
      return audioCache.current.get(cacheKey)!;
    }

    try {
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
        throw new Error(`TTS error: ${response.status}`);
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      audioCache.current.set(cacheKey, audioUrl);
      return audioUrl;
    } catch (error) {
      console.error('Error generating TTS:', error);
      return null;
    }
  }, []);

  // Play audio locally
  const playAudioLocally = useCallback(async (audioUrl: string, onEnded: () => void) => {
    if (audioRef.current) audioRef.current.pause();
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onplay = () => setState(prev => ({ ...prev, isSpeaking: true, isLoading: false }));
    audio.onended = onEnded;
    audio.onerror = onEnded;
    
    try {
      await audio.play();
    } catch {
      // Fallback: wait then continue
      setTimeout(onEnded, 4000);
    }
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
