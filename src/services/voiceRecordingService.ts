/**
 * Voice Recording Service
 * Persists voice recordings and metrics to database for Mycroft AI learning
 */

import { supabase } from '@/integrations/supabase/client';
import type { VoiceMetrics } from './audioForensicsService';

export interface VoiceRecordingData {
  roomId: string;
  playerId?: string;
  questionId?: string;
  roundNumber: number;
  audioUrl: string;
  metrics: VoiceMetrics;
  playerName?: string;
  sessionId?: string;
  mycroftVerdict?: string;
  mycroftForensicDetails?: string;
  wasBluffing?: boolean;
}

export interface StoredVoiceRecording {
  id: string;
  room_id: string;
  player_id: string | null;
  question_id: string | null;
  round_number: number;
  audio_url: string;
  avg_pitch: number | null;
  pitch_variance: number | null;
  pitch_stability: string | null;
  speech_rate_bpm: number | null;
  response_latency_ms: number | null;
  recording_duration_ms: number | null;
  peak_amplitude: number | null;
  jitter: number | null;
  jitter_absolute: number | null;
  shimmer: number | null;
  harmonics_to_noise: number | null;
  stress_score: number | null;
  stress_level: string | null;
  pitch_deviation: number | null;
  latency_deviation: number | null;
  speech_rate_deviation: number | null;
  jitter_deviation: number | null;
  mycroft_verdict: string | null;
  mycroft_forensic_details: string | null;
  was_bluffing: boolean | null;
  player_name: string | null;
  session_id: string | null;
  created_at: string;
}

/**
 * Save voice recording and metrics to database
 */
export async function saveVoiceRecording(data: VoiceRecordingData): Promise<string | null> {
  try {
    const { metrics } = data;
    
    const insertData = {
      room_id: data.roomId,
      player_id: data.playerId || null,
      question_id: data.questionId || null,
      round_number: data.roundNumber,
      audio_url: data.audioUrl,
      
      // Voice Metrics
      avg_pitch: metrics.avgPitch,
      pitch_variance: metrics.pitchVariance,
      pitch_stability: metrics.pitchStability,
      speech_rate_bpm: metrics.speechRateBPM,
      response_latency_ms: metrics.responseLatencyMs,
      recording_duration_ms: metrics.recordingDurationMs,
      peak_amplitude: metrics.peakAmplitude,
      
      // Advanced Forensics
      jitter: metrics.jitter,
      jitter_absolute: metrics.jitterAbsolute,
      shimmer: metrics.shimmer,
      harmonics_to_noise: metrics.harmonicsToNoise,
      
      // Stress Analysis
      stress_score: metrics.stressDeviation?.overallStressScore || null,
      stress_level: metrics.stressDeviation?.stressLevel || null,
      pitch_deviation: metrics.stressDeviation?.pitchDeviation || null,
      latency_deviation: metrics.stressDeviation?.latencyDeviation || null,
      speech_rate_deviation: metrics.stressDeviation?.speechRateDeviation || null,
      jitter_deviation: metrics.stressDeviation?.jitterDeviation || null,
      
      // Mycroft Analysis
      mycroft_verdict: data.mycroftVerdict || null,
      mycroft_forensic_details: data.mycroftForensicDetails || null,
      was_bluffing: data.wasBluffing ?? null,
      
      // Metadata
      player_name: data.playerName || null,
      session_id: data.sessionId || null,
    };

    const { data: result, error } = await supabase
      .from('voice_recordings')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('[VoiceRecordingService] Error saving recording:', error);
      return null;
    }

    console.log('[VoiceRecordingService] ✅ Recording saved:', result.id);
    return result.id;
  } catch (err) {
    console.error('[VoiceRecordingService] Exception saving recording:', err);
    return null;
  }
}

/**
 * Update a voice recording with Mycroft analysis results
 */
export async function updateWithMycroftAnalysis(
  recordingId: string,
  verdict: string,
  forensicDetails: string,
  wasBluffing?: boolean
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {
      mycroft_verdict: verdict,
      mycroft_forensic_details: forensicDetails,
    };
    
    if (wasBluffing !== undefined) {
      updateData.was_bluffing = wasBluffing;
    }

    const { error } = await supabase
      .from('voice_recordings')
      .update(updateData)
      .eq('id', recordingId);

    if (error) {
      console.error('[VoiceRecordingService] Error updating Mycroft analysis:', error);
      return false;
    }

    console.log('[VoiceRecordingService] ✅ Mycroft analysis saved for:', recordingId);
    return true;
  } catch (err) {
    console.error('[VoiceRecordingService] Exception updating analysis:', err);
    return false;
  }
}

/**
 * Get metrics history for a room (for chart display)
 */
export async function getMetricsHistoryForRoom(roomId: string): Promise<{
  round: number;
  pitch: number;
  latency: number;
  jitter: number;
  stressScore: number;
  playerName?: string;
}[]> {
  try {
    const { data, error } = await supabase
      .from('voice_recordings')
      .select('round_number, avg_pitch, response_latency_ms, jitter, stress_score, player_name')
      .eq('room_id', roomId)
      .order('round_number', { ascending: true });

    if (error) {
      console.error('[VoiceRecordingService] Error fetching history:', error);
      return [];
    }

    return (data || []).map((r) => ({
      round: r.round_number,
      pitch: r.avg_pitch || 0,
      latency: r.response_latency_ms || 0,
      jitter: r.jitter || 0,
      stressScore: r.stress_score || 0,
      playerName: r.player_name || undefined,
    }));
  } catch (err) {
    console.error('[VoiceRecordingService] Exception fetching history:', err);
    return [];
  }
}

/**
 * Get all recordings for a player (for ML training data)
 */
export async function getRecordingsForPlayer(playerId: string): Promise<StoredVoiceRecording[]> {
  try {
    const { data, error } = await supabase
      .from('voice_recordings')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[VoiceRecordingService] Error fetching player recordings:', error);
      return [];
    }

    return data as StoredVoiceRecording[];
  } catch (err) {
    console.error('[VoiceRecordingService] Exception fetching player recordings:', err);
    return [];
  }
}

/**
 * Get training dataset - all recordings with ground truth labels
 */
export async function getTrainingDataset(): Promise<StoredVoiceRecording[]> {
  try {
    const { data, error } = await supabase
      .from('voice_recordings')
      .select('*')
      .not('was_bluffing', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[VoiceRecordingService] Error fetching training data:', error);
      return [];
    }

    return data as StoredVoiceRecording[];
  } catch (err) {
    console.error('[VoiceRecordingService] Exception fetching training data:', err);
    return [];
  }
}

/**
 * Mark a recording with ground truth (was the player actually bluffing?)
 */
export async function markBluffingGroundTruth(
  recordingId: string,
  wasBluffing: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('voice_recordings')
      .update({ was_bluffing: wasBluffing })
      .eq('id', recordingId);

    if (error) {
      console.error('[VoiceRecordingService] Error marking ground truth:', error);
      return false;
    }

    console.log('[VoiceRecordingService] ✅ Ground truth marked:', recordingId, wasBluffing);
    return true;
  } catch (err) {
    console.error('[VoiceRecordingService] Exception marking ground truth:', err);
    return false;
  }
}
