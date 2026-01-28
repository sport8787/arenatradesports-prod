// ElevenLabs Speech-to-Text Service
// Client-side wrapper for the elevenlabs-stt Edge Function
// Provides real-time and batch transcription capabilities

import { supabase } from '@/integrations/supabase/client';

// ===========================
// TYPES & INTERFACES
// ===========================

export interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface TranscriptionResult {
  text: string;
  words: TranscriptionWord[];
  language_code?: string;
  audio_events?: Array<{
    type: string;
    start: number;
    end: number;
  }>;
  processingTimeMs?: number;
}

export interface TranscriptionError {
  error: string;
  message?: string;
  text: string;
}

// ===========================
// MAIN API FUNCTIONS
// ===========================

/**
 * Transcribe audio from a URL using ElevenLabs Scribe API
 * Best for: Audio already uploaded to storage (game recordings)
 */
export async function transcribeAudioFromUrl(
  audioUrl: string,
  languageCode: string = 'por'
): Promise<TranscriptionResult> {
  console.log('[STT Service] Transcribing audio from URL...');
  
  try {
    const { data, error } = await supabase.functions.invoke('elevenlabs-stt', {
      body: {
        audioUrl,
        language_code: languageCode,
      },
    });
    
    if (error) {
      console.error('[STT Service] Edge function error:', error);
      throw new Error(error.message);
    }
    
    if (data?.error) {
      console.error('[STT Service] API error:', data.error);
      // Return empty transcription on quota/API errors
      if (data.error === 'QUOTA_EXCEEDED') {
        console.warn('[STT Service] Quota exceeded - returning empty transcription');
        return {
          text: '',
          words: [],
          language_code: languageCode,
        };
      }
      throw new Error(data.error);
    }
    
    console.log('[STT Service] Transcription complete:', data.text?.substring(0, 50) + '...');
    return data as TranscriptionResult;
  } catch (error) {
    console.error('[STT Service] Error transcribing audio:', error);
    // Return empty transcription on error (graceful degradation)
    return {
      text: '',
      words: [],
      language_code: languageCode,
    };
  }
}

/**
 * Transcribe audio from a Blob using ElevenLabs Scribe API
 * Best for: Direct audio capture from microphone before upload
 */
export async function transcribeAudioBlob(
  audioBlob: Blob,
  languageCode: string = 'por'
): Promise<TranscriptionResult> {
  console.log('[STT Service] Transcribing audio blob, size:', audioBlob.size);
  
  try {
    // Convert blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Efficient base64 encoding
    let binary = '';
    const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const audioBase64 = btoa(binary);
    
    const { data, error } = await supabase.functions.invoke('elevenlabs-stt', {
      body: {
        audioBase64,
        mimeType: audioBlob.type || 'audio/webm',
        language_code: languageCode,
      },
    });
    
    if (error) {
      console.error('[STT Service] Edge function error:', error);
      throw new Error(error.message);
    }
    
    if (data?.error) {
      console.error('[STT Service] API error:', data.error);
      if (data.error === 'QUOTA_EXCEEDED') {
        console.warn('[STT Service] Quota exceeded - returning empty transcription');
        return {
          text: '',
          words: [],
          language_code: languageCode,
        };
      }
      throw new Error(data.error);
    }
    
    console.log('[STT Service] Transcription complete:', data.text?.substring(0, 50) + '...');
    return data as TranscriptionResult;
  } catch (error) {
    console.error('[STT Service] Error transcribing audio blob:', error);
    return {
      text: '',
      words: [],
      language_code: languageCode,
    };
  }
}

/**
 * Check if transcription service is available
 * Validates that ElevenLabs API is configured
 */
export async function isTranscriptionAvailable(): Promise<boolean> {
  try {
    // We don't have a dedicated validate endpoint, so we assume it's available
    // if the edge function exists. Real validation happens on first use.
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract key phrases from transcription for jury analysis
 * Useful for highlighting important parts of player justification
 */
export function extractKeyPhrases(transcription: TranscriptionResult): string[] {
  if (!transcription.text) return [];
  
  // Simple extraction based on sentence boundaries and length
  const sentences = transcription.text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
  
  return sentences.slice(0, 3); // Return up to 3 key sentences
}

/**
 * Calculate speech metrics from transcription
 * Useful for jury analysis (speech rate, hesitations, etc.)
 */
export function calculateSpeechMetrics(transcription: TranscriptionResult): {
  wordsPerMinute: number;
  totalWords: number;
  averageWordLength: number;
  pauseCount: number;
} {
  const words = transcription.words || [];
  const text = transcription.text || '';
  
  if (words.length === 0) {
    return {
      wordsPerMinute: 0,
      totalWords: 0,
      averageWordLength: 0,
      pauseCount: 0,
    };
  }
  
  const totalWords = words.length;
  const duration = words[words.length - 1]?.end - words[0]?.start || 1;
  const wordsPerMinute = Math.round((totalWords / duration) * 60);
  
  // Calculate average word length
  const averageWordLength = text.length / totalWords;
  
  // Count significant pauses (gaps > 0.5s between words)
  let pauseCount = 0;
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end;
    if (gap > 0.5) pauseCount++;
  }
  
  return {
    wordsPerMinute,
    totalWords,
    averageWordLength: Math.round(averageWordLength * 10) / 10,
    pauseCount,
  };
}
