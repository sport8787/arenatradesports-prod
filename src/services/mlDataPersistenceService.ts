/**
 * ML Data Persistence Service
 * Handles saving all data required for Mycroft AI training
 */

import { supabase } from '@/integrations/supabase/client';
import type { VoiceMetrics } from './audioForensicsService';

// ============================================
// TYPES
// ============================================

export interface MatchData {
  roomId?: string;
  gameMode: 'solo' | 'multiplayer' | 'presenter';
  difficultyMode: 'aquecimento' | 'desafio' | 'extremo';
  totalRounds: number;
  playerSessionId?: string;
  playerUserId?: string;
}

export interface RecordingMLData {
  matchId?: string;
  roomId?: string;
  playerId?: string;
  questionId?: string;
  roundNumber: number;
  audioUrl: string;
  videoUrl?: string;
  
  // Capture metadata
  captureMode: 'audio' | 'video';
  deviceType: 'desktop' | 'mobile' | 'tablet';
  consentLevel: 'metrics_only' | 'training_opt_in';
  
  // Question context
  questionDifficulty?: string;
  questionCategory?: string;
  answerWasCorrect?: boolean;
  timeToAnswerMs?: number;
  
  // Voice metrics
  voiceMetrics: VoiceMetrics;
  
  // Facial metrics (if video mode)
  facialAnalysis?: {
    eyeGazeDominant?: string;
    microExpressionsDetected?: string[];
    blinkRate?: number;
    browAsymmetry?: number;
    lipTension?: number;
    facialStressScore?: number;
  };
  
  // Mycroft analysis
  mycroftVerdict?: string;
  mycroftForensicDetails?: string;
  combinedSuspicionScore?: number;
  
  // Player info
  playerName?: string;
  sessionId?: string;
  wasBluffing?: boolean;
}

export interface JuryVoteData {
  roomId: string;
  questionId: string;
  playerId: string;
  recordingId?: string;
  voterType: 'human' | 'ai';
  aiProfile?: 'prudente' | 'tubarao' | 'quant';
  voteType: 'believe' | 'doubt';
  confidenceLevel?: number;
  reasoning?: string;
}

export interface ConsentData {
  userId?: string;
  sessionId?: string;
  consentType: 'mycroft_analysis' | 'training_opt_in' | 'video_capture';
  consentGiven: boolean;
  consentVersion?: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  const ua = navigator.userAgent.toLowerCase();
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

// ============================================
// MATCH PERSISTENCE
// ============================================

export async function createMatch(data: MatchData): Promise<string | null> {
  try {
    const insertData = {
      room_id: data.roomId || null,
      game_mode: data.gameMode,
      difficulty_mode: data.difficultyMode,
      total_rounds: data.totalRounds,
      device_type: getDeviceType(),
      user_agent: navigator.userAgent,
      player_session_id: data.playerSessionId || null,
      player_user_id: data.playerUserId || null,
    };

    const { data: result, error } = await supabase
      .from('matches')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('[MLDataService] Error creating match:', error);
      return null;
    }

    console.log('[MLDataService] ✅ Match created:', result.id);
    return result.id;
  } catch (err) {
    console.error('[MLDataService] Exception creating match:', err);
    return null;
  }
}

export async function updateMatchEnd(
  matchId: string,
  finalScore: number,
  roundsCompleted: number,
  wasCompleted: boolean
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('matches')
      .update({
        ended_at: new Date().toISOString(),
        final_score: finalScore,
        rounds_completed: roundsCompleted,
        was_completed: wasCompleted,
      })
      .eq('id', matchId);

    if (error) {
      console.error('[MLDataService] Error updating match:', error);
      return false;
    }

    console.log('[MLDataService] ✅ Match ended:', matchId);
    return true;
  } catch (err) {
    console.error('[MLDataService] Exception updating match:', err);
    return false;
  }
}

// ============================================
// RECORDING PERSISTENCE (EXTENDED)
// ============================================

export async function saveRecordingWithMLData(data: RecordingMLData): Promise<string | null> {
  try {
    const { voiceMetrics, facialAnalysis } = data;
    
    const insertData = {
      // Core fields
      match_id: data.matchId || null,
      room_id: data.roomId || null,
      player_id: data.playerId || null,
      question_id: data.questionId || null,
      round_number: data.roundNumber,
      audio_url: data.audioUrl,
      video_url: data.videoUrl || null,
      
      // Capture metadata
      capture_mode: data.captureMode,
      device_type: data.deviceType,
      consent_level: data.consentLevel,
      
      // Question context
      question_difficulty: data.questionDifficulty || null,
      question_category: data.questionCategory || null,
      answer_was_correct: data.answerWasCorrect ?? null,
      time_to_answer_ms: data.timeToAnswerMs || null,
      
      // Voice Metrics - Basic
      avg_pitch: voiceMetrics.avgPitch ?? null,
      pitch_variance: voiceMetrics.pitchVariance ?? null,
      pitch_stability: voiceMetrics.pitchStability ?? null,
      speech_rate_bpm: voiceMetrics.speechRateBPM ?? null,
      response_latency_ms: voiceMetrics.responseLatencyMs ?? null,
      recording_duration_ms: voiceMetrics.recordingDurationMs ?? null,
      peak_amplitude: voiceMetrics.peakAmplitude ?? null,
      
      // Voice Metrics - Advanced Forensics
      jitter: voiceMetrics.jitter ?? null,
      jitter_absolute: voiceMetrics.jitterAbsolute ?? null,
      shimmer: voiceMetrics.shimmer ?? null,
      harmonics_to_noise: voiceMetrics.harmonicsToNoise ?? null,
      
      // Voice Metrics - New V2 fields
      words_per_minute: voiceMetrics.speechRateBPM ?? null, // Using speechRateBPM as WPM proxy
      silent_periods_count: voiceMetrics.silentPeriods ?? null,
      longest_pause_ms: voiceMetrics.longestPause ?? null,
      filler_words_count: voiceMetrics.fillerWordsCount ?? null,
      speech_continuity: voiceMetrics.speechContinuity ?? null,
      
      // Stress Analysis
      stress_score: voiceMetrics.stressDeviation?.overallStressScore ?? null,
      stress_level: voiceMetrics.stressDeviation?.stressLevel ?? null,
      pitch_deviation: voiceMetrics.stressDeviation?.pitchDeviation ?? null,
      latency_deviation: voiceMetrics.stressDeviation?.latencyDeviation ?? null,
      speech_rate_deviation: voiceMetrics.stressDeviation?.speechRateDeviation ?? null,
      jitter_deviation: voiceMetrics.stressDeviation?.jitterDeviation ?? null,
      
      // Facial Metrics
      eye_gaze_dominant: facialAnalysis?.eyeGazeDominant ?? null,
      micro_expressions_detected: facialAnalysis?.microExpressionsDetected ?? null,
      blink_rate: facialAnalysis?.blinkRate ?? null,
      brow_asymmetry: facialAnalysis?.browAsymmetry ?? null,
      lip_tension: facialAnalysis?.lipTension ?? null,
      facial_stress_score: facialAnalysis?.facialStressScore ?? null,
      facial_analysis_json: facialAnalysis ? JSON.stringify(facialAnalysis) : null,
      
      // Mycroft Analysis
      mycroft_verdict: data.mycroftVerdict ?? null,
      mycroft_forensic_details: data.mycroftForensicDetails ?? null,
      combined_suspicion_score: data.combinedSuspicionScore ?? null,
      
      // Ground truth
      was_bluffing: data.wasBluffing ?? null,
      
      // Metadata
      player_name: data.playerName ?? null,
      session_id: data.sessionId ?? null,
    };

    const { data: result, error } = await supabase
      .from('voice_recordings')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('[MLDataService] Error saving recording:', error);
      return null;
    }

    console.log('[MLDataService] ✅ Recording saved with ML data:', result.id);
    return result.id;
  } catch (err) {
    console.error('[MLDataService] Exception saving recording:', err);
    return null;
  }
}

// ============================================
// JURY VOTE PERSISTENCE
// ============================================

export async function saveJuryVote(data: JuryVoteData): Promise<string | null> {
  try {
    const insertData = {
      room_id: data.roomId,
      question_id: data.questionId,
      player_id: data.playerId,
      recording_id: data.recordingId || null,
      voter_type: data.voterType,
      ai_profile: data.aiProfile || null,
      vote_type: data.voteType,
      confidence_level: data.confidenceLevel || null,
      reasoning: data.reasoning || null,
    };

    const { data: result, error } = await supabase
      .from('votes')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('[MLDataService] Error saving jury vote:', error);
      return null;
    }

    console.log('[MLDataService] ✅ Jury vote saved:', result.id, data.voterType, data.voteType);
    return result.id;
  } catch (err) {
    console.error('[MLDataService] Exception saving jury vote:', err);
    return null;
  }
}

export async function saveAIJuryVotes(
  roomId: string,
  questionId: string,
  playerId: string,
  recordingId: string | undefined,
  votes: Array<{
    profile: 'prudente' | 'tubarao' | 'quant';
    vote: 'believe' | 'doubt';
    confidence: number;
    reasoning: string;
  }>
): Promise<boolean> {
  try {
    const inserts = votes.map(v => ({
      room_id: roomId,
      question_id: questionId,
      player_id: playerId,
      recording_id: recordingId || null,
      voter_type: 'ai' as const,
      ai_profile: v.profile,
      vote_type: v.vote,
      confidence_level: v.confidence,
      reasoning: v.reasoning,
    }));

    const { error } = await supabase
      .from('votes')
      .insert(inserts);

    if (error) {
      console.error('[MLDataService] Error saving AI jury votes:', error);
      return false;
    }

    console.log('[MLDataService] ✅ AI jury votes saved:', votes.length);
    return true;
  } catch (err) {
    console.error('[MLDataService] Exception saving AI jury votes:', err);
    return false;
  }
}

// ============================================
// TRAINING LABEL GENERATION
// ============================================

export async function generateTrainingLabel(recordingId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .rpc('generate_training_label', { p_recording_id: recordingId });

    if (error) {
      console.error('[MLDataService] Error generating training label:', error);
      return null;
    }

    console.log('[MLDataService] ✅ Training label generated:', data);
    return data;
  } catch (err) {
    console.error('[MLDataService] Exception generating training label:', err);
    return null;
  }
}

// ============================================
// CONSENT TRACKING (LGPD)
// ============================================

export async function recordConsent(data: ConsentData): Promise<boolean> {
  try {
    const insertData = {
      user_id: data.userId || null,
      session_id: data.sessionId || null,
      consent_type: data.consentType,
      consent_given: data.consentGiven,
      consent_version: data.consentVersion || '1.0',
      user_agent: navigator.userAgent,
      ip_hash: null, // We don't track IP for privacy
    };

    const { error } = await supabase
      .from('consent_records')
      .insert(insertData);

    if (error) {
      console.error('[MLDataService] Error recording consent:', error);
      return false;
    }

    console.log('[MLDataService] ✅ Consent recorded:', data.consentType, data.consentGiven);
    return true;
  } catch (err) {
    console.error('[MLDataService] Exception recording consent:', err);
    return false;
  }
}

export async function revokeConsent(
  userId: string | undefined,
  sessionId: string | undefined,
  consentType: string
): Promise<boolean> {
  try {
    let query = supabase
      .from('consent_records')
      .update({ revoked_at: new Date().toISOString() })
      .eq('consent_type', consentType)
      .is('revoked_at', null);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { error } = await query;

    if (error) {
      console.error('[MLDataService] Error revoking consent:', error);
      return false;
    }

    console.log('[MLDataService] ✅ Consent revoked:', consentType);
    return true;
  } catch (err) {
    console.error('[MLDataService] Exception revoking consent:', err);
    return false;
  }
}

// ============================================
// ML DATASET QUERIES
// ============================================

export async function getTrainingDataset(options?: {
  minQuality?: 'high' | 'medium' | 'low';
  onlyOptIn?: boolean;
  limit?: number;
}): Promise<any[]> {
  try {
    let query = supabase
      .from('training_labels')
      .select(`
        *,
        voice_recordings!inner (
          jitter, shimmer, avg_pitch, response_latency_ms,
          stress_score, facial_stress_score, combined_suspicion_score,
          capture_mode, consent_level, question_difficulty,
          silent_periods_count, longest_pause_ms, filler_words_count,
          speech_continuity, blink_rate, brow_asymmetry, lip_tension
        )
      `)
      .eq('is_valid_for_training', true)
      .order('created_at', { ascending: false });

    if (options?.minQuality === 'high') {
      query = query.eq('label_quality', 'high');
    } else if (options?.minQuality === 'medium') {
      query = query.in('label_quality', ['high', 'medium']);
    }

    if (options?.onlyOptIn) {
      query = query.eq('voice_recordings.consent_level', 'training_opt_in');
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[MLDataService] Error fetching training dataset:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[MLDataService] Exception fetching training dataset:', err);
    return [];
  }
}

export async function getDatasetStats(): Promise<{
  totalRecordings: number;
  totalLabels: number;
  highQualityLabels: number;
  optInRecordings: number;
  bluffLabels: number;
  truthLabels: number;
}> {
  try {
    const [recordings, labels, highQuality, optIn, bluff, truth] = await Promise.all([
      supabase.from('voice_recordings').select('id', { count: 'exact', head: true }),
      supabase.from('training_labels').select('id', { count: 'exact', head: true }).eq('is_valid_for_training', true),
      supabase.from('training_labels').select('id', { count: 'exact', head: true }).eq('label_quality', 'high'),
      supabase.from('voice_recordings').select('id', { count: 'exact', head: true }).eq('consent_level', 'training_opt_in'),
      supabase.from('training_labels').select('id', { count: 'exact', head: true }).eq('final_label', 'BLEFE'),
      supabase.from('training_labels').select('id', { count: 'exact', head: true }).eq('final_label', 'CLARO'),
    ]);

    return {
      totalRecordings: recordings.count || 0,
      totalLabels: labels.count || 0,
      highQualityLabels: highQuality.count || 0,
      optInRecordings: optIn.count || 0,
      bluffLabels: bluff.count || 0,
      truthLabels: truth.count || 0,
    };
  } catch (err) {
    console.error('[MLDataService] Exception fetching dataset stats:', err);
    return {
      totalRecordings: 0,
      totalLabels: 0,
      highQualityLabels: 0,
      optInRecordings: 0,
      bluffLabels: 0,
      truthLabels: 0,
    };
  }
}
