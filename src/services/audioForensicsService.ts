// Audio Forensics Service - Captures real-time voice metrics for Mycroft analysis
// Metrics: Response Latency, Pitch Stability, Speech Rate (BPM)
// These metrics are sent to the AI to generate data-driven forensic analysis

export interface VoiceMetrics {
  responseLatencyMs: number;      // Time between question display and first speech
  pitchStability: 'stable' | 'unstable' | 'micro-tremors';
  speechRateBPM: number;          // Words per minute approximation
  avgPitch: number;               // Average pitch in Hz
  pitchVariance: number;          // Variance in pitch (higher = more unstable)
  peakAmplitude: number;          // Maximum amplitude detected
  recordingDurationMs: number;    // Total recording duration
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

// Finalize session and get metrics
export function finalizeForensicsSession(recordingDurationMs: number): VoiceMetrics {
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

  const metrics: VoiceMetrics = {
    responseLatencyMs,
    pitchStability,
    speechRateBPM,
    avgPitch: Math.round(avgPitch),
    pitchVariance: Math.round(pitchVariance),
    peakAmplitude: Math.round(peakAmplitude * 100) / 100,
    recordingDurationMs,
  };

  console.log('[AudioForensics] Final metrics:', metrics);
  
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
  };
}

// Generate forensic analysis prompt for Mycroft AI
export function generateForensicPrompt(metrics: VoiceMetrics): string {
  const latencyAnalysis = 
    metrics.responseLatencyMs < 500 ? 'Resposta rápida (< 500ms)' :
    metrics.responseLatencyMs < 2000 ? 'Latência moderada' :
    'Hesitação prolongada';

  const speechAnalysis = 
    metrics.speechRateBPM > 200 ? 'Fala acelerada' :
    metrics.speechRateBPM > 120 ? 'Ritmo normal' :
    'Fala lenta/pausada';

  return `DADOS FORENSES CAPTURADOS:
- Latência: ${metrics.responseLatencyMs}ms (${latencyAnalysis})
- Pitch: ${metrics.pitchStability} (média ${metrics.avgPitch}Hz, variância ${metrics.pitchVariance})
- Velocidade: ${metrics.speechRateBPM} palavras/min (${speechAnalysis})
- Amplitude máx: ${metrics.peakAmplitude}
- Duração: ${Math.round(metrics.recordingDurationMs / 1000)}s`;
}

// Check if session is active
export function hasActiveSession(): boolean {
  return currentSession !== null;
}
