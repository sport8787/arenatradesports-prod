import { useState, useCallback, useRef } from 'react';
import { PersonaId, PERSONAS, GameMoment, getDialogConfig } from '@/types/personas';
import { getRandomHorusPhrase } from '@/data/horusPhrases';

interface DialogState {
  activePersona: PersonaId | null;
  isSpeaking: boolean;
  currentText: string | null;
  isLoading: boolean;
}

interface UseDialogManagerReturn {
  state: DialogState;
  speak: (moment: GameMoment, dynamicText?: string) => Promise<void>;
  stopSpeaking: () => void;
  getActivePersona: () => typeof PERSONAS.horus | typeof PERSONAS.mycroft | null;
}

export function useDialogManager(): UseDialogManagerReturn {
  const [state, setState] = useState<DialogState>({
    activePersona: null,
    isSpeaking: false,
    currentText: null,
    isLoading: false,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());

  const generateTTS = useCallback(async (text: string, voiceId: string): Promise<string | null> => {
    const cacheKey = `${voiceId}:${text}`;
    
    // Check cache first
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
            voiceId,
            stability: voiceId === PERSONAS.mycroft.voiceId ? 0.7 : 0.5, // Mycroft more stable
            similarityBoost: 0.75,
          }),
        }
      );

      if (!response.ok) {
        console.error('TTS request failed:', response.status);
        return null;
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Cache the URL
      audioCache.current.set(cacheKey, audioUrl);
      
      return audioUrl;
    } catch (error) {
      console.error('Error generating TTS:', error);
      return null;
    }
  }, []);

  const speak = useCallback(async (moment: GameMoment, dynamicText?: string) => {
    const config = getDialogConfig(moment);
    const persona = PERSONAS[config.persona];

    setState(prev => ({
      ...prev,
      activePersona: config.persona,
      isLoading: true,
      isSpeaking: false,
    }));

    let textToSpeak: string;

    if (config.useLiveAI && dynamicText) {
      // Use dynamic AI-generated text for special moments
      textToSpeak = dynamicText;
    } else {
      // Use cached phrases for Hórus
      if (config.persona === 'horus') {
        const phrase = getRandomHorusPhrase(moment);
        textToSpeak = phrase?.text || 'Que os jogos comecem!';
      } else {
        // Mycroft always uses dynamic text
        textToSpeak = dynamicText || 'Análise em processamento...';
      }
    }

    setState(prev => ({ ...prev, currentText: textToSpeak }));

    // Generate and play TTS
    const audioUrl = await generateTTS(textToSpeak, persona.voiceId);

    if (audioUrl) {
      // Stop any current audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setState(prev => ({ ...prev, isSpeaking: true, isLoading: false }));
      };

      audio.onended = () => {
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false,
          // Keep persona active for a moment after speaking
        }));
        
        // Clear persona after a delay
        setTimeout(() => {
          setState(prev => {
            if (!prev.isSpeaking) {
              return { ...prev, activePersona: null, currentText: null };
            }
            return prev;
          });
        }, 2000);
      };

      audio.onerror = () => {
        console.error('Error playing audio');
        setState(prev => ({ ...prev, isSpeaking: false, isLoading: false }));
      };

      try {
        await audio.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
        setState(prev => ({ ...prev, isSpeaking: false, isLoading: false }));
      }
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [generateTTS]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState({
      activePersona: null,
      isSpeaking: false,
      currentText: null,
      isLoading: false,
    });
  }, []);

  const getActivePersona = useCallback(() => {
    if (!state.activePersona) return null;
    return PERSONAS[state.activePersona];
  }, [state.activePersona]);

  return {
    state,
    speak,
    stopSpeaking,
    getActivePersona,
  };
}
