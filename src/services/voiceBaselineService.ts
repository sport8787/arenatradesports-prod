// Voice Baseline Service - Tracks player's vocal patterns across rounds
// Compares current metrics against personal baseline to detect stress deviations

export interface VoiceBaseline {
  avgPitch: number;
  avgLatency: number;
  avgSpeechRate: number;
  avgJitter: number;
  sampleCount: number;
}

export interface StressDeviation {
  pitchDeviation: number;      // % deviation from baseline
  latencyDeviation: number;    // % deviation from baseline
  speechRateDeviation: number; // % deviation from baseline
  jitterDeviation: number;     // % deviation from baseline
  overallStressScore: number;  // 0-100 composite score
  stressLevel: 'normal' | 'elevated' | 'high' | 'critical';
}

// Store baselines per player session
const playerBaselines = new Map<string, VoiceBaseline>();

// Minimum samples needed before using baseline (first 3 rounds)
const MIN_BASELINE_SAMPLES = 3;

/**
 * Update player's voice baseline with new metrics
 */
export function updateBaseline(
  playerId: string,
  pitch: number,
  latency: number,
  speechRate: number,
  jitter: number
): void {
  const existing = playerBaselines.get(playerId);
  
  if (!existing) {
    playerBaselines.set(playerId, {
      avgPitch: pitch,
      avgLatency: latency,
      avgSpeechRate: speechRate,
      avgJitter: jitter,
      sampleCount: 1
    });
    console.log('[VoiceBaseline] Created baseline for player:', playerId);
    return;
  }

  // Running average calculation
  const n = existing.sampleCount + 1;
  playerBaselines.set(playerId, {
    avgPitch: ((existing.avgPitch * existing.sampleCount) + pitch) / n,
    avgLatency: ((existing.avgLatency * existing.sampleCount) + latency) / n,
    avgSpeechRate: ((existing.avgSpeechRate * existing.sampleCount) + speechRate) / n,
    avgJitter: ((existing.avgJitter * existing.sampleCount) + jitter) / n,
    sampleCount: n
  });

  console.log('[VoiceBaseline] Updated baseline, samples:', n);
}

/**
 * Calculate stress deviation from player's personal baseline
 */
export function calculateStressDeviation(
  playerId: string,
  currentPitch: number,
  currentLatency: number,
  currentSpeechRate: number,
  currentJitter: number
): StressDeviation | null {
  const baseline = playerBaselines.get(playerId);
  
  // Not enough samples yet
  if (!baseline || baseline.sampleCount < MIN_BASELINE_SAMPLES) {
    console.log('[VoiceBaseline] Not enough samples for stress analysis');
    return null;
  }

  // Calculate percentage deviations (avoid division by zero)
  const pitchDeviation = baseline.avgPitch > 0 
    ? ((currentPitch - baseline.avgPitch) / baseline.avgPitch) * 100 
    : 0;
  
  const latencyDeviation = baseline.avgLatency > 0 
    ? ((currentLatency - baseline.avgLatency) / baseline.avgLatency) * 100 
    : 0;
  
  const speechRateDeviation = baseline.avgSpeechRate > 0 
    ? ((currentSpeechRate - baseline.avgSpeechRate) / baseline.avgSpeechRate) * 100 
    : 0;
  
  const jitterDeviation = baseline.avgJitter > 0 
    ? ((currentJitter - baseline.avgJitter) / baseline.avgJitter) * 100 
    : 0;

  // Weighted stress score calculation
  // Pitch up = stress (+), Latency up = hesitation (+), 
  // Speech rate deviation = anxiety, Jitter up = nervousness (+)
  const weights = {
    pitch: 0.25,      // Pitch increase indicates stress
    latency: 0.30,    // Hesitation strongly indicates bluff
    speechRate: 0.20, // Both too fast and too slow are suspicious
    jitter: 0.25      // Jitter (voice tremor) indicates nervousness
  };

  // For speech rate, both extremes are suspicious (use absolute value)
  const speechRateStress = Math.abs(speechRateDeviation);
  
  // Positive deviations indicate stress for pitch, latency, jitter
  const pitchStress = Math.max(0, pitchDeviation);
  const latencyStress = Math.max(0, latencyDeviation);
  const jitterStress = Math.max(0, jitterDeviation);

  // Composite score (0-100 scale, capped)
  const rawScore = 
    (pitchStress * weights.pitch) +
    (latencyStress * weights.latency) +
    (speechRateStress * weights.speechRate) +
    (jitterStress * weights.jitter);

  // Normalize to 0-100 (50% deviation = 50 score)
  const overallStressScore = Math.min(100, Math.max(0, rawScore));

  // Determine stress level
  const stressLevel: StressDeviation['stressLevel'] = 
    overallStressScore < 15 ? 'normal' :
    overallStressScore < 35 ? 'elevated' :
    overallStressScore < 60 ? 'high' : 'critical';

  const result: StressDeviation = {
    pitchDeviation: Math.round(pitchDeviation * 10) / 10,
    latencyDeviation: Math.round(latencyDeviation * 10) / 10,
    speechRateDeviation: Math.round(speechRateDeviation * 10) / 10,
    jitterDeviation: Math.round(jitterDeviation * 10) / 10,
    overallStressScore: Math.round(overallStressScore),
    stressLevel
  };

  console.log('[VoiceBaseline] Stress deviation calculated:', result);
  return result;
}

/**
 * Get player's current baseline
 */
export function getBaseline(playerId: string): VoiceBaseline | null {
  return playerBaselines.get(playerId) || null;
}

/**
 * Check if baseline is ready for stress analysis
 */
export function hasBaselineReady(playerId: string): boolean {
  const baseline = playerBaselines.get(playerId);
  return baseline !== null && baseline !== undefined && baseline.sampleCount >= MIN_BASELINE_SAMPLES;
}

/**
 * Reset player baseline (e.g., new game session)
 */
export function resetBaseline(playerId: string): void {
  playerBaselines.delete(playerId);
  console.log('[VoiceBaseline] Reset baseline for player:', playerId);
}

/**
 * Clear all baselines
 */
export function clearAllBaselines(): void {
  playerBaselines.clear();
  console.log('[VoiceBaseline] Cleared all baselines');
}
