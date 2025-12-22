import { useState, useCallback, useRef } from 'react';
import { PersonaId, PERSONAS, GameMoment, getDialogConfig } from '@/types/personas';
import { getRandomHorusPhrase } from '@/data/horusPhrases';
import { getCachedAudio, clearAudioMemoryCache } from '@/services/audioCacheService';
import { audioQueue } from '@/services/audioQueueManager';
import { recordEnqueue, recordExecute, recordBlocked } from '@/services/audioDebugService';

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
  uploadToStorage?: boolean; // For online mode - upload audio to storage for sharing
  roomId?: string;
  isHost?: boolean; // For Presencial mode - only host generates audio
  gameMode?: string; // 'single', 'online', 'presencial'
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
  const { 
    canPlayAudio = true, 
    onAudioGenerated, 
    uploadToStorage = false, 
    roomId,
    isHost = true,
    gameMode = 'single'
  } = options;
  
  const [state, setState] = useState<DialogState>({
    activePersona: null,
    isSpeaking: false,
    currentText: null,
    isLoading: false,
    error: null,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<QueueItem[]>([]);
  const isProcessingRef = useRef(false);

  // Dedupe immediate duplicate question narrations (fixes "Hórus lê 3x" on host)
  const lastQuestionReadKeyRef = useRef<string | null>(null);
  const lastQuestionReadAtRef = useRef<number>(0);
  const QUESTION_READ_DEDUPE_WINDOW_MS = 15000;

  // Track if game has actually started (to prevent TTS calls before gameplay)
  const gameStartedRef = useRef(false);

  // Mark game as started when first speak call happens for gameplay moments
  const markGameStarted = useCallback(() => {
    if (!gameStartedRef.current) {
      gameStartedRef.current = true;
      console.log('[DialogManager] 🎮 Game started - TTS calls now enabled');
    }
  }, []);

  const generateTTS = useCallback(async (
    text: string, 
    personaId: PersonaId, 
    moment?: GameMoment,
    forceRefresh = false
  ): Promise<string | null> => {
    // CRITICAL: Only allow TTS calls after game has started
    // This prevents credit consumption during lobby/briefcase phases
    if (!gameStartedRef.current) {
      console.log(`[DialogManager] ⛔ TTS BLOCKED: Game not started yet. Text: "${text.substring(0, 40)}..."`);
      return null;
    }

    try {
      const result = await getCachedAudio({
        text,
        personaId,
        moment,
        forceRefresh,
        isHost,
        gameMode,
      });

      if (result) {
        console.log('[DialogManager] Audio retrieved:', result.fromCache ? 'from cache' : 'freshly generated');
        return result.audioUrl;
      }
      return null;
    } catch (error) {
      console.error('[DialogManager] Error getting audio:', error);
      setState(prev => ({ ...prev, error: `Erro ao gerar áudio: ${error}` }));
      return null;
    }
  }, [isHost, gameMode]);

  // Play audio locally using audio queue manager (centralized)
  const playAudioLocally = useCallback(async (audioUrl: string, label: string, onEnded: () => void) => {
    setState(prev => ({ ...prev, isLoading: false, isSpeaking: true }));
    
    // Usa fila centralizada - prioridade 8 para diálogos (Mycroft verdict, etc.)
    audioQueue.addToQueue(
      audioUrl,
      label,
      8, // Prioridade alta para verditos
      () => {
        console.log('[DialogManager] Audio ended via queue');
        setState(prev => ({ ...prev, isSpeaking: false }));
        onEnded();
      }
    );
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

    const finishAndProcessNext = () => {
      setState(prev => ({ ...prev, isSpeaking: false, activePersona: null, currentText: null }));
      if (item.onComplete) item.onComplete();
      isProcessingRef.current = false;
      setTimeout(() => processQueue(), 300);
    };

    // If this client can't play audio and there's no external audio handler,
    // don't generate TTS (avoids wasted credits / duplicate narrations on juror devices).
    if (!canPlayAudio && !onAudioGenerated) {
      setState(prev => ({ ...prev, isLoading: false, isSpeaking: false }));
      setTimeout(finishAndProcessNext, 10);
      return;
    }

    const audioUrl = await generateTTS(textToSpeak, config.persona, item.moment);

    // Record execution for debug panel
    recordExecute(item.moment);

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
        // No sync - play via centralized queue
        await playAudioLocally(audioUrl, `dialog_${item.moment}`, finishAndProcessNext);
      } else {
        // Can't play audio - just finish
        setTimeout(finishAndProcessNext, 500);
      }
    } else {
      setTimeout(finishAndProcessNext, 4000);
    }
  }, [generateTTS, canPlayAudio, onAudioGenerated, playAudioLocally]);

  const speak = useCallback(
    async (moment: GameMoment, dynamicText?: string, _priority?: number, onComplete?: () => void) => {
      // Mark game as started when first gameplay speech is requested
      markGameStarted();

      // Prevent immediate duplicate "question_read" enqueues (common cause of triple narration)
      if (moment === 'question_read' && typeof dynamicText === 'string') {
        const key = dynamicText.trim().toLowerCase();
        const now = Date.now();
        const ageMs = now - lastQuestionReadAtRef.current;

        if (lastQuestionReadKeyRef.current === key && ageMs < QUESTION_READ_DEDUPE_WINDOW_MS) {
          console.log('[DialogManager] ⛔ Duplicate question_read blocked', { ageMs });
          recordBlocked(moment, `duplicate within ${ageMs}ms`);
          return;
        }

        lastQuestionReadKeyRef.current = key;
        lastQuestionReadAtRef.current = now;
      }

      // Record enqueue for debug panel
      recordEnqueue(moment, dynamicText || '[no text]', 'DialogManager.speak');

      queueRef.current.push({ moment, dynamicText, onComplete });
      if (!isProcessingRef.current) processQueue();
    },
    [processQueue, markGameStarted]
  );

  const stopSpeaking = useCallback(() => {
    // Usa fila centralizada para parar
    audioQueue.clearQueue();
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

  // Play audio received from external source (sync) - usa fila centralizada
  const playExternalAudio = useCallback((audioUrl: string, text: string, onComplete?: () => void) => {
    if (!canPlayAudio) return;

    setState(prev => ({
      ...prev,
      isSpeaking: true,
      currentText: text,
    }));

    // Usa fila centralizada com prioridade 6 (externa/sync)
    audioQueue.addToQueue(
      audioUrl,
      `external_${text.substring(0, 20)}`,
      6,
      () => {
        setState(prev => ({ ...prev, isSpeaking: false, currentText: null }));
        if (onComplete) onComplete();
      }
    );
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
