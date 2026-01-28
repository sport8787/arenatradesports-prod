// Audio Forensics Service - VERSÃO 2.0 SIMPLIFICADA E ROBUSTA
// USA: AnalyserNode + setInterval (MUITO mais confiável que ScriptProcessor)
// Captura contínua de samples para análise comportamental

import { 
  updateBaseline, 
  calculateStressDeviation, 
  hasBaselineReady,
  type StressDeviation 
} from './voiceBaselineService';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface VoiceMetrics {
  responseLatencyMs: number;      // Time between question display and first speech
  pitchStability: 'stable' | 'unstable' | 'micro-tremors';
  speechRateBPM: number;          // Words per minute approximation
  avgPitch: number;               // Average pitch in Hz
  pitchVariance: number;          // Variance in pitch (higher = more unstable)
  peakAmplitude: number;          // Maximum amplitude detected
  recordingDurationMs: number;    // Total recording duration
  // Enhanced metrics
  jitter: number;                 // Cycle-to-cycle pitch variation (%)
  jitterAbsolute: number;         // Absolute jitter in Hz
  shimmer: number;                // Amplitude variation between cycles (%)
  harmonicsToNoise: number;       // Voice clarity ratio (higher = clearer)
  stressDeviation?: StressDeviation; // Deviation from personal baseline
  // Speech fluency metrics
  silentPeriods: number;          // Number of pauses >200ms
  longestPause: number;           // Longest pause in ms
  fillerWordsCount: number;       // Estimated "uhm", "ahh" patterns
  speechContinuity: number;       // 0-100 speech fluidity score
}

export interface ForensicsSession {
  questionDisplayedAt: number;
  recordingStartedAt: number;
  pitchSamples: number[];
  pitchFrameSamples: number[];
  amplitudeSamples: number[];
}

// ═══════════════════════════════════════════════════════════
// V2: INTERVAL-BASED SESSION (NEW ROBUST APPROACH)
// ═══════════════════════════════════════════════════════════

interface ActiveForensicsSession {
  questionDisplayedAt: number;
  recordingStartedAt: number;
  samples: number[];
  sampleRate: number;
  captureInterval: number | null;
  captureCount: number;
  isActive: boolean;
  analyser: AnalyserNode | null;
  source: MediaStreamAudioSourceNode | null;
}

let activeSession: ActiveForensicsSession | null = null;

// Legacy session for backward compatibility
let currentSession: ForensicsSession | null = null;

// ═══════════════════════════════════════════════════════════
// START SESSION (Legacy - still called by components)
// ═══════════════════════════════════════════════════════════

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

export function markRecordingStart(): void {
  if (currentSession) {
    currentSession.recordingStartedAt = Date.now();
    console.log('[AudioForensics] Recording started - latency:', 
      currentSession.recordingStartedAt - currentSession.questionDisplayedAt, 'ms');
  }
  if (activeSession) {
    activeSession.recordingStartedAt = Date.now();
  }
}

// ═══════════════════════════════════════════════════════════
// V2: START INTERVAL-BASED CAPTURE (ROBUST)
// ═══════════════════════════════════════════════════════════

export function startIntervalCapture(
  audioContext: AudioContext,
  stream: MediaStream
): void {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('🎙️ [AudioForensics] STARTING INTERVAL CAPTURE (V2)');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Validate audio tracks
  const audioTracks = stream.getAudioTracks();
  console.log('🎤 Audio tracks:', audioTracks.length);
  
  if (audioTracks.length === 0) {
    console.error('❌ No audio tracks in MediaStream');
    return;
  }
  
  audioTracks.forEach((track, i) => {
    console.log(`  Track ${i}:`, {
      enabled: track.enabled,
      muted: track.muted,
      readyState: track.readyState,
      label: track.label,
    });
  });
  
  console.log('📊 AudioContext state:', audioContext.state);
  console.log('📊 Sample rate:', audioContext.sampleRate, 'Hz');
  
  // Resume if suspended
  if (audioContext.state === 'suspended') {
    console.log('⚠️ Resuming suspended AudioContext...');
    audioContext.resume();
  }
  
  // Create source from stream
  console.log('🔧 Creating MediaStreamSource...');
  const source = audioContext.createMediaStreamSource(stream);
  
  // Create analyser
  console.log('🔧 Creating AnalyserNode...');
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.5;
  
  // Connect pipeline
  console.log('🔌 Connecting: source → analyser');
  source.connect(analyser);
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  console.log('📊 Analyser config:', {
    fftSize: analyser.fftSize,
    bufferLength,
  });
  
  // Create session
  activeSession = {
    questionDisplayedAt: currentSession?.questionDisplayedAt || Date.now(),
    recordingStartedAt: currentSession?.recordingStartedAt || Date.now(),
    samples: [],
    sampleRate: audioContext.sampleRate,
    captureInterval: null,
    captureCount: 0,
    isActive: true,
    analyser,
    source,
  };
  
  // Start interval-based capture (20ms = 50 times per second)
  const SAMPLE_RATE_MS = 20;
  
  console.log('✅ Starting capture with setInterval...');
  
  activeSession.captureInterval = window.setInterval(() => {
    if (!activeSession || !activeSession.isActive) return;
    
    activeSession.captureCount++;
    
    // Get time domain data
    analyser.getByteTimeDomainData(dataArray);
    
    // Convert Uint8 (0-255) to float (-1 to 1)
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128.0;
      activeSession.samples.push(normalized);
    }
    
    // Log every 50 captures (~1 second)
    if (activeSession.captureCount % 50 === 0) {
      const durationSec = activeSession.samples.length / audioContext.sampleRate;
      console.log(`📊 [AudioForensics] Capturing... (${activeSession.captureCount} captures, ${activeSession.samples.length} samples, ${durationSec.toFixed(2)}s)`);
    }
  }, SAMPLE_RATE_MS);
  
  console.log('✅ Pipeline active! Capturing every', SAMPLE_RATE_MS, 'ms');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

// ═══════════════════════════════════════════════════════════
// V2: STOP INTERVAL CAPTURE
// ═══════════════════════════════════════════════════════════

export function stopIntervalCapture(): void {
  console.log('🛑 [AudioForensics] Stopping interval capture...');
  
  if (activeSession) {
    activeSession.isActive = false;
    
    if (activeSession.captureInterval !== null) {
      clearInterval(activeSession.captureInterval);
      activeSession.captureInterval = null;
      console.log('✅ Interval stopped');
    }
    
    try {
      if (activeSession.analyser) activeSession.analyser.disconnect();
      if (activeSession.source) activeSession.source.disconnect();
      console.log('✅ Pipeline disconnected');
    } catch (err) {
      console.warn('⚠️ Error disconnecting:', err);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ANALYZE AUDIO FRAME (Legacy - still called from VideoRecorder)
// ═══════════════════════════════════════════════════════════

let frameCounter = 0;

export function analyzeAudioFrame(analyserNode: AnalyserNode): void {
  if (!currentSession || !analyserNode) return;

  const frequencyData = new Float32Array(analyserNode.frequencyBinCount);
  analyserNode.getFloatFrequencyData(frequencyData);

  const timeData = new Uint8Array(analyserNode.fftSize);
  analyserNode.getByteTimeDomainData(timeData);

  // Calculate RMS amplitude
  const amplitude = calculateRMS(timeData);
  currentSession.amplitudeSamples.push(amplitude);
  
  // Check if voice is present
  const isVoicePresent = amplitude > 0.015;
  
  // Estimate pitch if voice present
  let pitch = 0;
  if (isVoicePresent) {
    pitch = estimatePitch(frequencyData, 48000); // Assume 48kHz sample rate
  }
  
  currentSession.pitchFrameSamples.push(pitch);
  if (pitch > 0) {
    currentSession.pitchSamples.push(pitch);
  }
  
  // Debug log every 30 frames
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

// ═══════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function calculateRMS(timeData: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < timeData.length; i++) {
    const normalized = (timeData[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / timeData.length);
}

function estimatePitch(frequencyData: Float32Array, sampleRate: number): number {
  let maxIndex = 0;
  let maxValue = -Infinity;

  const minBin = Math.floor((80 * frequencyData.length * 2) / sampleRate);
  const maxBin = Math.floor((500 * frequencyData.length * 2) / sampleRate);

  for (let i = minBin; i < Math.min(maxBin, frequencyData.length); i++) {
    if (frequencyData[i] > maxValue) {
      maxValue = frequencyData[i];
      maxIndex = i;
    }
  }

  const frequency = (maxIndex * sampleRate) / (frequencyData.length * 2);
  return maxValue > -40 ? frequency : 0;
}

// ═══════════════════════════════════════════════════════════
// V2: ADAPTIVE THRESHOLD CONFIGURATION
// ═══════════════════════════════════════════════════════════

const V2_CONFIG = {
  ADAPTIVE_THRESHOLD_PERCENTILE: 15, // Usar percentil 15 como silêncio
  MIN_THRESHOLD: 0.003,               // Mínimo absoluto (0.3%)
  MIN_SILENCE_DURATION_MS: 300,       // 300ms = pausa
  FILLER_MIN_DURATION_MS: 150,        // 150ms mínimo
  FILLER_MAX_DURATION_MS: 800,        // 800ms máximo
};

// ═══════════════════════════════════════════════════════════
// V2: CALCULATE ADAPTIVE THRESHOLD
// ═══════════════════════════════════════════════════════════

function calculateAdaptiveThresholdV2(samples: number[]): number {
  // Calcular amplitudes absolutas
  const amplitudes = samples.map(s => Math.abs(s));
  
  // Ordenar
  const sorted = amplitudes.slice().sort((a, b) => a - b);
  
  // Pegar percentil (ex: 15% = threshold de silêncio)
  const index = Math.floor(sorted.length * (V2_CONFIG.ADAPTIVE_THRESHOLD_PERCENTILE / 100));
  const threshold = sorted[index];
  
  // Garantir mínimo
  const finalThreshold = Math.max(threshold, V2_CONFIG.MIN_THRESHOLD);
  
  console.log('📊 [Threshold Adaptativo]');
  console.log('   Percentil', V2_CONFIG.ADAPTIVE_THRESHOLD_PERCENTILE, 'raw:', threshold.toFixed(5));
  console.log('   Threshold final:', finalThreshold.toFixed(5));
  
  return finalThreshold;
}

// ═══════════════════════════════════════════════════════════
// V2: SEGMENT VOICE vs SILENCE (ADAPTIVE)
// ═══════════════════════════════════════════════════════════

interface VoiceSegmentResult {
  voiceSamples: number[];
  voicePercentage: number;
  silencePercentage: number;
  silentPeriods: number;
  longestPauseMs: number;
}

function segmentVoiceAndSilenceV2(
  samples: number[],
  threshold: number,
  sampleRate: number
): VoiceSegmentResult {
  const minSilenceSamples = (V2_CONFIG.MIN_SILENCE_DURATION_MS / 1000) * sampleRate;
  
  let voiceSampleCount = 0;
  let silentPeriods = 0;
  let currentSilenceLength = 0;
  let maxSilenceLength = 0;
  const voiceSamples: number[] = [];
  
  for (let i = 0; i < samples.length; i++) {
    const amplitude = Math.abs(samples[i]);
    
    if (amplitude > threshold) {
      // VOZ
      voiceSampleCount++;
      voiceSamples.push(samples[i]);
      
      // Pausa terminou?
      if (currentSilenceLength >= minSilenceSamples) {
        silentPeriods++;
        maxSilenceLength = Math.max(maxSilenceLength, currentSilenceLength);
      }
      currentSilenceLength = 0;
    } else {
      // SILÊNCIO
      currentSilenceLength++;
    }
  }
  
  // Última pausa
  if (currentSilenceLength >= minSilenceSamples) {
    silentPeriods++;
    maxSilenceLength = Math.max(maxSilenceLength, currentSilenceLength);
  }
  
  const voicePercentage = (voiceSampleCount / samples.length) * 100;
  const silencePercentage = 100 - voicePercentage;
  const longestPauseMs = (maxSilenceLength / sampleRate) * 1000;
  
  return {
    voiceSamples,
    voicePercentage,
    silencePercentage,
    silentPeriods,
    longestPauseMs,
  };
}

// ═══════════════════════════════════════════════════════════
// V2: CALCULATE METRICS (ADAPTIVE)
// ═══════════════════════════════════════════════════════════

function calculateJitterV2(voiceSamples: number[]): number {
  if (voiceSamples.length < 10) return 0;
  
  let sum = 0;
  for (let i = 1; i < voiceSamples.length; i++) {
    const diff = Math.abs(voiceSamples[i] - voiceSamples[i - 1]);
    sum += diff;
  }
  
  const avgDiff = sum / (voiceSamples.length - 1);
  // Normalizar para 0-100 (quanto maior, mais nervoso)
  return Math.min(100, avgDiff * 1000);
}

function calculateShimmerV2(voiceSamples: number[]): number {
  if (voiceSamples.length < 100) return 0;
  
  const windowSize = 100;
  const energies: number[] = [];
  
  for (let i = 0; i < voiceSamples.length - windowSize; i += windowSize) {
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += voiceSamples[i + j] * voiceSamples[i + j];
    }
    energies.push(energy / windowSize);
  }
  
  if (energies.length < 2) return 0;
  
  let sum = 0;
  for (let i = 1; i < energies.length; i++) {
    const diff = Math.abs(energies[i] - energies[i - 1]);
    sum += diff;
  }
  
  const avgDiff = sum / (energies.length - 1);
  return Math.min(100, avgDiff * 5000);
}

function detectFillerWordsV2(
  samples: number[],
  threshold: number,
  sampleRate: number
): number {
  const minSamples = (V2_CONFIG.FILLER_MIN_DURATION_MS / 1000) * sampleRate;
  const maxSamples = (V2_CONFIG.FILLER_MAX_DURATION_MS / 1000) * sampleRate;
  
  let fillerCount = 0;
  let currentSoundLength = 0;
  let inSound = false;
  
  for (let i = 0; i < samples.length; i++) {
    const amplitude = Math.abs(samples[i]);
    
    if (amplitude > threshold) {
      if (!inSound) {
        inSound = true;
        currentSoundLength = 1;
      } else {
        currentSoundLength++;
      }
    } else {
      if (inSound) {
        // Som terminou - era uma hesitação?
        if (currentSoundLength >= minSamples && currentSoundLength <= maxSamples) {
          fillerCount++;
        }
        inSound = false;
        currentSoundLength = 0;
      }
    }
  }
  
  return fillerCount;
}

function analyzePitchStabilityV2(voiceSamples: number[]): number {
  if (voiceSamples.length < 1000) return 50;
  
  const windowSize = 1000;
  const frequencies: number[] = [];
  
  for (let i = 0; i < voiceSamples.length - windowSize; i += windowSize) {
    let zeroCrossings = 0;
    
    for (let j = 1; j < windowSize; j++) {
      if (
        (voiceSamples[i + j - 1] < 0 && voiceSamples[i + j] >= 0) ||
        (voiceSamples[i + j - 1] >= 0 && voiceSamples[i + j] < 0)
      ) {
        zeroCrossings++;
      }
    }
    
    frequencies.push(zeroCrossings);
  }
  
  if (frequencies.length < 2) return 50;
  
  const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
  const variance = frequencies.reduce((sum, f) => sum + Math.pow(f - mean, 2), 0) / frequencies.length;
  const stdDev = Math.sqrt(variance);
  
  const stability = Math.max(0, Math.min(100, 100 - (stdDev / mean) * 50));
  
  return Math.round(stability);
}

// ═══════════════════════════════════════════════════════════
// FINALIZE SESSION - NOW USES V2 IF AVAILABLE
// ═══════════════════════════════════════════════════════════

export function finalizeForensicsSession(recordingDurationMs: number, playerId?: string): VoiceMetrics {
  frameCounter = 0;
  
  // ═══ TRY V2 (INTERVAL-BASED) FIRST ═══
  if (activeSession && activeSession.samples.length > 1000) {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('📊 [AudioForensics V2] CALCULATING METRICS (ADAPTIVE THRESHOLD)');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('Captures:', activeSession.captureCount);
    console.log('Samples:', activeSession.samples.length.toLocaleString());
    console.log('Duration:', (activeSession.samples.length / activeSession.sampleRate).toFixed(2), 's');
    
    const samples = activeSession.samples;
    const sampleRate = activeSession.sampleRate;
    
    // ═══ ETAPA 1: CALCULAR THRESHOLD ADAPTATIVO ═══
    console.log('\n📊 ETAPA 1: Calculando threshold adaptativo...');
    const adaptiveThreshold = calculateAdaptiveThresholdV2(samples);
    
    // ═══ ETAPA 2: SEPARAR VOZ vs SILÊNCIO ═══
    console.log('\n📊 ETAPA 2: Separando voz vs silêncio...');
    const voiceSegments = segmentVoiceAndSilenceV2(samples, adaptiveThreshold, sampleRate);
    console.log('🎤 Voz:', voiceSegments.voicePercentage.toFixed(1), '%');
    console.log('🤫 Silêncio:', voiceSegments.silencePercentage.toFixed(1), '%');
    console.log('⏸️ Pausas detectadas:', voiceSegments.silentPeriods);
    console.log('⏱️ Maior pausa:', voiceSegments.longestPauseMs.toFixed(0), 'ms');
    
    // ═══ ETAPA 3: ANALISAR VOZ ═══
    console.log('\n📊 ETAPA 3: Analisando características da voz...');
    
    // Jitter (variação rápida de amplitude) - usa apenas samples de voz
    const jitter = calculateJitterV2(voiceSegments.voiceSamples);
    console.log('📈 Jitter:', jitter.toFixed(2), '(variação de amplitude)');
    
    // Shimmer (variação de energia) - usa apenas samples de voz
    const shimmer = calculateShimmerV2(voiceSegments.voiceSamples);
    console.log('📈 Shimmer:', shimmer.toFixed(2), '(variação de energia)');
    
    // Hesitações (sons curtos tipo "uhm") - usa threshold adaptativo
    const fillerWordsCount = detectFillerWordsV2(samples, adaptiveThreshold, sampleRate);
    console.log('💬 Hesitações:', fillerWordsCount, '("uhm", "ahh", etc)');
    
    // Pitch stability - usa apenas samples de voz
    const pitchStability = analyzePitchStabilityV2(voiceSegments.voiceSamples);
    console.log('🎵 Estabilidade Pitch:', pitchStability.toFixed(1), '%');
    
    // Response latency
    const responseLatencyMs = activeSession.recordingStartedAt > 0 
      ? activeSession.recordingStartedAt - activeSession.questionDisplayedAt 
      : 0;
    
    // Peak amplitude
    let peakAmplitude = 0;
    for (const s of samples) {
      const abs = Math.abs(s);
      if (abs > peakAmplitude) peakAmplitude = abs;
    }
    
    // Calculate pitch stability classification
    const pitchStabilityClass: 'stable' | 'unstable' | 'micro-tremors' = 
      pitchStability > 70 ? 'stable' :
      pitchStability > 40 ? 'micro-tremors' : 'unstable';
    
    const metrics: VoiceMetrics = {
      responseLatencyMs,
      pitchStability: pitchStabilityClass,
      speechRateBPM: 0, // Not calculated in V2
      avgPitch: 0, // Not calculated in V2
      pitchVariance: 0, // Not calculated in V2
      peakAmplitude: Math.round(peakAmplitude * 100) / 100,
      recordingDurationMs,
      jitter: Math.round(jitter * 100) / 100,
      jitterAbsolute: 0,
      shimmer: Math.round(shimmer * 100) / 100,
      harmonicsToNoise: 0,
      silentPeriods: voiceSegments.silentPeriods,
      longestPause: Math.round(voiceSegments.longestPauseMs),
      fillerWordsCount,
      speechContinuity: Math.round(voiceSegments.voicePercentage),
    };
    
    console.log('\n✅ MÉTRICAS FINAIS V2 (ADAPTIVE):');
    console.log(JSON.stringify(metrics, null, 2));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('[AudioForensics V2] 🎯 RESUMO:');
    console.log('  📊 Fluency Score:', metrics.speechContinuity + '%', metrics.speechContinuity >= 70 ? '✅ FLUENT' : metrics.speechContinuity >= 40 ? '🟡 HESITANT' : '⚠️ FRAGMENTED');
    console.log('  🔇 Silent Periods:', metrics.silentPeriods);
    console.log('  ⏱️ Longest Pause:', (metrics.longestPause / 1000).toFixed(1) + 's');
    console.log('  💬 Filler Words:', metrics.fillerWordsCount);
    console.log('  🎵 Jitter:', metrics.jitter.toFixed(2) + '%');
    console.log('  📈 Shimmer:', metrics.shimmer.toFixed(2) + '%');
    console.log('  🎤 Pitch Stability:', pitchStabilityClass);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    // Stop interval capture
    stopIntervalCapture();
    activeSession = null;
    currentSession = null;
    
    return metrics;
  }
  
  // ═══ FALLBACK TO LEGACY (FRAME-BASED) ═══
  console.log('[AudioForensics] ⚠️ Using legacy frame-based analysis');
  
  if (!currentSession) {
    console.warn('[AudioForensics] ❌ No active session - returning defaults');
    return getDefaultMetrics();
  }

  const { questionDisplayedAt, recordingStartedAt, pitchSamples, pitchFrameSamples, amplitudeSamples } = currentSession;

  console.log('[AudioForensics] 📈 SESSION SUMMARY:', {
    amplitudeSamples: amplitudeSamples.length,
    pitchSamples: pitchSamples.length,
    durationMs: recordingDurationMs,
    samplesPerSecond: (amplitudeSamples.length / (recordingDurationMs / 1000)).toFixed(1),
  });
  
  if (amplitudeSamples.length < 50) {
    console.error('[AudioForensics] ⚠️ CRITICAL: Too few samples collected! Audio capture may not be working.');
  }

  const responseLatencyMs = recordingStartedAt > 0 
    ? recordingStartedAt - questionDisplayedAt 
    : 0;

  const avgPitch = pitchSamples.length > 0
    ? pitchSamples.reduce((a, b) => a + b, 0) / pitchSamples.length
    : 0;

  const pitchVariance = pitchSamples.length > 1
    ? pitchSamples.reduce((sum, p) => sum + Math.pow(p - avgPitch, 2), 0) / pitchSamples.length
    : 0;

  const pitchStability: 'stable' | 'unstable' | 'micro-tremors' = 
    pitchVariance < 100 ? 'stable' :
    pitchVariance < 500 ? 'micro-tremors' : 'unstable';

  const peakAmplitude = amplitudeSamples.length > 0
    ? Math.max(...amplitudeSamples)
    : 0;

  const speechRateBPM = estimateSpeechRate(amplitudeSamples, recordingDurationMs);

  const { jitter, jitterAbsolute } = calculateJitterLegacy(pitchSamples);
  const shimmer = calculateShimmerLegacy(amplitudeSamples);
  const harmonicsToNoise = calculateHNR(amplitudeSamples, pitchSamples);

  const { silentPeriods, longestPause } = calculateSilentPeriodsLegacy(amplitudeSamples, pitchFrameSamples, recordingDurationMs);
  const fillerWordsCount = estimateFillerWordsLegacy(amplitudeSamples, pitchFrameSamples, recordingDurationMs);
  const speechContinuity = calculateSpeechContinuityLegacy(amplitudeSamples, silentPeriods, fillerWordsCount, recordingDurationMs);

  if (playerId) {
    updateBaseline(playerId, avgPitch, responseLatencyMs, speechRateBPM, jitter);
  }

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
    jitter,
    jitterAbsolute,
    shimmer,
    harmonicsToNoise,
    stressDeviation: stressDeviation || undefined,
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
  
  currentSession = null;

  return metrics;
}

// ═══════════════════════════════════════════════════════════
// LEGACY CALCULATION FUNCTIONS
// ═══════════════════════════════════════════════════════════

function calculateJitterLegacy(pitchSamples: number[]): { jitter: number; jitterAbsolute: number } {
  if (pitchSamples.length < 3) {
    return { jitter: 0, jitterAbsolute: 0 };
  }

  let totalDiff = 0;
  let validDiffs = 0;

  for (let i = 1; i < pitchSamples.length; i++) {
    const diff = Math.abs(pitchSamples[i] - pitchSamples[i - 1]);
    if (diff < 50) {
      totalDiff += diff;
      validDiffs++;
    }
  }

  const avgPitch = pitchSamples.reduce((a, b) => a + b, 0) / pitchSamples.length;
  const jitterAbsolute = validDiffs > 0 ? totalDiff / validDiffs : 0;
  const jitter = avgPitch > 0 ? (jitterAbsolute / avgPitch) * 100 : 0;

  return { 
    jitter: Math.round(jitter * 100) / 100, 
    jitterAbsolute: Math.round(jitterAbsolute * 10) / 10 
  };
}

function calculateShimmerLegacy(amplitudeSamples: number[]): number {
  if (amplitudeSamples.length < 3) return 0;

  let totalDiff = 0;
  for (let i = 1; i < amplitudeSamples.length; i++) {
    totalDiff += Math.abs(amplitudeSamples[i] - amplitudeSamples[i - 1]);
  }

  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const avgDiff = totalDiff / (amplitudeSamples.length - 1);
  
  const shimmer = avgAmplitude > 0 ? (avgDiff / avgAmplitude) * 100 : 0;
  return Math.round(shimmer * 100) / 100;
}

function calculateHNR(amplitudeSamples: number[], pitchSamples: number[]): number {
  if (amplitudeSamples.length < 10 || pitchSamples.length < 10) return 0;

  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const voicedSamples = amplitudeSamples.filter(a => a > avgAmplitude * 0.5).length;
  const ratio = voicedSamples / amplitudeSamples.length;
  
  return Math.round(ratio * 30);
}

function calculateSilentPeriodsLegacy(
  amplitudeSamples: number[],
  pitchFrameSamples: number[],
  durationMs: number
): { silentPeriods: number; longestPause: number } {
  if (amplitudeSamples.length < 10) {
    return { silentPeriods: 0, longestPause: 0 };
  }

  const frames = Math.min(amplitudeSamples.length, pitchFrameSamples.length);
  const samplesPerSecond = frames / (durationMs / 1000);
  const minSilenceSamples = Math.max(2, Math.floor(samplesPerSecond * 0.2)); // 200ms
  
  let silentPeriods = 0;
  let currentSilenceLength = 0;
  let longestPause = 0;

  for (let i = 0; i < frames; i++) {
    const pitch = pitchFrameSamples[i] || 0;
    const isSilent = pitch <= 0;

    if (isSilent) {
      currentSilenceLength++;
    } else {
      if (currentSilenceLength >= minSilenceSamples) {
        silentPeriods++;
        const pauseDurationMs = (currentSilenceLength / samplesPerSecond) * 1000;
        if (pauseDurationMs > longestPause) longestPause = pauseDurationMs;
      }
      currentSilenceLength = 0;
    }
  }
  
  if (currentSilenceLength >= minSilenceSamples) {
    silentPeriods++;
    const pauseDurationMs = (currentSilenceLength / samplesPerSecond) * 1000;
    if (pauseDurationMs > longestPause) {
      longestPause = pauseDurationMs;
    }
  }
  
  return { silentPeriods, longestPause: Math.round(longestPause) };
}

function estimateFillerWordsLegacy(amplitudeSamples: number[], pitchFrameSamples: number[], durationMs: number): number {
  if (amplitudeSamples.length < 20 || durationMs < 1000) {
    return 0;
  }

  const frames = Math.min(amplitudeSamples.length, pitchFrameSamples.length);
  const samplesPerSecond = frames / (durationMs / 1000);
  const minFillerSamples = Math.max(1, Math.floor(samplesPerSecond * 0.08));
  const maxFillerSamples = Math.floor(samplesPerSecond * 0.8);
  
  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const lowEnergyThreshold = Math.max(0.005, avgAmplitude * 0.35);
  
  let fillerCount = 0;
  let currentUnvoicedRun = 0;
  let wasVoiced = false;

  for (let i = 0; i < frames; i++) {
    const pitch = pitchFrameSamples[i] || 0;
    const amplitude = amplitudeSamples[i] || 0;
    const voiced = pitch > 0 && amplitude > lowEnergyThreshold;

    if (voiced) {
      if (wasVoiced && currentUnvoicedRun >= minFillerSamples && currentUnvoicedRun <= maxFillerSamples) {
        fillerCount++;
      }
      currentUnvoicedRun = 0;
      wasVoiced = true;
      continue;
    }

    if (wasVoiced) currentUnvoicedRun++;
  }
  
  return fillerCount;
}

function calculateSpeechContinuityLegacy(amplitudeSamples: number[], silentPeriods: number, fillerWordsCount: number, durationMs: number): number {
  if (amplitudeSamples.length < 10 || durationMs < 1000) return 100;
  
  let score = 100;
  
  score -= silentPeriods * 25;
  score -= fillerWordsCount * 15;
  
  const avgAmplitude = amplitudeSamples.reduce((a, b) => a + b, 0) / amplitudeSamples.length;
  const variance = amplitudeSamples.reduce((sum, a) => sum + Math.pow(a - avgAmplitude, 2), 0) / amplitudeSamples.length;
  const coefficientOfVariation = Math.sqrt(variance) / (avgAmplitude || 1);
  
  if (coefficientOfVariation > 1.5) {
    score -= 35;
  } else if (coefficientOfVariation > 1.0) {
    score -= 25;
  } else if (coefficientOfVariation > 0.7) {
    score -= 15;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function estimateSpeechRate(amplitudeSamples: number[], durationMs: number): number {
  if (amplitudeSamples.length < 10 || durationMs < 1000) return 0;

  const threshold = 0.15;
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

  const wordCount = syllableCount / 2;
  const minutesFraction = durationMs / 60000;
  
  return minutesFraction > 0 ? Math.round(wordCount / minutesFraction) : 0;
}

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

// ═══════════════════════════════════════════════════════════
// FORENSIC PROMPT GENERATOR
// ═══════════════════════════════════════════════════════════

export function generateForensicPrompt(metrics: VoiceMetrics): string {
  const latencyAnalysis = 
    metrics.responseLatencyMs < 500 ? 'Resposta rápida (< 500ms)' :
    metrics.responseLatencyMs < 2000 ? 'Latência moderada' :
    'Hesitação prolongada';

  const speechAnalysis = 
    metrics.speechRateBPM > 200 ? 'Fala acelerada' :
    metrics.speechRateBPM > 120 ? 'Ritmo normal' :
    'Fala lenta/pausada';

  const jitterAnalysis = 
    metrics.jitter < 0.5 ? 'Voz estável (sem tremor)' :
    metrics.jitter < 1.5 ? 'Micro-tremores detectados' :
    metrics.jitter < 3.0 ? 'Tremor vocal significativo' :
    'Instabilidade vocal crítica';

  const shimmerAnalysis = 
    metrics.shimmer < 3 ? 'Intensidade vocal consistente' :
    metrics.shimmer < 8 ? 'Variações leves de intensidade' :
    'Flutuações de volume notáveis';

  const clarityAnalysis = 
    metrics.harmonicsToNoise > 20 ? 'Voz clara e confiante' :
    metrics.harmonicsToNoise > 12 ? 'Clareza normal' :
    'Voz abafada/insegura';

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
- JITTER: ${metrics.jitter}% (${jitterAnalysis})
- SHIMMER: ${metrics.shimmer}% (${shimmerAnalysis})
- Clareza vocal (HNR): ${metrics.harmonicsToNoise}dB (${clarityAnalysis})

🎤 FLUÊNCIA DA FALA:
- Pausas longas (>200ms): ${metrics.silentPeriods} (${pauseAnalysis})
- Maior pausa: ${(metrics.longestPause / 1000).toFixed(1)}s
- Hesitações ("uhm/ahh"): ${metrics.fillerWordsCount} detectadas
- Score de fluência: ${metrics.speechContinuity}/100 (${fluencyAnalysis})`;

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

export function hasActiveSession(): boolean {
  return currentSession !== null || activeSession !== null;
}

export type { StressDeviation } from './voiceBaselineService';
