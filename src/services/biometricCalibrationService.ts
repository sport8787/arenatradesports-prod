/**
 * Biometric Calibration Service
 * Captures truth and lie baselines from player before game starts
 * Similar to polygraph calibration for more accurate analysis
 * Now persists to Supabase with behavior_id for user tracking
 */

import type { VoiceMetrics } from '@/services/audioForensicsService';
import type { VideoForensicsResult } from '@/services/videoForensicsService';
import { supabase } from '@/integrations/supabase/client';

// Calibration questions with instructions
export interface CalibrationQuestion {
  id: 'truth' | 'lie';
  instruction: string;
  question: string;
  hint: string;
}

export const CALIBRATION_QUESTIONS: CalibrationQuestion[] = [
  {
    id: 'truth',
    instruction: '🟢 FALE A VERDADE',
    question: 'Qual é a sua cor favorita?',
    hint: 'Responda honestamente sobre sua cor preferida real.',
  },
  {
    id: 'lie',
    instruction: '🔴 AGORA MINTA',
    question: 'Qual é o seu esporte favorito?',
    hint: 'Invente um esporte que você NÃO gosta como se fosse seu favorito.',
  },
];

// Baseline data structure
export interface BiometricBaseline {
  id?: string; // Database ID (behavior_id)
  // Vocal metrics baseline
  vocal: {
    truth: {
      avgPitch: number;
      pitchVariance: number;
      jitter: number;
      shimmer: number;
      speechRate: number;
      responseLatency: number;
      silentPeriods: number;
      longestPause: number;
      speechContinuity: number;
    };
    lie: {
      avgPitch: number;
      pitchVariance: number;
      jitter: number;
      shimmer: number;
      speechRate: number;
      responseLatency: number;
      silentPeriods: number;
      longestPause: number;
      speechContinuity: number;
    };
  };
  // Facial metrics baseline (if video mode)
  facial?: {
    truth: {
      blinkRate: number;
      lipTension: number;
      browAsymmetry: number;
      facialStressScore: number;
      gazeDeviation: number;
      mouthOpenness: number;
      faceSymmetry: number;
    };
    lie: {
      blinkRate: number;
      lipTension: number;
      browAsymmetry: number;
      facialStressScore: number;
      gazeDeviation: number;
      mouthOpenness: number;
      faceSymmetry: number;
    };
  };
  // Calculated deviation thresholds
  thresholds: {
    pitchDeviationThreshold: number; // % change that indicates potential lie
    jitterDeviationThreshold: number;
    stressScoreDeviationThreshold: number;
    blinkRateDeviationThreshold: number;
    lipTensionDeviationThreshold: number;
  };
  // Metadata
  calibratedAt: string;
  captureMode: 'audio' | 'video';
  sessionId: string;
}

// Storage key for baseline (local cache)
const BASELINE_STORAGE_KEY = 'blefador_biometric_baseline';
const BASELINE_EXPIRY_HOURS = 24; // Baseline válido por 24h

// Helper to get session ID
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('blefador_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('blefador_session_id', sessionId);
  }
  return sessionId;
}

/**
 * Extract vocal baseline from VoiceMetrics
 */
function extractVocalBaseline(metrics: VoiceMetrics) {
  return {
    avgPitch: metrics.avgPitch,
    pitchVariance: metrics.pitchVariance,
    jitter: metrics.jitter,
    shimmer: metrics.shimmer,
    speechRate: metrics.speechRateBPM,
    responseLatency: metrics.responseLatencyMs,
    silentPeriods: metrics.silentPeriods,
    longestPause: metrics.longestPause,
    speechContinuity: metrics.speechContinuity,
  };
}

/**
 * Extract facial baseline from VideoForensicsResult
 */
function extractFacialBaseline(result: VideoForensicsResult) {
  return {
    blinkRate: result.facialStress.blinkRate,
    lipTension: result.facialStress.lipTension,
    browAsymmetry: result.facialStress.browAsymmetry,
    facialStressScore: result.facialStress.overallScore,
    gazeDeviation: result.eyeGaze.directionChanges,
    mouthOpenness: result.advancedMetrics?.mouthMetrics?.openness || 0,
    faceSymmetry: result.advancedMetrics?.faceSymmetry?.overall || 1,
  };
}

/**
 * Calculate deviation thresholds based on truth vs lie differences
 */
function calculateThresholds(
  truthVocal: ReturnType<typeof extractVocalBaseline>,
  lieVocal: ReturnType<typeof extractVocalBaseline>,
  truthFacial?: ReturnType<typeof extractFacialBaseline>,
  lieFacial?: ReturnType<typeof extractFacialBaseline>
) {
  // Calculate % difference between truth and lie for each metric
  const pitchDiff = Math.abs(lieVocal.avgPitch - truthVocal.avgPitch) / Math.max(truthVocal.avgPitch, 1);
  const jitterDiff = Math.abs(lieVocal.jitter - truthVocal.jitter) / Math.max(truthVocal.jitter, 0.01);
  
  // Stress score deviation
  let stressScoreDiff = 0;
  let blinkRateDiff = 0;
  let lipTensionDiff = 0;
  
  if (truthFacial && lieFacial) {
    stressScoreDiff = Math.abs(lieFacial.facialStressScore - truthFacial.facialStressScore);
    blinkRateDiff = Math.abs(lieFacial.blinkRate - truthFacial.blinkRate) / Math.max(truthFacial.blinkRate, 1);
    lipTensionDiff = Math.abs(lieFacial.lipTension - truthFacial.lipTension);
  }
  
  // Set thresholds at 50% of detected difference (to catch similar patterns)
  return {
    pitchDeviationThreshold: Math.max(pitchDiff * 0.5, 0.05), // Mínimo 5%
    jitterDeviationThreshold: Math.max(jitterDiff * 0.5, 0.1), // Mínimo 10%
    stressScoreDeviationThreshold: Math.max(stressScoreDiff * 0.5, 5), // Mínimo 5 pontos
    blinkRateDeviationThreshold: Math.max(blinkRateDiff * 0.5, 0.1), // Mínimo 10%
    lipTensionDeviationThreshold: Math.max(lipTensionDiff * 0.5, 0.05), // Mínimo 5%
  };
}

/**
 * Create and save biometric baseline from calibration data
 */
export function createBiometricBaseline(
  truthVoice: VoiceMetrics,
  lieVoice: VoiceMetrics,
  truthVideo?: VideoForensicsResult,
  lieVideo?: VideoForensicsResult,
  sessionId?: string
): BiometricBaseline {
  const truthVocal = extractVocalBaseline(truthVoice);
  const lieVocal = extractVocalBaseline(lieVoice);
  
  const truthFacial = truthVideo ? extractFacialBaseline(truthVideo) : undefined;
  const lieFacial = lieVideo ? extractFacialBaseline(lieVideo) : undefined;
  
  const thresholds = calculateThresholds(truthVocal, lieVocal, truthFacial, lieFacial);
  
  const baseline: BiometricBaseline = {
    vocal: {
      truth: truthVocal,
      lie: lieVocal,
    },
    facial: truthFacial && lieFacial ? {
      truth: truthFacial,
      lie: lieFacial,
    } : undefined,
    thresholds,
    calibratedAt: new Date().toISOString(),
    captureMode: truthVideo ? 'video' : 'audio',
    sessionId: sessionId || `cal_${Date.now()}`,
  };
  
  // Save to localStorage
  saveBaseline(baseline);
  
  console.log('[BiometricCalibration] ✅ Baseline criado:', {
    thresholds,
    vocalDiffs: {
      pitch: `${((lieVocal.avgPitch - truthVocal.avgPitch) / truthVocal.avgPitch * 100).toFixed(1)}%`,
      jitter: `${((lieVocal.jitter - truthVocal.jitter) / Math.max(truthVocal.jitter, 0.01) * 100).toFixed(1)}%`,
    },
  });
  
  return baseline;
}

/**
 * Save baseline to localStorage (cache) and Supabase (persistence)
 */
async function saveBaseline(baseline: BiometricBaseline): Promise<string | null> {
  try {
    // Save to localStorage as cache
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baseline));
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = getSessionId();
    
    // Prepare data for Supabase
    const dbData = {
      user_id: user?.id || null,
      session_id: sessionId,
      
      // Vocal - Truth
      truth_avg_pitch: baseline.vocal.truth.avgPitch,
      truth_pitch_variance: baseline.vocal.truth.pitchVariance,
      truth_jitter: baseline.vocal.truth.jitter,
      truth_shimmer: baseline.vocal.truth.shimmer,
      truth_speech_rate: baseline.vocal.truth.speechRate,
      truth_response_latency: baseline.vocal.truth.responseLatency,
      truth_silent_periods: baseline.vocal.truth.silentPeriods,
      truth_longest_pause: baseline.vocal.truth.longestPause,
      truth_speech_continuity: baseline.vocal.truth.speechContinuity,
      
      // Vocal - Lie
      lie_avg_pitch: baseline.vocal.lie.avgPitch,
      lie_pitch_variance: baseline.vocal.lie.pitchVariance,
      lie_jitter: baseline.vocal.lie.jitter,
      lie_shimmer: baseline.vocal.lie.shimmer,
      lie_speech_rate: baseline.vocal.lie.speechRate,
      lie_response_latency: baseline.vocal.lie.responseLatency,
      lie_silent_periods: baseline.vocal.lie.silentPeriods,
      lie_longest_pause: baseline.vocal.lie.longestPause,
      lie_speech_continuity: baseline.vocal.lie.speechContinuity,
      
      // Facial - Truth (if available)
      truth_blink_rate: baseline.facial?.truth.blinkRate,
      truth_lip_tension: baseline.facial?.truth.lipTension,
      truth_brow_asymmetry: baseline.facial?.truth.browAsymmetry,
      truth_facial_stress_score: baseline.facial?.truth.facialStressScore,
      truth_gaze_deviation: baseline.facial?.truth.gazeDeviation,
      truth_mouth_openness: baseline.facial?.truth.mouthOpenness,
      truth_face_symmetry: baseline.facial?.truth.faceSymmetry,
      
      // Facial - Lie (if available)
      lie_blink_rate: baseline.facial?.lie.blinkRate,
      lie_lip_tension: baseline.facial?.lie.lipTension,
      lie_brow_asymmetry: baseline.facial?.lie.browAsymmetry,
      lie_facial_stress_score: baseline.facial?.lie.facialStressScore,
      lie_gaze_deviation: baseline.facial?.lie.gazeDeviation,
      lie_mouth_openness: baseline.facial?.lie.mouthOpenness,
      lie_face_symmetry: baseline.facial?.lie.faceSymmetry,
      
      // Thresholds
      pitch_deviation_threshold: baseline.thresholds.pitchDeviationThreshold,
      jitter_deviation_threshold: baseline.thresholds.jitterDeviationThreshold,
      stress_score_deviation_threshold: baseline.thresholds.stressScoreDeviationThreshold,
      blink_rate_deviation_threshold: baseline.thresholds.blinkRateDeviationThreshold,
      lip_tension_deviation_threshold: baseline.thresholds.lipTensionDeviationThreshold,
      
      // Metadata
      capture_mode: baseline.captureMode,
      calibrated_at: baseline.calibratedAt,
      expires_at: new Date(new Date(baseline.calibratedAt).getTime() + BASELINE_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
    };
    
    // Insert into Supabase
    const { data, error } = await supabase
      .from('biometric_baselines')
      .insert(dbData)
      .select('id')
      .single();
    
    if (error) {
      console.error('[BiometricCalibration] Failed to save to database:', error);
      return null;
    }
    
    console.log('[BiometricCalibration] ✅ Baseline saved to database with behavior_id:', data.id);
    return data.id;
  } catch (e) {
    console.error('[BiometricCalibration] Failed to save baseline:', e);
    return null;
  }
}

/**
 * Load baseline from Supabase (or localStorage cache)
 */
export async function loadBaseline(): Promise<BiometricBaseline | null> {
  try {
    // First check localStorage cache
    const cached = localStorage.getItem(BASELINE_STORAGE_KEY);
    if (cached) {
      const baseline: BiometricBaseline = JSON.parse(cached);
      const calibratedAt = new Date(baseline.calibratedAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - calibratedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursDiff <= BASELINE_EXPIRY_HOURS) {
        return baseline;
      }
    }
    
    // Try to load from database
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = getSessionId();
    
    // Query for valid baseline
    let query = supabase
      .from('biometric_baselines')
      .select('*')
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .order('calibrated_at', { ascending: false })
      .limit(1);
    
    if (user?.id) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.eq('session_id', sessionId);
    }
    
    const { data, error } = await query.maybeSingle();
    
    if (error || !data) {
      console.log('[BiometricCalibration] No valid baseline found in database');
      clearBaseline();
      return null;
    }
    
    // Convert database row to BiometricBaseline
    const baseline: BiometricBaseline = {
      id: data.id,
      vocal: {
        truth: {
          avgPitch: Number(data.truth_avg_pitch) || 0,
          pitchVariance: Number(data.truth_pitch_variance) || 0,
          jitter: Number(data.truth_jitter) || 0,
          shimmer: Number(data.truth_shimmer) || 0,
          speechRate: Number(data.truth_speech_rate) || 0,
          responseLatency: Number(data.truth_response_latency) || 0,
          silentPeriods: Number(data.truth_silent_periods) || 0,
          longestPause: Number(data.truth_longest_pause) || 0,
          speechContinuity: Number(data.truth_speech_continuity) || 0,
        },
        lie: {
          avgPitch: Number(data.lie_avg_pitch) || 0,
          pitchVariance: Number(data.lie_pitch_variance) || 0,
          jitter: Number(data.lie_jitter) || 0,
          shimmer: Number(data.lie_shimmer) || 0,
          speechRate: Number(data.lie_speech_rate) || 0,
          responseLatency: Number(data.lie_response_latency) || 0,
          silentPeriods: Number(data.lie_silent_periods) || 0,
          longestPause: Number(data.lie_longest_pause) || 0,
          speechContinuity: Number(data.lie_speech_continuity) || 0,
        },
      },
      thresholds: {
        pitchDeviationThreshold: Number(data.pitch_deviation_threshold) || 0.05,
        jitterDeviationThreshold: Number(data.jitter_deviation_threshold) || 0.1,
        stressScoreDeviationThreshold: Number(data.stress_score_deviation_threshold) || 5,
        blinkRateDeviationThreshold: Number(data.blink_rate_deviation_threshold) || 0.1,
        lipTensionDeviationThreshold: Number(data.lip_tension_deviation_threshold) || 0.05,
      },
      calibratedAt: data.calibrated_at,
      captureMode: data.capture_mode as 'audio' | 'video',
      sessionId: data.session_id || sessionId,
    };
    
    // Add facial data if available
    if (data.truth_blink_rate !== null && data.lie_blink_rate !== null) {
      baseline.facial = {
        truth: {
          blinkRate: Number(data.truth_blink_rate) || 0,
          lipTension: Number(data.truth_lip_tension) || 0,
          browAsymmetry: Number(data.truth_brow_asymmetry) || 0,
          facialStressScore: Number(data.truth_facial_stress_score) || 0,
          gazeDeviation: Number(data.truth_gaze_deviation) || 0,
          mouthOpenness: Number(data.truth_mouth_openness) || 0,
          faceSymmetry: Number(data.truth_face_symmetry) || 1,
        },
        lie: {
          blinkRate: Number(data.lie_blink_rate) || 0,
          lipTension: Number(data.lie_lip_tension) || 0,
          browAsymmetry: Number(data.lie_brow_asymmetry) || 0,
          facialStressScore: Number(data.lie_facial_stress_score) || 0,
          gazeDeviation: Number(data.lie_gaze_deviation) || 0,
          mouthOpenness: Number(data.lie_mouth_openness) || 0,
          faceSymmetry: Number(data.lie_face_symmetry) || 1,
        },
      };
    }
    
    // Cache it locally
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baseline));
    
    console.log('[BiometricCalibration] ✅ Baseline loaded from database:', data.id);
    return baseline;
  } catch (e) {
    console.error('[BiometricCalibration] Failed to load baseline:', e);
    return null;
  }
}

/**
 * Synchronous load from cache only (for quick checks)
 */
export function loadBaselineSync(): BiometricBaseline | null {
  try {
    const cached = localStorage.getItem(BASELINE_STORAGE_KEY);
    if (!cached) return null;
    
    const baseline: BiometricBaseline = JSON.parse(cached);
    const calibratedAt = new Date(baseline.calibratedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - calibratedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > BASELINE_EXPIRY_HOURS) {
      return null;
    }
    
    return baseline;
  } catch {
    return null;
  }
}

/**
 * Clear saved baseline (local and database)
 */
export async function clearBaseline(): Promise<void> {
  localStorage.removeItem(BASELINE_STORAGE_KEY);
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const sessionId = getSessionId();
    
    // Invalidate in database
    let query = supabase
      .from('biometric_baselines')
      .update({ is_valid: false })
      .eq('is_valid', true);
    
    if (user?.id) {
      query = query.eq('user_id', user.id);
    } else {
      query = query.eq('session_id', sessionId);
    }
    
    await query;
  } catch (e) {
    console.error('[BiometricCalibration] Failed to clear baseline in database:', e);
  }
}

/**
 * Check if valid baseline exists (sync check from cache)
 */
export function hasValidBaselineSync(): boolean {
  return loadBaselineSync() !== null;
}

/**
 * Check if valid baseline exists (async check including database)
 */
export async function hasValidBaseline(): Promise<boolean> {
  const baseline = await loadBaseline();
  return baseline !== null;
}

/**
 * Compare current metrics against baseline to detect deception probability
 * Returns a score from 0-100 where higher = more likely deception
 */
export function compareToBaseline(
  currentVoice: VoiceMetrics,
  currentVideo?: VideoForensicsResult,
  cachedBaseline?: BiometricBaseline | null
): { 
  deceptionScore: number; 
  signals: string[];
  matchesTruthPattern: boolean;
  matchesLiePattern: boolean;
  confidence: 'low' | 'medium' | 'high';
  baselineId?: string;
} {
  // Use cached baseline or sync load from localStorage
  const baseline = cachedBaseline ?? loadBaselineSync();
  
  if (!baseline) {
    return {
      deceptionScore: 50, // Neutral without baseline
      signals: ['Sem baseline de calibração'],
      matchesTruthPattern: false,
      matchesLiePattern: false,
      confidence: 'low',
      baselineId: undefined,
    };
  }
  
  const current = extractVocalBaseline(currentVoice);
  const signals: string[] = [];
  let deceptionPoints = 0;
  let totalChecks = 0;
  
  // === VOCAL ANALYSIS ===
  
  // Pitch comparison
  const truthPitchDiff = Math.abs(current.avgPitch - baseline.vocal.truth.avgPitch) / Math.max(baseline.vocal.truth.avgPitch, 1);
  const liePitchDiff = Math.abs(current.avgPitch - baseline.vocal.lie.avgPitch) / Math.max(baseline.vocal.lie.avgPitch, 1);
  
  if (liePitchDiff < truthPitchDiff) {
    deceptionPoints += 15;
    signals.push('Tom de voz similar ao padrão de mentira');
  }
  totalChecks++;
  
  // Jitter comparison (voice tremor)
  const truthJitterDiff = Math.abs(current.jitter - baseline.vocal.truth.jitter);
  const lieJitterDiff = Math.abs(current.jitter - baseline.vocal.lie.jitter);
  
  if (lieJitterDiff < truthJitterDiff) {
    deceptionPoints += 15;
    signals.push('Tremor vocal similar ao padrão de mentira');
  }
  totalChecks++;
  
  // Speech rate comparison
  const truthRateDiff = Math.abs(current.speechRate - baseline.vocal.truth.speechRate);
  const lieRateDiff = Math.abs(current.speechRate - baseline.vocal.lie.speechRate);
  
  if (lieRateDiff < truthRateDiff) {
    deceptionPoints += 10;
    signals.push('Velocidade de fala similar ao padrão de mentira');
  }
  totalChecks++;
  
  // Response latency comparison
  const truthLatencyDiff = Math.abs(current.responseLatency - baseline.vocal.truth.responseLatency);
  const lieLatencyDiff = Math.abs(current.responseLatency - baseline.vocal.lie.responseLatency);
  
  if (lieLatencyDiff < truthLatencyDiff) {
    deceptionPoints += 10;
    signals.push('Hesitação similar ao padrão de mentira');
  }
  totalChecks++;
  
  // === FACIAL ANALYSIS (if available) ===
  
  if (currentVideo && baseline.facial) {
    const currentFacial = extractFacialBaseline(currentVideo);
    
    // Stress score comparison
    const truthStressDiff = Math.abs(currentFacial.facialStressScore - baseline.facial.truth.facialStressScore);
    const lieStressDiff = Math.abs(currentFacial.facialStressScore - baseline.facial.lie.facialStressScore);
    
    if (lieStressDiff < truthStressDiff) {
      deceptionPoints += 20;
      signals.push('Tensão facial similar ao padrão de mentira');
    }
    totalChecks++;
    
    // Blink rate comparison
    const truthBlinkDiff = Math.abs(currentFacial.blinkRate - baseline.facial.truth.blinkRate);
    const lieBlinkDiff = Math.abs(currentFacial.blinkRate - baseline.facial.lie.blinkRate);
    
    if (lieBlinkDiff < truthBlinkDiff) {
      deceptionPoints += 15;
      signals.push('Taxa de piscadas similar ao padrão de mentira');
    }
    totalChecks++;
    
    // Lip tension comparison
    const truthLipDiff = Math.abs(currentFacial.lipTension - baseline.facial.truth.lipTension);
    const lieLipDiff = Math.abs(currentFacial.lipTension - baseline.facial.lie.lipTension);
    
    if (lieLipDiff < truthLipDiff) {
      deceptionPoints += 15;
      signals.push('Tensão labial similar ao padrão de mentira');
    }
    totalChecks++;
  }
  
  // Calculate final score (0-100)
  const maxPoints = baseline.facial ? 100 : 50; // Max depends on available data
  const deceptionScore = Math.min(100, Math.round((deceptionPoints / maxPoints) * 100));
  
  // Determine pattern matching
  const matchesTruthPattern = deceptionScore < 30;
  const matchesLiePattern = deceptionScore > 60;
  
  // Determine confidence
  let confidence: 'low' | 'medium' | 'high' = 'low';
  if (totalChecks >= 5 && (matchesTruthPattern || matchesLiePattern)) {
    confidence = 'high';
  } else if (totalChecks >= 3) {
    confidence = 'medium';
  }
  
  console.log('[BiometricCalibration] Comparação com baseline:', {
    baselineId: baseline.id,
    deceptionScore,
    signals,
    confidence,
  });
  
  return {
    deceptionScore,
    signals,
    matchesTruthPattern,
    matchesLiePattern,
    confidence,
    baselineId: baseline.id,
  };
}

/**
 * Get calibration bonus in BC
 */
export const CALIBRATION_BONUS_BC = 50;

/**
 * Get baseline summary for display
 */
export function getBaselineSummarySync(): { 
  exists: boolean;
  baselineId?: string;
  captureMode?: 'audio' | 'video';
  calibratedAt?: string;
  hoursRemaining?: number;
} {
  const baseline = loadBaselineSync();
  
  if (!baseline) {
    return { exists: false };
  }
  
  const calibratedAt = new Date(baseline.calibratedAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - calibratedAt.getTime()) / (1000 * 60 * 60);
  const hoursRemaining = Math.max(0, BASELINE_EXPIRY_HOURS - hoursDiff);
  
  return {
    exists: true,
    baselineId: baseline.id,
    captureMode: baseline.captureMode,
    calibratedAt: baseline.calibratedAt,
    hoursRemaining: Math.round(hoursRemaining),
  };
}

/**
 * Get baseline summary (async with database check)
 */
export async function getBaselineSummary(): Promise<{ 
  exists: boolean;
  baselineId?: string;
  captureMode?: 'audio' | 'video';
  calibratedAt?: string;
  hoursRemaining?: number;
}> {
  const baseline = await loadBaseline();
  
  if (!baseline) {
    return { exists: false };
  }
  
  const calibratedAt = new Date(baseline.calibratedAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - calibratedAt.getTime()) / (1000 * 60 * 60);
  const hoursRemaining = Math.max(0, BASELINE_EXPIRY_HOURS - hoursDiff);
  
  return {
    exists: true,
    baselineId: baseline.id,
    captureMode: baseline.captureMode,
    calibratedAt: baseline.calibratedAt,
    hoursRemaining: Math.round(hoursRemaining),
  };
}
