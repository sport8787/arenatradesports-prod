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
}

export interface ForensicsSession {
  questionDisplayedAt: number;    // Timestamp when question was shown
  recordingStartedAt: number;     // Timestamp when recording started
  pitchSamples: number[];         // Collected pitch samples
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

// Analyze audio frame and collect metrics (called during recording)
export function analyzeAudioFrame(analyserNode: AnalyserNode): void {
  if (!currentSession || !analyserNode) return;

  const frequencyData = new Float32Array(analyserNode.frequencyBinCount);
  analyserNode.getFloatFrequencyData(frequencyData);

  const timeData = new Uint8Array(analyserNode.fftSize);
  analyserNode.getByteTimeDomainData(timeData);

  // Estimate fundamental pitch from frequency data
  const pitch = estimatePitch(frequencyData, analyserNode.context.sampleRate);
  if (pitch > 0) {
    currentSession.pitchSamples.push(pitch);
  }

  // Calculate RMS amplitude
  const amplitude = calculateRMS(timeData);
  currentSession.amplitudeSamples.push(amplitude);
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
  
  // Filter out noise (only return if signal is strong enough)
  return maxValue > -60 ? frequency : 0;
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

// Finalize session and get metrics
export function finalizeForensicsSession(recordingDurationMs: number, playerId?: string): VoiceMetrics {
  if (!currentSession) {
    console.warn('[AudioForensics] No active session');
    return getDefaultMetrics();
  }

  const { questionDisplayedAt, recordingStartedAt, pitchSamples, amplitudeSamples } = currentSession;

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
  };

  console.log('[AudioForensics] Final metrics with jitter:', metrics);
  
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

  let basePrompt = `DADOS FORENSES CAPTURADOS (ANÁLISE PSICOACÚSTICA):
📊 MÉTRICAS BÁSICAS:
- Latência: ${metrics.responseLatencyMs}ms (${latencyAnalysis})
- Pitch médio: ${metrics.avgPitch}Hz | Estabilidade: ${metrics.pitchStability}
- Velocidade: ${metrics.speechRateBPM} palavras/min (${speechAnalysis})

🔬 ANÁLISE DE MICRO-VARIAÇÕES (INVISÍVEIS AO OUVIDO HUMANO):
- JITTER: ${metrics.jitter}% (${jitterAnalysis}) - variação ciclo-a-ciclo de ${metrics.jitterAbsolute}Hz
- SHIMMER: ${metrics.shimmer}% (${shimmerAnalysis})
- Clareza vocal (HNR): ${metrics.harmonicsToNoise}dB (${clarityAnalysis})`;

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

