/**
 * Service for handling audio upload and AI analysis in Presenter Mode
 * Now uses REAL voice metrics from audioForensicsService
 */

import { supabase } from '@/integrations/supabase/client';
import type { VoiceMetrics } from './audioForensicsService';

// Re-export VoiceMetrics for convenience
export type { VoiceMetrics };

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
