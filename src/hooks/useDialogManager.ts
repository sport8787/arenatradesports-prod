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

interface UseDialogManagerReturn {
  state: DialogState;
  speak: (moment: GameMoment, dynamicText?: string, priority?: number, onComplete?: () => void) => Promise<void>;
  stopSpeaking: () => void;
  getActivePersona: () => typeof PERSONAS.horus | typeof PERSONAS.mycroft | null;
  isQueueEmpty: () => boolean;
  clearQueue: () => void;
}

export function useDialogManager(): UseDialogManagerReturn {
  const [state, setState] = useState<DialogState>({
    activePersona: null,
    isSpeaking: false,
    currentText: null,
    isLoading: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());
  const queueRef = useRef<Array<{ moment: GameMoment; dynamicText?: string; onComplete?: () => void }>>([]);
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
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onplay = () => setState(prev => ({ ...prev, isSpeaking: true, isLoading: false }));
      audio.onended = finishAndProcessNext;
      audio.onerror = finishAndProcessNext;
      try {
        await audio.play();
      } catch {
        setTimeout(finishAndProcessNext, 4000);
      }
    } else {
      setTimeout(finishAndProcessNext, 4000);
    }
  }, [generateTTS]);

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

  return { state, speak, stopSpeaking, getActivePersona, isQueueEmpty, clearQueue };
}
