// Mycroft Human Reading Service
// Maps biometric voice metrics to human-readable feedback scenarios
// 10 scenarios: 3 truth (green), 3 gray zone (yellow), 4 bluff (red)

import { VoiceMetrics } from './audioForensicsService';

export type ReadingZone = 'truth' | 'attention' | 'bluff';

export interface MycroftHumanReading {
  zone: ReadingZone;
  scenarioId: number; // 1-10
  title: string;
  lines: string[];
  conclusion: string;
  zoneLabel: string;
  color: 'emerald' | 'yellow' | 'red';
}

// The 10 scenarios from the design spec
const SCENARIOS: Record<number, Omit<MycroftHumanReading, 'zone' | 'color' | 'zoneLabel'>> = {
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
 * Calculate a composite stress/bluff score from voice metrics (0-100)
 * Higher = more likely bluffing
 */
function calculateBluffScore(metrics: VoiceMetrics): number {
  let score = 0;
  let factors = 0;
  
  // 1. Response latency (fast = suspicious, very slow = suspicious)
  if (metrics.responseLatencyMs !== undefined) {
    const latency = metrics.responseLatencyMs;
    if (latency < 1500) {
      // Too fast - suspicious
      score += 70;
    } else if (latency < 3000) {
      score += 40;
    } else if (latency < 5000) {
      score += 20; // Normal range
    } else if (latency < 8000) {
      score += 35; // Getting slow
    } else {
      score += 60; // Very slow - overthinking
    }
    factors++;
  }
  
  // 2. Pitch stability (lower = more stable = more truthful)
  if (metrics.pitchStability !== undefined) {
    const stability = metrics.pitchStability;
    if (stability === 'stable') {
      score += 15;
    } else if (stability === 'micro-tremors') {
      score += 45;
    } else {
      score += 75; // unstable
    }
    factors++;
  }
  
  // 3. Jitter (voice tremor) - higher = more stress
  if (metrics.jitter !== undefined) {
    const jitter = metrics.jitter;
    if (jitter < 0.5) {
      score += 10;
    } else if (jitter < 1.0) {
      score += 30;
    } else if (jitter < 2.0) {
      score += 55;
    } else {
      score += 80;
    }
    factors++;
  }
  
  // 4. Shimmer (amplitude variation) - higher = more stress
  if (metrics.shimmer !== undefined) {
    const shimmer = metrics.shimmer;
    if (shimmer < 3) {
      score += 10;
    } else if (shimmer < 6) {
      score += 35;
    } else if (shimmer < 10) {
      score += 60;
    } else {
      score += 85;
    }
    factors++;
  }
  
  // 5. Stress deviation from baseline (if available)
  if (metrics.stressDeviation?.overallStressScore !== undefined) {
    const stressScore = metrics.stressDeviation.overallStressScore;
    score += stressScore; // Already 0-100
    factors++;
  }
  
  // 6. Speech rate (very fast or very slow = suspicious)
  if (metrics.speechRateBPM !== undefined) {
    const rate = metrics.speechRateBPM;
    if (rate < 80) {
      score += 50; // Very slow
    } else if (rate < 120) {
      score += 20; // Normal
    } else if (rate < 180) {
      score += 35; // Fast but ok
    } else {
      score += 70; // Racing
    }
    factors++;
  }
  
  // Calculate average, default to 50 if no metrics
  return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * Select the appropriate scenario based on bluff score
 */
function selectScenarioId(bluffScore: number, metrics: VoiceMetrics): number {
  // Determine zone first
  let zone: ReadingZone;
  if (bluffScore < 35) {
    zone = 'truth';
  } else if (bluffScore < 60) {
    zone = 'attention';
  } else {
    zone = 'bluff';
  }
  
  // Select specific scenario within zone based on nuances
  if (zone === 'truth') {
    if (bluffScore < 20) {
      return 1; // Pure conviction
    } else if (metrics.stressDeviation?.stressLevel === 'elevated' || metrics.stressDeviation?.stressLevel === 'high') {
      return 2; // Truth with tension
    } else {
      return 3; // Truth barely
    }
  }
  
  if (zone === 'attention') {
    if (metrics.speechRateBPM && (metrics.speechRateBPM < 90 || metrics.speechRateBPM > 160)) {
      return 4; // Irregular rhythm
    } else if (metrics.pitchStability === 'micro-tremors') {
      return 5; // Inconsistent conviction
    } else {
      return 6; // Mixed signals
    }
  }
  
  // Bluff zone
  if (bluffScore >= 85) {
    return 10; // Collapse
  } else if (metrics.responseLatencyMs && metrics.responseLatencyMs < 2000) {
    return 7; // Too fast classic bluff
  } else if (metrics.jitter && metrics.jitter > 1.5) {
    return 9; // Forced conviction
  } else {
    return 8; // Well-executed bluff
  }
}

/**
 * Main function: Generate human-readable Mycroft reading from voice metrics
 */
export function generateHumanReading(metrics: VoiceMetrics): MycroftHumanReading {
  const bluffScore = calculateBluffScore(metrics);
  const scenarioId = selectScenarioId(bluffScore, metrics);
  const scenario = SCENARIOS[scenarioId];
  
  // Determine zone from scenario ID
  let zone: ReadingZone;
  if (scenarioId <= 3) {
    zone = 'truth';
  } else if (scenarioId <= 6) {
    zone = 'attention';
  } else {
    zone = 'bluff';
  }
  
  // Optionally randomize conclusion slightly
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
