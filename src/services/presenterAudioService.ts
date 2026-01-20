/**
 * Service for handling audio upload and AI analysis in Presenter Mode
 */

import { supabase } from '@/integrations/supabase/client';

export interface VoiceMetrics {
  responseLatencyMs: number;
  pitchStability: 'stable' | 'unstable' | 'micro-tremors';
  speechRateBPM: number;
  avgPitch: number;
  pitchVariance: number;
  peakAmplitude: number;
  recordingDurationMs: number;
}

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
 * Generate simulated voice metrics from recording duration
 * (Real implementation would analyze actual audio data)
 */
export function generateSimulatedMetrics(recordingDurationMs: number): VoiceMetrics {
  // Simulate realistic metrics based on recording duration
  const baseLatency = 500 + Math.random() * 1500;
  const isHesitant = recordingDurationMs > 15000;
  const isFast = recordingDurationMs < 5000;
  
  return {
    responseLatencyMs: Math.round(baseLatency),
    pitchStability: isHesitant ? 'unstable' : (isFast ? 'micro-tremors' : 'stable'),
    speechRateBPM: isFast ? 200 + Math.random() * 50 : 120 + Math.random() * 60,
    avgPitch: 180 + Math.random() * 80,
    pitchVariance: isHesitant ? 300 + Math.random() * 200 : 50 + Math.random() * 100,
    peakAmplitude: 0.6 + Math.random() * 0.3,
    recordingDurationMs
  };
}

/**
 * Full pipeline: Upload audio + Analyze with Mycroft
 */
export async function processRecordedAudio(
  audioBlob: Blob,
  recordingDurationMs: number,
  roomId: string,
  playerId: string,
  round: number,
  questionText: string,
  correctAnswer: string,
  userResponse: string
): Promise<{
  audioUrl: string | null;
  analysis: MycroftAnalysisResult | null;
}> {
  // 1. Upload to storage
  const audioUrl = await uploadAudioToStorage(audioBlob, roomId, playerId, round);
  
  // 2. Generate voice metrics (simulated for now)
  const voiceMetrics = generateSimulatedMetrics(recordingDurationMs);
  
  // 3. Analyze with Mycroft
  const analysis = await analyzeWithMycroft(
    questionText,
    correctAnswer,
    userResponse,
    voiceMetrics
  );

  return { audioUrl, analysis };
}
