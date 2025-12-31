/**
 * SILENT OBSERVER SERVICE - Evento "Observador Silencioso"
 * =========================================================
 * 
 * Dispara após 5 acertos consecutivos.
 * Usa ElevenLabs TTS para narração dinâmica do Hórus.
 * Integra com fila centralizada de áudio.
 */

import { centralAudioQueue, AUDIO_PRIORITY } from './centralAudioQueue';
import { getSilentObserverPhrase } from '@/data/horusActPhrases';

// Voice ID do Hórus (George - voz grave e misteriosa)
const HORUS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

// Tracking para evitar disparar o evento múltiplas vezes
let silentObserverTriggered = false;

/**
 * Gera narração via ElevenLabs TTS
 */
async function generateTTSAudio(text: string): Promise<string | null> {
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
          voiceId: HORUS_VOICE_ID,
          stability: 0.6,
          similarityBoost: 0.8,
          style: 0.5,
          speed: 0.95, // Slightly slower for dramatic effect
        }),
      }
    );

    if (!response.ok) {
      console.error('[SilentObserver] TTS request failed:', response.status);
      return null;
    }

    // Check if response is JSON with audioUrl or raw audio
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      if (data.audioUrl) {
        return data.audioUrl;
      }
      if (data.audioContent) {
        return `data:audio/mpeg;base64,${data.audioContent}`;
      }
    }

    // Raw audio response
    const audioBlob = await response.blob();
    return URL.createObjectURL(audioBlob);
  } catch (error) {
    console.error('[SilentObserver] Error generating TTS:', error);
    return null;
  }
}

/**
 * Frases dinâmicas para o Observador Silencioso com nome do jogador
 */
function getPersonalizedObserverPhrase(playerName: string): string {
  const phrases = [
    `${playerName}... cinco acertos consecutivos. O Observador Silencioso está de olho em você.`,
    `Impressionante, ${playerName}. Você atraiu a atenção de algo... maior. Algo que raramente se manifesta.`,
    `${playerName}, há cinco rodadas você não erra. Isso é... incomum. Alguém está observando.`,
    `O Observador Silencioso notou sua performance, ${playerName}. Poucos chegam tão longe.`,
    `${playerName}... você está jogando bem demais. Talvez bem demais. O Observador está intrigado.`,
    `Cinco em sequência. ${playerName}, você me impressiona. E eu não me impressiono facilmente.`,
  ];
  
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export interface SilentObserverResult {
  triggered: boolean;
  phrase: string;
  audioPlaying: boolean;
}

/**
 * Verifica e dispara o evento Observador Silencioso
 * 
 * @param consecutiveCorrect - Número de acertos consecutivos
 * @param playerName - Nome do jogador para personalização
 * @param onComplete - Callback quando o áudio terminar
 * @returns Resultado do evento
 */
export async function checkAndTriggerSilentObserver(
  consecutiveCorrect: number,
  playerName: string = 'Jogador',
  onComplete?: () => void
): Promise<SilentObserverResult> {
  // Só dispara no exato momento de atingir 5 acertos
  if (consecutiveCorrect !== 5 || silentObserverTriggered) {
    return {
      triggered: false,
      phrase: '',
      audioPlaying: false,
    };
  }

  silentObserverTriggered = true;
  
  const phrase = getPersonalizedObserverPhrase(playerName);
  console.log('[SilentObserver] 👁️ Evento disparado:', phrase);

  // Tenta gerar áudio via ElevenLabs
  const audioUrl = await generateTTSAudio(phrase);

  if (audioUrl) {
    // Enfileira na fila centralizada com prioridade de evento narrativo
    centralAudioQueue.enqueue(audioUrl, {
      label: 'silent_observer',
      priority: AUDIO_PRIORITY.NARRATIVE_EVENT,
      onComplete: () => {
        console.log('[SilentObserver] ✅ Narração completa');
        onComplete?.();
        
        // Cleanup blob URL se foi criado
        if (audioUrl.startsWith('blob:')) {
          URL.revokeObjectURL(audioUrl);
        }
      },
    });

    return {
      triggered: true,
      phrase,
      audioPlaying: true,
    };
  }

  // Fallback: usar áudio local se TTS falhar
  console.log('[SilentObserver] Fallback para áudio local');
  centralAudioQueue.enqueue('/audio/horus/evento_oculto_1.mp3', {
    label: 'silent_observer_fallback',
    priority: AUDIO_PRIORITY.NARRATIVE_EVENT,
    onComplete,
  });

  return {
    triggered: true,
    phrase,
    audioPlaying: true,
  };
}

/**
 * Reseta o tracking do evento para nova partida
 */
export function resetSilentObserver(): void {
  silentObserverTriggered = false;
  console.log('[SilentObserver] Reset para nova partida');
}

/**
 * Verifica se o evento já foi disparado nesta sessão
 */
export function isSilentObserverTriggered(): boolean {
  return silentObserverTriggered;
}
