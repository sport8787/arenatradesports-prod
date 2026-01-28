// Audio Forensics Service - Captures real-time voice metrics for Mycroft analysis
// Enhanced with Jitter analysis and stress detection
// Metrics: Response Latency, Pitch Stability, Speech Rate, Jitter (cycle-to-cycle variation)

import { 
  updateBaseline, 
  calculateStressDeviation, 
  hasBaselineReady,
  type StressDeviation 
} from './voiceBaselineService';

export interface VoiceMetrics {
  responseLatencyMs: number;      // Time between question display and first speech
  pitchStability: 'stable' | 'unstable' | 'micro-tremors';
  speechRateBPM: number;          // Words per minute approximation
  avgPitch: number;               // Average pitch in Hz
  pitchVariance: number;          // Variance in pitch (higher = more unstable)
  peakAmplitude: number;          // Maximum amplitude detected
  recordingDurationMs: number;    // Total recording duration
  // New enhanced metrics
  jitter: number;                 // Cycle-to-cycle pitch variation (%)
  jitterAbsolute: number;         // Absolute jitter in Hz
  shimmer: number;                // Amplitude variation between cycles (%)
  harmonicsToNoise: number;       // Voice clarity ratio (higher = clearer)
  stressDeviation?: StressDeviation; // Deviation from personal baseline
  // FREE speech fluency metrics (no transcription needed)
  silentPeriods: number;          // Number of pauses >1s
  longestPause: number;           // Longest pause in ms
  fillerWordsCount: number;       // Estimated "uhm", "ahh" patterns
  speechContinuity: number;       // 0-100 speech fluidity score
}

export interface ForensicsSession {
  questionDisplayedAt: number;    // Timestamp when question was shown
  recordingStartedAt: number;     // Timestamp when recording started
  pitchSamples: number[];         // Collected pitch samples
  pitchFrameSamples: number[];    // Pitch per frame (includes 0 when unvoiced)
  amplitudeSamples: number[];     // Collected amplitude samples
}

// Global session for current recording
let currentSession: ForensicsSession | null = null;

// Start tracking when question is displayed
export function startForensicsSession(): void {
  currentSession = {
    questionDisplayedAt: Date.now(),
    recordingStartedAt: 0,
    pitchSamples: [],
    pitchFrameSamples: [],
    amplitudeSamples: [],
  };
  console.log('[AudioForensics] Session started - tracking response latency');
}

// Called when recording starts
export function markRecordingStart(): void {
  if (currentSession) {
    currentSession.recordingStartedAt = Date.now();
    console.log('[AudioForensics] Recording started - latency:', 
      currentSession.recordingStartedAt - currentSession.questionDisplayedAt, 'ms');
  }
}

// Frame counter for periodic logging
let frameCounter = 0;

// Analyze audio frame and collect metrics (called during recording)
export function analyzeAudioFrame(analyserNode: AnalyserNode): void {
  if (!currentSession || !analyserNode) return;

  const frequencyData = new Float32Array(analyserNode.frequencyBinCount);
  analyserNode.getFloatFrequencyData(frequencyData);

  const timeData = new Uint8Array(analyserNode.fftSize);
  analyserNode.getByteTimeDomainData(timeData);

  // Calculate RMS amplitude FIRST (most reliable silence indicator)
  const amplitude = calculateRMS(timeData);
  currentSession.amplitudeSamples.push(amplitude);
  
  // CRITICAL FIX: Use amplitude threshold to determine if voice is present
  // RMS values typically: silence ~0.001-0.01, soft speech ~0.02-0.08, normal ~0.1-0.3
  const isVoicePresent = amplitude > 0.015; // Lower threshold for sensitivity
  
  // Only estimate pitch if voice is present (amplitude above noise floor)
  let pitch = 0;
  if (isVoicePresent) {
    pitch = estimatePitch(frequencyData, analyserNode.context.sampleRate);
  }
  
  // Store per-frame pitch, 0 = silence/unvoiced
  currentSession.pitchFrameSamples.push(pitch);
  if (pitch > 0) {
    currentSession.pitchSamples.push(pitch);
  }
  
  // DEBUG: Log every 30 frames (~0.5s) to verify capture is working
  frameCounter++;
  if (frameCounter % 30 === 0) {
    console.log('[AudioForensics] 🎤 CAPTURE:', {
      frame: frameCounter,
      amplitude: amplitude.toFixed(4),
      isVoice: isVoicePresent ? '🗣️' : '🔇',
      pitch: pitch > 0 ? pitch.toFixed(0) + 'Hz' : 'silent',
      totalSamples: currentSession.amplitudeSamples.length,
      silentFrames: currentSession.pitchFrameSamples.filter(p => p === 0).length,
    });
  }
}

// Estimate pitch using simple peak detection in frequency domain
function estimatePitch(frequencyData: Float32Array, sampleRate: number): number {
  let maxIndex = 0;
  let maxValue = -Infinity;

  // Focus on human voice range (80-500 Hz)
  const minBin = Math.floor((80 * frequencyData.length * 2) / sampleRate);
  const maxBin = Math.floor((500 * frequencyData.length * 2) / sampleRate);

  for (let i = minBin; i < Math.min(maxBin, frequencyData.length); i++) {
    if (frequencyData[i] > maxValue) {
      maxValue = frequencyData[i];
      maxIndex = i;
    }
  }

  // Convert bin to frequency
  const frequency = (maxIndex * sampleRate) / (frequencyData.length * 2);
  
  // CRITICAL FIX: Stricter threshold (-40 dB instead of -60 dB)
  // -40 dB means the signal must be ~10x stronger to be considered "voice"
  // -100 dB = silence, -40 dB = moderate voice, 0 dB = loud
  return maxValue > -40 ? frequency : 0;
}

// Calculate RMS amplitude
function calculateRMS(timeData: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const normalized = (timeData[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / timeData.length);
}

// Calculate Jitter (cycle-to-cycle pitch variation) - key stress indicator
function calculateJitter(pitchSamples: number[]): { jitter: number; jitterAbsolute: number } {
  if (pitchSamples.length < 3) {
    return { jitter: 0, jitterAbsolute: 0 };
  }

  // Calculate absolute differences between consecutive pitch values
  let totalDiff = 0;
  let validDiffs = 0;

  for (let i = 1; i < pitchSamples.length; i++) {
    const diff = Math.abs(pitchSamples[i] - pitchSamples[i - 1]);
    // Filter out extreme jumps (noise)
    if (diff < 50) {
      totalDiff += diff;
      validDiffs++;
    }
  }

  const avgPitch = pitchSamples.reduce((a, b) => a + b, 0) / pitchSamples.length;
  const jitterAbsolute = validDiffs > 0 ? totalDiff / validDiffs : 0;
  
  // Jitter as percentage of average pitch (standard measure)
  const jitter = avgPitch > 0 ? (jitterAbsolute / avgPitch) * 100 : 0;

  return { 
    jitter: Math.round(jitter * 100) / 100, 
    jitterAbsolute: Math.round(jitterAbsolute * 10) / 10 
  };
}

// Calculate Shimmer (amplitude variation between cycles) - voice stability indicator
function calculateShimmer(amplitudeSamples: number[]): number {
  if (amplitudeSamples.length < 3) return 0;

  let totalDiff = 0;
  for (let i = 1; i < amplitudeSamples.length; i++) {
    totalDiff += Math.abs(amplitudeSamples[i] - amplitudeSamples[i - 1]);
  }

  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const avgDiff = totalDiff / (amplitudeSamples.length - 1);
  
  // Shimmer as percentage
  const shimmer = avgAmplitude > 0 ? (avgDiff / avgAmplitude) * 100 : 0;
  return Math.round(shimmer * 100) / 100;
}

// Calculate Harmonics-to-Noise Ratio approximation (voice clarity)
function calculateHNR(amplitudeSamples: number[], pitchSamples: number[]): number {
  if (amplitudeSamples.length < 10 || pitchSamples.length < 10) return 0;

  // Simplified HNR: ratio of voiced segments to noise
  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const voicedSamples = amplitudeSamples.filter(a => a > avgAmplitude * 0.5).length;
  const ratio = voicedSamples / amplitudeSamples.length;
  
  // Convert to dB-like scale (0-30 range, higher = clearer voice)
  return Math.round(ratio * 30);
}

// Calculate silent periods using pitch dropouts (robust to AGC/noise suppression)
// We consider a pause when pitch stays at 0 (unvoiced) for >= 1s.
function calculateSilentPeriods(
  amplitudeSamples: number[],
  pitchFrameSamples: number[],
  durationMs: number
): { silentPeriods: number; longestPause: number } {
  if (amplitudeSamples.length < 10) {
    console.warn('[AudioForensics] ⚠️ Too few samples for pause detection:', amplitudeSamples.length);
    return { silentPeriods: 0, longestPause: 0 };
  }

  const frames = Math.min(amplitudeSamples.length, pitchFrameSamples.length);
  const samplesPerSecond = frames / (durationMs / 1000);
  // Long pause threshold (>= 1s)
  const minSilenceSamples = Math.max(2, Math.floor(samplesPerSecond * 1.0));
  
  // Calculate average amplitude for relative comparison
  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const maxAmplitude = Math.max(...amplitudeSamples);
  
  // CRITICAL FIX: Use MAXIMUM threshold to catch MORE silences
  // Relative threshold: 25% of average (catches relative drops)
  // Absolute threshold: 0.02 (catches true silence)
  const relativeThreshold = avgAmplitude * 0.25;
  const absoluteThreshold = 0.02;
  // Use MAXIMUM - this makes detection MORE sensitive to pauses
  const dynamicThreshold = Math.max(relativeThreshold, absoluteThreshold);
  
  console.log('[AudioForensics] 📊 V2 Pause detection params:', {
    samples: amplitudeSamples.length,
    avgAmplitude: avgAmplitude.toFixed(4),
    maxAmplitude: maxAmplitude.toFixed(4),
    relativeThreshold: relativeThreshold.toFixed(4),
    absoluteThreshold: absoluteThreshold.toFixed(4),
    finalThreshold: dynamicThreshold.toFixed(4),
    minSilenceSamples,
    durationSec: (durationMs / 1000).toFixed(1),
  });
  
  let silentPeriods = 0;
  let currentSilenceLength = 0;
  let longestPause = 0;
  let allPauses: number[] = [];

  for (let i = 0; i < frames; i++) {
    const pitch = pitchFrameSamples[i] || 0;
    const isSilent = pitch <= 0;

    if (isSilent) {
      currentSilenceLength++;
    } else {
      if (currentSilenceLength >= minSilenceSamples) {
        silentPeriods++;
        const pauseDurationMs = (currentSilenceLength / samplesPerSecond) * 1000;
        allPauses.push(pauseDurationMs);
        if (pauseDurationMs > longestPause) longestPause = pauseDurationMs;
      }
      currentSilenceLength = 0;
    }
  }
  
  // Check final silence period
  if (currentSilenceLength >= minSilenceSamples) {
    silentPeriods++;
    const pauseDurationMs = (currentSilenceLength / samplesPerSecond) * 1000;
    allPauses.push(pauseDurationMs);
    if (pauseDurationMs > longestPause) {
      longestPause = pauseDurationMs;
    }
  }
  
  console.log('[AudioForensics] 🔬 V2 DETECTED PAUSES:', { 
    silentPeriods, 
    longestPause: Math.round(longestPause),
    allPauses: allPauses.map(p => Math.round(p)),
    impact: silentPeriods > 2 ? '⚠️ HIGH HESITATION' : silentPeriods > 0 ? '🟡 SOME HESITATION' : '✅ FLUENT'
  });
  
  return { silentPeriods, longestPause: Math.round(longestPause) };
}

// Estimate filler words ("uhm", "ahh") based on amplitude patterns
// V2: Count ALL low-energy segments that could indicate hesitation
function estimateFillerWords(amplitudeSamples: number[], pitchFrameSamples: number[], durationMs: number): number {
  if (amplitudeSamples.length < 20 || durationMs < 1000) {
    console.warn('[AudioForensics] ⚠️ Too few samples for filler detection');
    return 0;
  }

  const frames = Math.min(amplitudeSamples.length, pitchFrameSamples.length);
  const samplesPerSecond = frames / (durationMs / 1000);
  // Filler duration: 80-800ms (short unvoiced runs between voiced bursts)
  const minFillerSamples = Math.max(1, Math.floor(samplesPerSecond * 0.08));
  const maxFillerSamples = Math.floor(samplesPerSecond * 0.8);
  
  // Calculate thresholds
  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const maxAmplitude = Math.max(...amplitudeSamples);
  
  // Low energy = below 35% of average, but above noise floor (0.005)
  const lowEnergyThreshold = Math.max(0.005, avgAmplitude * 0.35);
  // Mid energy = below 60% of average
  const midEnergyThreshold = avgAmplitude * 0.6;
  
  let fillerCount = 0;
  let currentUnvoicedRun = 0;
  let wasVoiced = false;

  for (let i = 0; i < frames; i++) {
    const pitch = pitchFrameSamples[i] || 0;
    const amplitude = amplitudeSamples[i] || 0;
    const voiced = pitch > 0 && amplitude > lowEnergyThreshold;

    if (voiced) {
      // closing an unvoiced run => possible filler
      if (wasVoiced && currentUnvoicedRun >= minFillerSamples && currentUnvoicedRun <= maxFillerSamples) {
        fillerCount++;
      }
      currentUnvoicedRun = 0;
      wasVoiced = true;
      continue;
    }

    // unvoiced
    if (wasVoiced) currentUnvoicedRun++;
  }
  
  console.log('[AudioForensics] 🔬 V2 DETECTED FILLERS:', { 
    fillerCount, 
    avgAmplitude: avgAmplitude.toFixed(4),
    maxAmplitude: maxAmplitude.toFixed(4),
    thresholds: { 
      lowEnergy: lowEnergyThreshold.toFixed(4), 
      midEnergy: midEnergyThreshold.toFixed(4) 
    },
    impact: fillerCount > 3 ? '⚠️ HIGH HESITATION' : fillerCount > 1 ? '🟡 SOME HESITATION' : '✅ FLUENT'
  });
  
  return fillerCount;
}

// Calculate speech continuity score (0-100, higher = more fluid speech)
// CRITICAL FIX: Much more aggressive penalties for hesitation signals
function calculateSpeechContinuity(amplitudeSamples: number[], silentPeriods: number, fillerWordsCount: number, durationMs: number): number {
  if (amplitudeSamples.length < 10 || durationMs < 1000) return 100;
  
  // Base score starts at 100
  let score = 100;
  
  // AGGRESSIVE penalties for hesitation signals
  // Penalty for silent periods (each pause reduces score HEAVILY)
  score -= silentPeriods * 25; // Was 18 - now MUCH heavier
  
  // Penalty for filler words (each estimated filler reduces score)
  score -= fillerWordsCount * 15; // Was 12
  
  // Calculate amplitude variation for choppy speech detection
  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const variance = amplitudeSamples.reduce((sum, a) => sum + Math.pow(a - avgAmplitude, 2), 0) / amplitudeSamples.length;
  const coefficientOfVariation = Math.sqrt(variance) / (avgAmplitude || 1);
  
  // High variation in amplitude suggests choppy/nervous speech
  if (coefficientOfVariation > 1.5) {
    score -= 35; // INCREASED - very choppy
  } else if (coefficientOfVariation > 1.0) {
    score -= 25; // INCREASED
  } else if (coefficientOfVariation > 0.7) {
    score -= 15; // New lower tier
  }
  
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  
  console.log('[AudioForensics] 🔬 SPEECH CONTINUITY:', {
    score: finalScore,
    silentPeriods,
    fillerWordsCount,
    coefficientOfVariation: coefficientOfVariation.toFixed(2),
    penalties: {
      fromPauses: silentPeriods * 25,
      fromFillers: fillerWordsCount * 15,
      fromVariation: coefficientOfVariation > 1.5 ? 35 : coefficientOfVariation > 1.0 ? 25 : coefficientOfVariation > 0.7 ? 15 : 0,
    },
    'impact': finalScore < 50 ? '⚠️ LOW FLUENCY' : finalScore < 70 ? '🟡 MODERATE' : '✅ FLUENT'
  });
  
  // Clamp to 0-100
  return finalScore;
}

// Finalize session and get metrics
export function finalizeForensicsSession(recordingDurationMs: number, playerId?: string): VoiceMetrics {
  // Reset frame counter for next session
  frameCounter = 0;
  
  if (!currentSession) {
    console.warn('[AudioForensics] ❌ No active session - returning defaults');
    return getDefaultMetrics();
  }

  const { questionDisplayedAt, recordingStartedAt, pitchSamples, pitchFrameSamples, amplitudeSamples } = currentSession;

  // CRITICAL: Log sample count - if too low, detection won't work
  console.log('[AudioForensics] 📈 SESSION SUMMARY:', {
    amplitudeSamples: amplitudeSamples.length,
    pitchSamples: pitchSamples.length,
    durationMs: recordingDurationMs,
    samplesPerSecond: (amplitudeSamples.length / (recordingDurationMs / 1000)).toFixed(1),
  });
  
  // Warn if not enough samples
  if (amplitudeSamples.length < 50) {
    console.error('[AudioForensics] ⚠️ CRITICAL: Too few samples collected! Audio capture may not be working.');
    console.error('[AudioForensics] Expected ~' + Math.round((recordingDurationMs / 1000) * 60) + ' samples for ' + (recordingDurationMs / 1000).toFixed(1) + 's recording');
  }

  // Calculate response latency
  const responseLatencyMs = recordingStartedAt > 0 
    ? recordingStartedAt - questionDisplayedAt 
    : 0;

  // Calculate pitch statistics
  const avgPitch = pitchSamples.length > 0
    ? pitchSamples.reduce((a, b) => a + b, 0) / pitchSamples.length
    : 0;

  const pitchVariance = pitchSamples.length > 1
    ? pitchSamples.reduce((sum, p) => sum + Math.pow(p - avgPitch, 2), 0) / pitchSamples.length
    : 0;

  // Determine pitch stability based on variance
  const pitchStability: 'stable' | 'unstable' | 'micro-tremors' = 
    pitchVariance < 100 ? 'stable' :
    pitchVariance < 500 ? 'micro-tremors' : 'unstable';

  // Calculate peak amplitude
  const peakAmplitude = amplitudeSamples.length > 0
    ? Math.max(...amplitudeSamples)
    : 0;

  // Estimate speech rate (rough approximation based on amplitude peaks)
  const speechRateBPM = estimateSpeechRate(amplitudeSamples, recordingDurationMs);

  // NEW: Calculate enhanced metrics
  const { jitter, jitterAbsolute } = calculateJitter(pitchSamples);
  const shimmer = calculateShimmer(amplitudeSamples);
  const harmonicsToNoise = calculateHNR(amplitudeSamples, pitchSamples);

  // NEW: Calculate FREE speech fluency metrics
  const { silentPeriods, longestPause } = calculateSilentPeriods(amplitudeSamples, pitchFrameSamples, recordingDurationMs);
  const fillerWordsCount = estimateFillerWords(amplitudeSamples, pitchFrameSamples, recordingDurationMs);
  const speechContinuity = calculateSpeechContinuity(amplitudeSamples, silentPeriods, fillerWordsCount, recordingDurationMs);

  // Update player baseline if playerId provided
  if (playerId) {
    updateBaseline(playerId, avgPitch, responseLatencyMs, speechRateBPM, jitter);
  }

  // Calculate stress deviation from baseline
  const stressDeviation = playerId 
    ? calculateStressDeviation(playerId, avgPitch, responseLatencyMs, speechRateBPM, jitter)
    : undefined;

  const metrics: VoiceMetrics = {
    responseLatencyMs,
    pitchStability,
    speechRateBPM,
    avgPitch: Math.round(avgPitch),
    pitchVariance: Math.round(pitchVariance),
    peakAmplitude: Math.round(peakAmplitude * 100) / 100,
    recordingDurationMs,
    // Enhanced metrics
    jitter,
    jitterAbsolute,
    shimmer,
    harmonicsToNoise,
    stressDeviation: stressDeviation || undefined,
    // FREE speech fluency metrics
    silentPeriods,
    longestPause,
    fillerWordsCount,
    speechContinuity,
  };

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[AudioForensics] 🎯 FINAL METRICS:');
  console.log('  📊 Fluency Score:', speechContinuity + '%', speechContinuity >= 70 ? '✅ FLUENT' : speechContinuity >= 40 ? '🟡 HESITANT' : '⚠️ FRAGMENTED');
  console.log('  🔇 Silent Periods:', silentPeriods);
  console.log('  ⏱️ Longest Pause:', (longestPause / 1000).toFixed(1) + 's');
  console.log('  💬 Filler Words:', fillerWordsCount);
  console.log('  🎵 Jitter:', jitter.toFixed(2) + '%');
  console.log('  📈 Pitch Stability:', pitchStability);
  console.log('═══════════════════════════════════════════════════════════════');
  
  // Clear session
  currentSession = null;

  return metrics;
}

// Estimate speech rate based on amplitude peaks (syllables)
function estimateSpeechRate(amplitudeSamples: number[], durationMs: number): number {
  if (amplitudeSamples.length < 10 || durationMs < 1000) return 0;

  const threshold = 0.15; // Amplitude threshold for syllable detection
  let syllableCount = 0;
  let wasAboveThreshold = false;

  for (const amplitude of amplitudeSamples) {
    if (amplitude > threshold && !wasAboveThreshold) {
      syllableCount++;
      wasAboveThreshold = true;
    } else if (amplitude < threshold * 0.5) {
      wasAboveThreshold = false;
    }
  }

  // Convert syllables to approximate words (avg 2 syllables per word)
  const wordCount = syllableCount / 2;
  // Convert to words per minute
  const minutesFraction = durationMs / 60000;
  
  return minutesFraction > 0 ? Math.round(wordCount / minutesFraction) : 0;
}

// Get default metrics if session fails
function getDefaultMetrics(): VoiceMetrics {
  return {
    responseLatencyMs: 0,
    pitchStability: 'stable',
    speechRateBPM: 0,
    avgPitch: 0,
    pitchVariance: 0,
    peakAmplitude: 0,
    recordingDurationMs: 0,
    jitter: 0,
    jitterAbsolute: 0,
    shimmer: 0,
    harmonicsToNoise: 0,
    silentPeriods: 0,
    longestPause: 0,
    fillerWordsCount: 0,
    speechContinuity: 100,
  };
}

// Generate forensic analysis prompt for Mycroft AI (enhanced with jitter/stress)
export function generateForensicPrompt(metrics: VoiceMetrics): string {
  const latencyAnalysis = 
    metrics.responseLatencyMs < 500 ? 'Resposta rápida (< 500ms)' :
    metrics.responseLatencyMs < 2000 ? 'Latência moderada' :
    'Hesitação prolongada';

  const speechAnalysis = 
    metrics.speechRateBPM > 200 ? 'Fala acelerada' :
    metrics.speechRateBPM > 120 ? 'Ritmo normal' :
    'Fala lenta/pausada';

  // Enhanced jitter analysis
  const jitterAnalysis = 
    metrics.jitter < 0.5 ? 'Voz estável (sem tremor)' :
    metrics.jitter < 1.5 ? 'Micro-tremores detectados' :
    metrics.jitter < 3.0 ? 'Tremor vocal significativo' :
    'Instabilidade vocal crítica';

  // Shimmer analysis (amplitude variation)
  const shimmerAnalysis = 
    metrics.shimmer < 3 ? 'Intensidade vocal consistente' :
    metrics.shimmer < 8 ? 'Variações leves de intensidade' :
    'Flutuações de volume notáveis';

  // Voice clarity (HNR)
  const clarityAnalysis = 
    metrics.harmonicsToNoise > 20 ? 'Voz clara e confiante' :
    metrics.harmonicsToNoise > 12 ? 'Clareza normal' :
    'Voz abafada/insegura';

  // Speech fluency analysis (FREE metrics)
  const fluencyAnalysis = 
    metrics.speechContinuity >= 80 ? 'Fala fluida e confiante' :
    metrics.speechContinuity >= 60 ? 'Fala razoavelmente fluida' :
    metrics.speechContinuity >= 40 ? 'Fala com hesitações perceptíveis' :
    'Fala fragmentada (possível nervosismo)';

  const pauseAnalysis = 
    metrics.silentPeriods === 0 ? 'Sem pausas significativas' :
    metrics.silentPeriods <= 2 ? 'Pausas ocasionais' :
    'Múltiplas pausas detectadas';

  let basePrompt = `DADOS FORENSES CAPTURADOS (ANÁLISE PSICOACÚSTICA):
📊 MÉTRICAS BÁSICAS:
- Latência: ${metrics.responseLatencyMs}ms (${latencyAnalysis})
- Pitch médio: ${metrics.avgPitch}Hz | Estabilidade: ${metrics.pitchStability}
- Velocidade: ${metrics.speechRateBPM} palavras/min (${speechAnalysis})

🔬 ANÁLISE DE MICRO-VARIAÇÕES (INVISÍVEIS AO OUVIDO HUMANO):
- JITTER: ${metrics.jitter}% (${jitterAnalysis}) - variação ciclo-a-ciclo de ${metrics.jitterAbsolute}Hz
- SHIMMER: ${metrics.shimmer}% (${shimmerAnalysis})
- Clareza vocal (HNR): ${metrics.harmonicsToNoise}dB (${clarityAnalysis})

🎤 FLUÊNCIA DA FALA (ANÁLISE GRATUITA):
- Pausas longas (>1s): ${metrics.silentPeriods} (${pauseAnalysis})
- Maior pausa: ${(metrics.longestPause / 1000).toFixed(1)}s
- Hesitações ("uhm/ahh"): ${metrics.fillerWordsCount} detectadas
- Score de fluência: ${metrics.speechContinuity}/100 (${fluencyAnalysis})`;

  // Add stress deviation if available (baseline comparison)
  if (metrics.stressDeviation) {
    const sd = metrics.stressDeviation;
    basePrompt += `

⚠️ DESVIO DO PADRÃO PESSOAL (vs baseline do jogador):
- Pitch: ${sd.pitchDeviation > 0 ? '+' : ''}${sd.pitchDeviation}% ${sd.pitchDeviation > 10 ? '↑ ELEVADO' : ''}
- Latência: ${sd.latencyDeviation > 0 ? '+' : ''}${sd.latencyDeviation}% ${sd.latencyDeviation > 20 ? '↑ HESITAÇÃO' : ''}
- Velocidade: ${sd.speechRateDeviation > 0 ? '+' : ''}${sd.speechRateDeviation}%
- Jitter: ${sd.jitterDeviation > 0 ? '+' : ''}${sd.jitterDeviation}% ${sd.jitterDeviation > 30 ? '↑ NERVOSISMO' : ''}
- 🎯 SCORE DE ESTRESSE: ${sd.overallStressScore}/100 (${sd.stressLevel.toUpperCase()})`;
  }

  return basePrompt;
}

// Check if session is active
export function hasActiveSession(): boolean {
  return currentSession !== null;
}

// Export stress deviation type for external use
export type { StressDeviation } from './voiceBaselineService';

