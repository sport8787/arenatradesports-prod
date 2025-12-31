/**
 * COGNITIVE RUPTURE SERVICE - Evento "Ruptura Cognitiva"
 * ========================================================
 * 
 * Dispara após 3 ERROS consecutivos.
 * Usa ElevenLabs TTS para narração dinâmica do Hórus.
 * Integra com fila centralizada de áudio.
 */

import { centralAudioQueue, AUDIO_PRIORITY } from './centralAudioQueue';

// Voice ID do Hórus (George - voz grave e misteriosa)
const HORUS_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

// Tracking para evitar disparar o evento múltiplas vezes por partida
let cognitiveRuptureTriggered = false;

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
          stability: 0.5, // Mais expressivo para tom de alerta
          similarityBoost: 0.8,
          style: 0.7, // Tom mais dramático
          speed: 0.9, // Ligeiramente mais lento para impacto
        }),
      }
    );

    if (!response.ok) {
      console.error('[CognitiveRupture] TTS request failed:', response.status);
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
    console.error('[CognitiveRupture] Error generating TTS:', error);
    return null;
  }
}

/**
 * Frases dinâmicas para a Ruptura Cognitiva com nome do jogador
 */
function getCognitiveRupturePhrase(playerName: string): string {
  const phrases = [
    `${playerName}... três erros consecutivos. A pressão está te quebrando?`,
    `O que aconteceu, ${playerName}? Você estava indo tão bem... e agora isso.`,
    `${playerName}, três erros seguidos. Talvez você precise parar e respirar.`,
    `A mente falha quando a confiança some, ${playerName}. Eu vejo isso em você agora.`,
    `${playerName}... você está perdendo o foco. Três erros. Isso é... preocupante.`,
    `Concentração, ${playerName}! Três erros consecutivos não são aceitáveis neste nível.`,
    `${playerName}, eu esperava mais de você. Três erros seguidos? Decepcionante.`,
  ];
  
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export interface CognitiveRuptureResult {
  triggered: boolean;
  phrase: string;
  audioPlaying: boolean;
}

/**
 * Verifica e dispara o evento Ruptura Cognitiva
 * 
 * @param consecutiveWrong - Número de erros consecutivos
 * @param playerName - Nome do jogador para personalização
 * @param onComplete - Callback quando o áudio terminar
 * @returns Resultado do evento
 */
export async function checkAndTriggerCognitiveRupture(
  consecutiveWrong: number,
  playerName: string = 'Jogador',
  onComplete?: () => void
): Promise<CognitiveRuptureResult> {
  // Só dispara no exato momento de atingir 3 erros
  if (consecutiveWrong !== 3 || cognitiveRuptureTriggered) {
    return {
      triggered: false,
      phrase: '',
      audioPlaying: false,
    };
  }

  cognitiveRuptureTriggered = true;
  
  const phrase = getCognitiveRupturePhrase(playerName);
  console.log('[CognitiveRupture] 🧠 Evento disparado:', phrase);

  // Tenta gerar áudio via ElevenLabs
  const audioUrl = await generateTTSAudio(phrase);

  if (audioUrl) {
    // Enfileira na fila centralizada com prioridade de evento narrativo
    centralAudioQueue.enqueue(audioUrl, {
      label: 'cognitive_rupture',
      priority: AUDIO_PRIORITY.NARRATIVE_EVENT,
      onComplete: () => {
        console.log('[CognitiveRupture] ✅ Narração completa');
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
  console.log('[CognitiveRupture] Fallback para áudio local');
  centralAudioQueue.enqueue('/audio/horus/evento_oculto_2.mp3', {
    label: 'cognitive_rupture_fallback',
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
export function resetCognitiveRupture(): void {
  cognitiveRuptureTriggered = false;
  console.log('[CognitiveRupture] Reset para nova partida');
}

/**
 * Verifica se o evento já foi disparado nesta sessão
 */
export function isCognitiveRuptureTriggered(): boolean {
  return cognitiveRuptureTriggered;
}
