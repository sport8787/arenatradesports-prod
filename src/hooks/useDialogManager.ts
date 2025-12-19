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
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCache = useRef<Map<string, string>>(new Map());

  const generateTTS = useCallback(async (text: string, personaId: PersonaId): Promise<string | null> => {
    const persona = PERSONAS[personaId];
    const cacheKey = `${persona.voiceId}:${text}`;
    
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
            voiceId: persona.voiceId,
            stability: persona.voiceSettings.stability,
            similarityBoost: persona.voiceSettings.similarityBoost,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('TTS request failed:', response.status, errorData);
        throw new Error(errorData.error || `TTS error: ${response.status}`);
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
    // Stop any ongoing speech first
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    const config = getDialogConfig(moment);
    const persona = PERSONAS[config.persona];

    setState(prev => ({
      ...prev,
      activePersona: config.persona,
      isLoading: true,
      isSpeaking: false,
      error: null,
    }));

    let textToSpeak: string;

    // For question_read moment, always use the provided dynamic text (the question)
    if (moment === 'question_read' && dynamicText) {
      textToSpeak = dynamicText;
    } else if (config.useLiveAI && dynamicText) {
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

    // Generate and play TTS using persona settings
    const audioUrl = await generateTTS(textToSpeak, config.persona);

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
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false, 
          isLoading: false,
          error: 'Erro ao reproduzir áudio',
        }));
      };

      try {
        await audio.play();
      } catch (error) {
        console.error('Failed to play audio:', error);
        // Fallback: just show the text without audio
        setState(prev => ({ 
          ...prev, 
          isSpeaking: false, 
          isLoading: false,
          error: 'Áudio indisponível - mostrando texto',
        }));
        
        // Auto-clear text after 4 seconds (simulating speech duration)
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            activePersona: null,
            currentText: null,
            error: null,
          }));
        }, 4000);
      }
    } else {
      // TTS failed - show text as fallback without audio
      setState(prev => ({ 
        ...prev, 
        isLoading: false,
        error: 'TTS indisponível - mostrando texto',
      }));
      
      // Auto-clear text after 4 seconds
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          activePersona: null,
          currentText: null,
          error: null,
        }));
      }, 4000);
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
      error: null,
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
