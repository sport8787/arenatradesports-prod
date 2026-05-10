/**
 * Web Speech API Fallback Service
 * ================================
 * Fallback para narração quando ElevenLabs TTS falha.
 * Gera áudio usando SpeechSynthesis nativo do navegador.
 * Integra com a fila centralizada de áudio.
 */

import { centralAudioQueue, AUDIO_PRIORITY } from './centralAudioQueue';

// Configurações de voz para cada persona
const VOICE_CONFIG = {
  horus: {
    lang: 'pt-BR',
    pitch: 0.8,  // Mais grave
    rate: 0.9,   // Mais lento para drama
    preferredVoices: ['Google português do Brasil', 'Microsoft Daniel', 'Luciana'],
  },
  mycroft: {
    lang: 'pt-BR',
    pitch: 1.1,  // Ligeiramente mais agudo
    rate: 1.05,  // Ligeiramente mais rápido
    preferredVoices: ['Google português do Brasil', 'Microsoft Daniel', 'Luciana'],
  },
};

type PersonaType = keyof typeof VOICE_CONFIG;

// Estado do serviço
let isSupported = false;
let availableVoices: SpeechSynthesisVoice[] = [];
let fallbackUsageCount = 0;

/**
 * Inicializa o serviço verificando suporte
 */
export function initWebSpeechFallback(): boolean {
  if (typeof window === 'undefined') return false;
  
  isSupported = 'speechSynthesis' in window;
  
  if (isSupported) {
    // Carregar vozes (pode ser assíncrono em alguns navegadores)
    loadVoices();
    
    // Alguns navegadores carregam vozes de forma assíncrona
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    console.log('[WebSpeechFallback] ✅ Serviço inicializado');
  } else {
    console.warn('[WebSpeechFallback] ⚠️ Web Speech API não suportada');
  }
  
  return isSupported;
}

function loadVoices(): void {
  availableVoices = window.speechSynthesis.getVoices();
  const ptVoices = availableVoices.filter(v => v.lang.startsWith('pt'));
  console.log(`[WebSpeechFallback] ${availableVoices.length} vozes carregadas (${ptVoices.length} em português)`);
}

/**
 * Encontra a melhor voz disponível para a persona
 */
function getBestVoice(persona: PersonaType): SpeechSynthesisVoice | null {
  const config = VOICE_CONFIG[persona];
  
  // Tentar encontrar voz preferida
  for (const preferred of config.preferredVoices) {
    const voice = availableVoices.find(v => 
      v.name.includes(preferred) && v.lang.startsWith('pt')
    );
    if (voice) return voice;
  }
  
  // Fallback: qualquer voz em português do Brasil
  const ptBRVoice = availableVoices.find(v => v.lang === 'pt-BR');
  if (ptBRVoice) return ptBRVoice;
  
  // Fallback: qualquer voz em português
  const ptVoice = availableVoices.find(v => v.lang.startsWith('pt'));
  if (ptVoice) return ptVoice;
  
  // Último recurso: voz padrão
  return availableVoices[0] || null;
}

export interface WebSpeechResult {
  success: boolean;
  usedFallback: boolean;
  error?: string;
}

/**
 * Fala texto usando Web Speech API diretamente (sem fila)
 * Usado internamente ou para testes
 */
export function speakDirect(
  text: string,
  persona: PersonaType = 'horus',
  onEnd?: () => void,
  onError?: (error: string) => void
): SpeechSynthesisUtterance | null {
  if (!isSupported) {
    onError?.('Web Speech API não suportada');
    return null;
  }

  // Cancelar fala anterior se houver
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const config = VOICE_CONFIG[persona];
  const voice = getBestVoice(persona);

  if (voice) {
    utterance.voice = voice;
  }
  
  utterance.lang = config.lang;
  utterance.pitch = config.pitch;
  utterance.rate = config.rate;
  utterance.volume = 1;

  utterance.onend = () => {
    console.log('[WebSpeechFallback] ✅ Fala concluída');
    onEnd?.();
  };

  utterance.onerror = (event) => {
    console.error('[WebSpeechFallback] ❌ Erro:', event.error);
    onError?.(event.error);
  };

  window.speechSynthesis.speak(utterance);
  fallbackUsageCount++;
  
  console.log(`[WebSpeechFallback] 🗣️ Falando: "${text.substring(0, 50)}..." (Persona: ${persona})`);
  
  return utterance;
}

/**
 * Fala texto usando a fila centralizada de áudio
 * Cria um blob de áudio temporário usando MediaRecorder + Web Speech
 * NOTA: Esta é uma abordagem mais complexa que grava o áudio de síntese
 */
export async function speakWithQueue(
  text: string,
  persona: PersonaType = 'horus',
  priority: number = AUDIO_PRIORITY.GENERIC,
  label?: string,
  onComplete?: () => void
): Promise<WebSpeechResult> {
  if (!isSupported) {
    return { success: false, usedFallback: false, error: 'Web Speech API não suportada' };
  }

  return new Promise((resolve) => {
    // Como Web Speech não gera um arquivo de áudio que podemos enfileirar,
    // usamos uma abordagem híbrida: pausamos a fila, falamos, e resumimos
    
    // Pausar música de fundo manualmente
    try {
      const bgMusic = document.querySelector('audio[data-bg-music]') as HTMLAudioElement;
      if (bgMusic && !bgMusic.paused) {
        bgMusic.volume = 0.1; // Abaixar volume
      }
    } catch { /* ignore */ }

    const utterance = speakDirect(
      text,
      persona,
      () => {
        // Restaurar música de fundo
        try {
          const bgMusic = document.querySelector('audio[data-bg-music]') as HTMLAudioElement;
          if (bgMusic) {
            bgMusic.volume = 0.3;
          }
        } catch { /* ignore */ }
        
        onComplete?.();
        resolve({ success: true, usedFallback: true });
      },
      (error) => {
        resolve({ success: false, usedFallback: true, error });
      }
    );

    if (!utterance) {
      resolve({ success: false, usedFallback: false, error: 'Falha ao criar utterance' });
    }
  });
}

/**
 * Tenta ElevenLabs primeiro, faz fallback para Web Speech se falhar
 */
export async function speakWithFallback(
  text: string,
  persona: PersonaType = 'horus',
  elevenLabsAudioUrl: string | null,
  priority: number = AUDIO_PRIORITY.GENERIC,
  label?: string,
  onComplete?: () => void
): Promise<WebSpeechResult> {
  // Se temos áudio do ElevenLabs, usa a fila normal
  if (elevenLabsAudioUrl) {
    centralAudioQueue.enqueue(elevenLabsAudioUrl, {
      label: label || 'elevenlabs_audio',
      priority,
      onComplete: () => {
        onComplete?.();
      },
    });
    return { success: true, usedFallback: false };
  }

  // Fallback para Web Speech
  console.log('[WebSpeechFallback] 🔄 ElevenLabs indisponível, usando fallback');
  return speakWithQueue(text, persona, priority, label, onComplete);
}

/**
 * Para qualquer fala em andamento
 */
export function stopWebSpeech(): void {
  if (isSupported) {
    window.speechSynthesis.cancel();
    console.log('[WebSpeechFallback] ⏹️ Fala interrompida');
  }
}

/**
 * Verifica se Web Speech está disponível
 */
export function isWebSpeechSupported(): boolean {
  return isSupported;
}

/**
 * Retorna estatísticas do serviço
 */
export function getWebSpeechStats() {
  return {
    isSupported,
    voicesLoaded: availableVoices.length,
    ptVoices: availableVoices.filter(v => v.lang.startsWith('pt')).length,
    fallbackUsageCount,
  };
}

// Auto-inicializar quando o módulo é importado
if (typeof window !== 'undefined') {
  // Aguardar DOM ready para inicializar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initWebSpeechFallback());
  } else {
    initWebSpeechFallback();
  }
}
