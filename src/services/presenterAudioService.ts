/**
 * Service for handling audio upload and AI analysis in Presenter Mode
 * Now uses REAL voice metrics from audioForensicsService
 * + ElevenLabs TTS for Mycroft voice output
 */

import { supabase } from '@/integrations/supabase/client';
import type { VoiceMetrics } from './audioForensicsService';
import { PERSONAS } from '@/types/personas';

// Re-export VoiceMetrics for convenience
export type { VoiceMetrics };

// Mycroft voice configuration from personas
const MYCROFT_VOICE_ID = PERSONAS.mycroft.voiceId;
const MYCROFT_VOICE_SETTINGS = PERSONAS.mycroft.voiceSettings;

export interface MycroftAnalysisResult {
  verdict: string;
  confidence: number;
  forensicDetails: string;
}

/**
 * Upload audio blob to Supabase Storage
 */
export async function uploadAudioToStorage(
  audioBlob: Blob,
  roomId: string,
  playerId: string,
  round: number
): Promise<string | null> {
  try {
    const timestamp = Date.now();
    const fileName = `presenter-mode/${roomId}/${round}/${playerId}_${timestamp}.webm`;
    
    const { data, error } = await supabase.storage
      .from('game-audio')
      .upload(fileName, audioBlob, {
        contentType: 'audio/webm',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[PresenterAudio] Upload error:', error);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('game-audio')
      .getPublicUrl(fileName);

    console.log('[PresenterAudio] Uploaded to:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (err) {
    console.error('[PresenterAudio] Upload exception:', err);
    return null;
  }
}

/**
 * Analyze audio with Mycroft AI for vocal biometrics
 */
export async function analyzeWithMycroft(
  questionText: string,
  correctAnswer: string,
  userResponse: string,
  voiceMetrics: VoiceMetrics
): Promise<MycroftAnalysisResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('mycroft-ai', {
      body: {
        type: 'verdict',
        questionText,
        correctAnswer,
        userResponse,
        voiceMetrics
      }
    });

    if (error) {
      console.error('[PresenterAudio] Mycroft error:', error);
      return null;
    }

    return {
      verdict: data.verdict || data.analysis || 'Análise indisponível',
      confidence: data.confidence || 0.5,
      forensicDetails: data.forensicDetails || ''
    };
  } catch (err) {
    console.error('[PresenterAudio] Mycroft exception:', err);
    return null;
  }
}

/**
 * Generate Mycroft TTS audio via ElevenLabs
 * Returns audio URL that can be played
 */
export async function generateMycroftTTS(text: string): Promise<string | null> {
  try {
    console.log('[PresenterAudio] 🎙️ Generating Mycroft TTS for:', text.substring(0, 50) + '...');
    
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
          voiceId: MYCROFT_VOICE_ID,
          stability: MYCROFT_VOICE_SETTINGS.stability,
          similarityBoost: MYCROFT_VOICE_SETTINGS.similarityBoost,
          style: MYCROFT_VOICE_SETTINGS.style,
          useSpeakerBoost: MYCROFT_VOICE_SETTINGS.useSpeakerBoost,
          speed: MYCROFT_VOICE_SETTINGS.speed,
        }),
      }
    );

    if (!response.ok) {
      console.error('[PresenterAudio] TTS error:', response.status, response.statusText);
      return null;
    }

    // Convert response to blob and create object URL
    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    
    console.log('[PresenterAudio] ✅ Mycroft TTS generated successfully');
    return audioUrl;
  } catch (err) {
    console.error('[PresenterAudio] TTS exception:', err);
    return null;
  }
}

/**
 * Play Mycroft verdict audio
 * Generates TTS and plays it locally
 */
export async function playMycroftVerdict(
  verdictText: string,
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  try {
    onStart?.();
    
    const audioUrl = await generateMycroftTTS(verdictText);
    
    if (!audioUrl) {
      console.error('[PresenterAudio] Failed to generate Mycroft TTS');
      onEnd?.();
      return;
    }

    const audio = new Audio(audioUrl);
    
    audio.onended = () => {
      console.log('[PresenterAudio] Mycroft audio finished playing');
      URL.revokeObjectURL(audioUrl); // Clean up
      onEnd?.();
    };
    
    audio.onerror = (e) => {
      console.error('[PresenterAudio] Audio playback error:', e);
      URL.revokeObjectURL(audioUrl);
      onEnd?.();
    };

    await audio.play();
    console.log('[PresenterAudio] 🔊 Playing Mycroft verdict audio');
  } catch (err) {
    console.error('[PresenterAudio] playMycroftVerdict exception:', err);
    onEnd?.();
  }
}

/**
 * Full pipeline: Upload audio + Analyze with Mycroft
 * Now accepts REAL voice metrics from audioForensicsService
 */
export async function processRecordedAudio(
  audioBlob: Blob,
  voiceMetrics: VoiceMetrics, // Real metrics from audioForensicsService
  roomId: string,
  playerId: string,
  round: number,
  questionText: string,
  correctAnswer: string,
  userResponse: string
): Promise<{
  audioUrl: string | null;
  analysis: MycroftAnalysisResult | null;
  metrics: VoiceMetrics;
}> {
  console.log('[PresenterAudio] Processing with REAL voice metrics:', voiceMetrics);
  
  // 1. Upload to storage
  const audioUrl = await uploadAudioToStorage(audioBlob, roomId, playerId, round);
  
  // 2. Analyze with Mycroft using REAL metrics
  const analysis = await analyzeWithMycroft(
    questionText,
    correctAnswer,
    userResponse,
    voiceMetrics
  );

  return { audioUrl, analysis, metrics: voiceMetrics };
}
