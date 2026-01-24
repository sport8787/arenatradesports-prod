// Mycroft Human Reading Service v2.0
// Now integrates with adaptive baseline from mycroft2Engine
// Maps biometric voice metrics to human-readable feedback scenarios

import { VoiceMetrics } from './audioForensicsService';
import { analyzeWithMycroft2, type VocalAnalysisResult, type AudioMetrics } from './mycroft2Engine';

export type ReadingZone = 'truth' | 'attention' | 'bluff';

export interface MycroftHumanReading {
  zone: ReadingZone;
  scenarioId: number; // 1-10
  title: string;
  lines: string[];
  conclusion: string;
  zoneLabel: string;
  color: 'emerald' | 'yellow' | 'red';
  // NEW: Mycroft 2.0 fields
  confidence?: 'low' | 'medium' | 'high';
  reasoning?: string;
  counterpoint?: string;
  wasCorrect?: boolean;
}

// The 10 scenarios from the design spec
const SCENARIOS: Record<number, Omit<MycroftHumanReading, 'zone' | 'color' | 'zoneLabel' | 'confidence' | 'reasoning' | 'counterpoint' | 'wasCorrect'>> = {
  // 🟢 TRUTH SCENARIOS (1-3)
  1: {
    scenarioId: 1,
    title: 'Convicção Alta',
    lines: [
      'Voz firme, resposta no tempo certo.',
      'Nenhuma hesitação relevante sob pressão.'
    ],
    conclusion: 'Alta convicção. Provavelmente verdade.'
  },
  2: {
    scenarioId: 2,
    title: 'Verdade com Tensão',
    lines: [
      'Houve tensão, mas o discurso se manteve consistente.',
      'A pressão não quebrou a narrativa.'
    ],
    conclusion: 'Tende à verdade.'
  },
  3: {
    scenarioId: 3,
    title: 'Verdade no Limite',
    lines: [
      'A resposta foi correta, mas a voz oscilou no limite.',
      'Pequenas variações sob estresse.'
    ],
    conclusion: 'Verdade, por pouco.'
  },
  
  // 🟡 GRAY ZONE SCENARIOS (4-6)
  4: {
    scenarioId: 4,
    title: 'Zona de Atenção',
    lines: [
      'Ritmo irregular e pausas calculadas.',
      'Pode ser controle… ou encenação.'
    ],
    conclusion: 'Zona de atenção. Júri decide.'
  },
  5: {
    scenarioId: 5,
    title: 'Convicção Inconsistente',
    lines: [
      'A narrativa se manteve, mas a convicção variou.',
      'A voz não acompanhou a segurança esperada.'
    ],
    conclusion: 'Resultado inconclusivo.'
  },
  6: {
    scenarioId: 6,
    title: 'Sinais Conflitantes',
    lines: [
      'A fala soa convincente, mas o corpo vocal não confirma totalmente.',
      'Indícios mistos.'
    ],
    conclusion: 'Leitura aberta.'
  },
  
  // 🔴 BLUFF SCENARIOS (7-10)
  7: {
    scenarioId: 7,
    title: 'Possível Blefe',
    lines: [
      'Resposta rápida demais, voz instável sob pressão.',
      'Padrões típicos de blefe.'
    ],
    conclusion: 'Suspeita elevada.'
  },
  8: {
    scenarioId: 8,
    title: 'Blefe Bem Executado',
    lines: [
      'Controle emocional aparente, mas microvariações revelam tensão.',
      'Blefe tecnicamente bem construído.'
    ],
    conclusion: 'Alto risco.'
  },
  9: {
    scenarioId: 9,
    title: 'Convicção Forçada',
    lines: [
      'Tom firme demais para o contexto.',
      'Convicção parece ensaiada.'
    ],
    conclusion: 'Provável blefe.'
  },
  10: {
    scenarioId: 10,
    title: 'Blefe sob Colapso',
    lines: [
      'A pressão quebrou o ritmo.',
      'Pausas, aceleração e instabilidade vocal.'
    ],
    conclusion: 'Sinais claros de blefe.'
  }
};

// Conclusion variations for randomization (keeps Mycroft less predictable)
const CONCLUSION_VARIATIONS: Record<ReadingZone, string[]> = {
  truth: ['Provavelmente verdade', 'Tende à verdade', 'Convicção elevada', 'Credibilidade alta'],
  attention: ['Júri decide', 'Resultado inconclusivo', 'Leitura aberta', 'Análise incerta'],
  bluff: ['Suspeita elevada', 'Alto risco', 'Provável blefe', 'Sinais de blefe']
};

const ZONE_LABELS: Record<ReadingZone, string> = {
  truth: 'Convicção Alta',
  attention: 'Zona de Atenção',
  bluff: 'Zona de Blefe'
};

const ZONE_COLORS: Record<ReadingZone, 'emerald' | 'yellow' | 'red'> = {
  truth: 'emerald',
  attention: 'yellow',
  bluff: 'red'
};

/**
 * Convert VoiceMetrics to AudioMetrics format for Mycroft 2.0
 */
function convertToAudioMetrics(metrics: VoiceMetrics): AudioMetrics {
  return {
    pitch: metrics.avgPitch || 0,
    jitter: metrics.jitter || 0,
    shimmer: metrics.shimmer || 0,
    hnr: metrics.harmonicsToNoise || 0,
    latency: metrics.responseLatencyMs || 0,
    speechRate: metrics.speechRateBPM || 0,
  };
}

/**
 * Convert Mycroft 2.0 result to human-readable format
 */
function convertToHumanReading(result: VocalAnalysisResult): MycroftHumanReading {
  const scenario = SCENARIOS[result.scenarioId] || SCENARIOS[5];
  
  // Use the dynamic text from Mycroft 2.0 or fallback to static scenario
  const lines = result.scenarioText?.body 
    ? result.scenarioText.body.split('. ').filter(l => l.length > 0).map(l => l.endsWith('.') ? l : l + '.')
    : scenario.lines;
  
  return {
    scenarioId: result.scenarioId,
    zone: result.zone,
    title: result.scenarioText?.title || scenario.title,
    lines,
    conclusion: result.scenarioText?.conclusion || scenario.conclusion,
    zoneLabel: ZONE_LABELS[result.zone],
    color: ZONE_COLORS[result.zone],
    confidence: result.confidence,
    reasoning: result.reasoning,
    counterpoint: result.counterpoint,
    wasCorrect: result.wasCorrect,
  };
}

/**
 * Calculate a composite stress/bluff score from voice metrics (0-100)
 * Used for basic analysis without adaptive baseline
 */
function calculateBluffScore(metrics: VoiceMetrics): number {
  let score = 0;
  let factors = 0;
  
  // 1. Response latency (fast = suspicious, very slow = suspicious)
  if (metrics.responseLatencyMs !== undefined) {
    const latency = metrics.responseLatencyMs;
    if (latency < 1500) {
      score += 70;
    } else if (latency < 3000) {
      score += 40;
    } else if (latency < 5000) {
      score += 20;
    } else if (latency < 8000) {
      score += 35;
    } else {
      score += 60;
    }
    factors++;
  }
  
  // 2. Pitch stability
  if (metrics.pitchStability !== undefined) {
    if (metrics.pitchStability === 'stable') {
      score += 15;
    } else if (metrics.pitchStability === 'micro-tremors') {
      score += 45;
    } else {
      score += 75;
    }
    factors++;
  }
  
  // 3. Jitter (voice tremor)
  if (metrics.jitter !== undefined) {
    if (metrics.jitter < 0.5) {
      score += 10;
    } else if (metrics.jitter < 1.0) {
      score += 30;
    } else if (metrics.jitter < 2.0) {
      score += 55;
    } else {
      score += 80;
    }
    factors++;
  }
  
  // 4. Shimmer
  if (metrics.shimmer !== undefined) {
    if (metrics.shimmer < 3) {
      score += 10;
    } else if (metrics.shimmer < 6) {
      score += 35;
    } else if (metrics.shimmer < 10) {
      score += 60;
    } else {
      score += 85;
    }
    factors++;
  }
  
  // 5. Stress deviation from baseline
  if (metrics.stressDeviation?.overallStressScore !== undefined) {
    score += metrics.stressDeviation.overallStressScore;
    factors++;
  }
  
  // 6. Speech rate
  if (metrics.speechRateBPM !== undefined) {
    const rate = metrics.speechRateBPM;
    if (rate < 80) {
      score += 50;
    } else if (rate < 120) {
      score += 20;
    } else if (rate < 180) {
      score += 35;
    } else {
      score += 70;
    }
    factors++;
  }
  
  return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * Select scenario based on bluff score (legacy method without adaptive baseline)
 */
function selectScenarioId(bluffScore: number, metrics: VoiceMetrics): number {
  let zone: ReadingZone;
  if (bluffScore < 35) {
    zone = 'truth';
  } else if (bluffScore < 60) {
    zone = 'attention';
  } else {
    zone = 'bluff';
  }
  
  if (zone === 'truth') {
    if (bluffScore < 20) return 1;
    else if (metrics.stressDeviation?.stressLevel === 'elevated' || metrics.stressDeviation?.stressLevel === 'high') return 2;
    else return 3;
  }
  
  if (zone === 'attention') {
    if (metrics.speechRateBPM && (metrics.speechRateBPM < 90 || metrics.speechRateBPM > 160)) return 4;
    else if (metrics.pitchStability === 'micro-tremors') return 5;
    else return 6;
  }
  
  if (bluffScore >= 85) return 10;
  else if (metrics.responseLatencyMs && metrics.responseLatencyMs < 2000) return 7;
  else if (metrics.jitter && metrics.jitter > 1.5) return 9;
  else return 8;
}

/**
 * NEW: Generate human-readable Mycroft reading with adaptive baseline (Mycroft 2.0)
 * Requires userId for personalized analysis
 */
export async function generateHumanReadingWithBaseline(
  metrics: VoiceMetrics,
  userId: string | null,
  wasCorrect?: boolean
): Promise<MycroftHumanReading> {
  try {
    const audioMetrics = convertToAudioMetrics(metrics);
    const result = await analyzeWithMycroft2(userId, audioMetrics, wasCorrect);
    return convertToHumanReading(result);
  } catch (error) {
    console.error('[MycroftHumanReading] Error with Mycroft 2.0:', error);
    // Fallback to legacy method
    return generateHumanReading(metrics);
  }
}

/**
 * LEGACY: Generate human-readable Mycroft reading from voice metrics (without adaptive baseline)
 */
export function generateHumanReading(metrics: VoiceMetrics): MycroftHumanReading {
  const bluffScore = calculateBluffScore(metrics);
  const scenarioId = selectScenarioId(bluffScore, metrics);
  const scenario = SCENARIOS[scenarioId];
  
  let zone: ReadingZone;
  if (scenarioId <= 3) zone = 'truth';
  else if (scenarioId <= 6) zone = 'attention';
  else zone = 'bluff';
  
  const useVariation = Math.random() > 0.7;
  const conclusion = useVariation 
    ? CONCLUSION_VARIATIONS[zone][Math.floor(Math.random() * CONCLUSION_VARIATIONS[zone].length)]
    : scenario.conclusion;
  
  return {
    ...scenario,
    conclusion,
    zone,
    zoneLabel: ZONE_LABELS[zone],
    color: ZONE_COLORS[zone]
  };
}

/**
 * Get bluff score from metrics (for the visual bar)
 */
export function getBluffScore(metrics: VoiceMetrics): number {
  return calculateBluffScore(metrics);
}

/**
 * Generate the full text for TTS (reading aloud)
 */
export function generateReadingText(reading: MycroftHumanReading): string {
  return `${reading.lines.join(' ')} ${reading.conclusion}`;
}

/**
 * Fallback reading when no metrics available
 */
export function getFallbackReading(): MycroftHumanReading {
  return {
    scenarioId: 5,
    zone: 'attention',
    title: 'Análise Inconclusiva',
    lines: [
      'Dados biométricos insuficientes para análise.',
      'Métricas vocais não capturadas adequadamente.'
    ],
    conclusion: 'Júri deve decidir sem apoio técnico.',
    zoneLabel: 'Zona de Atenção',
    color: 'yellow'
  };
}

// Re-export types from mycroft2Engine
export type { VocalAnalysisResult, AudioMetrics } from './mycroft2Engine';
