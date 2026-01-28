/**
 * Biometric Calibration Service
 * Captures truth and lie baselines from player before game starts
 * Similar to polygraph calibration for more accurate analysis
 */

import type { VoiceMetrics } from '@/services/audioForensicsService';
import type { VideoForensicsResult } from '@/services/videoForensicsService';

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

// Storage key for baseline
const BASELINE_STORAGE_KEY = 'blefador_biometric_baseline';
const BASELINE_EXPIRY_HOURS = 24; // Baseline válido por 24h

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
 * Save baseline to localStorage
 */
function saveBaseline(baseline: BiometricBaseline): void {
  try {
    localStorage.setItem(BASELINE_STORAGE_KEY, JSON.stringify(baseline));
  } catch (e) {
    console.error('[BiometricCalibration] Failed to save baseline:', e);
  }
}

/**
 * Load baseline from localStorage
 */
export function loadBaseline(): BiometricBaseline | null {
  try {
    const stored = localStorage.getItem(BASELINE_STORAGE_KEY);
    if (!stored) return null;
    
    const baseline: BiometricBaseline = JSON.parse(stored);
    
    // Check if baseline is expired
    const calibratedAt = new Date(baseline.calibratedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - calibratedAt.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > BASELINE_EXPIRY_HOURS) {
      console.log('[BiometricCalibration] Baseline expirado, removendo...');
      clearBaseline();
      return null;
    }
    
    return baseline;
  } catch (e) {
    console.error('[BiometricCalibration] Failed to load baseline:', e);
    return null;
  }
}

/**
 * Clear saved baseline
 */
export function clearBaseline(): void {
  localStorage.removeItem(BASELINE_STORAGE_KEY);
}

/**
 * Check if valid baseline exists
 */
export function hasValidBaseline(): boolean {
  return loadBaseline() !== null;
}

/**
 * Compare current metrics against baseline to detect deception probability
 * Returns a score from 0-100 where higher = more likely deception
 */
export function compareToBaseline(
  currentVoice: VoiceMetrics,
  currentVideo?: VideoForensicsResult
): { 
  deceptionScore: number; 
  signals: string[];
  matchesTruthPattern: boolean;
  matchesLiePattern: boolean;
  confidence: 'low' | 'medium' | 'high';
} {
  const baseline = loadBaseline();
  
  if (!baseline) {
    return {
      deceptionScore: 50, // Neutral without baseline
      signals: ['Sem baseline de calibração'],
      matchesTruthPattern: false,
      matchesLiePattern: false,
      confidence: 'low',
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
  };
}

/**
 * Get calibration bonus in BC
 */
export const CALIBRATION_BONUS_BC = 50;

/**
 * Get baseline summary for display
 */
export function getBaselineSummary(): { 
  exists: boolean;
  captureMode?: 'audio' | 'video';
  calibratedAt?: string;
  hoursRemaining?: number;
} {
  const baseline = loadBaseline();
  
  if (!baseline) {
    return { exists: false };
  }
  
  const calibratedAt = new Date(baseline.calibratedAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - calibratedAt.getTime()) / (1000 * 60 * 60);
  const hoursRemaining = Math.max(0, BASELINE_EXPIRY_HOURS - hoursDiff);
  
  return {
    exists: true,
    captureMode: baseline.captureMode,
    calibratedAt: baseline.calibratedAt,
    hoursRemaining: Math.round(hoursRemaining),
  };
}
