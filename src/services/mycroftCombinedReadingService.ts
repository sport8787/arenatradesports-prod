// Mycroft Combined Reading Service v2.0
// Generates humanized readings from BOTH vocal and facial analysis
// Uses the 10 combined scenarios provided by the design spec

import { VoiceMetrics } from './audioForensicsService';
import type { VideoForensicsResult } from './videoForensicsService';

export type CombinedZone = 'conviction' | 'mixed' | 'bluff';

export interface CombinedReading {
  zone: CombinedZone;
  scenarioId: number; // 1-10
  title: string;
  lines: string[];
  conclusion: string;
  technicalSummary: string; // The "📊 ..." line
  zoneLabel: string;
  color: 'emerald' | 'yellow' | 'red';
  vocalScore: number;
  facialScore: number;
  combinedScore: number;
}

// The 10 combined vocal + facial scenarios from design spec
const COMBINED_SCENARIOS: Record<number, {
  title: string;
  lines: string[];
  conclusion: string;
  technicalSummary: string;
}> = {
  1: {
    title: 'Convicção sólida sob pressão',
    lines: [
      'Resposta rápida e estável.',
      'A voz manteve ritmo consistente e o rosto permaneceu relaxado mesmo sob pressão.',
      'Os sinais indicam alta convicção, não urgência defensiva.'
    ],
    conclusion: 'Alta convicção detectada.',
    technicalSummary: 'Pitch estável · Latência baixa · Expressão facial congruente'
  },
  2: {
    title: 'Segurança que pode enganar',
    lines: [
      'A resposta veio sem hesitação, mas com microajustes faciais no final da frase.',
      'Pode ser convicção genuína ou confiança ensaiada.',
      'O contexto da pergunta é decisivo aqui.'
    ],
    conclusion: 'Convicção aparente, júri decide.',
    technicalSummary: 'Latência curta · Micro-expressões tardias · Voz firme'
  },
  3: {
    title: 'Atenção: excesso de controle',
    lines: [
      'Fala controlada demais e pouca variação emocional.',
      'Quando a resposta é correta, isso costuma indicar domínio.',
      'Quando é falsa, indica preparação excessiva.'
    ],
    conclusion: 'Controle excessivo detectado.',
    technicalSummary: 'Baixa variação de pitch · Expressão facial contida'
  },
  4: {
    title: 'Pressão emocional detectada',
    lines: [
      'A resposta perdeu fluidez conforme avançava.',
      'A voz mostrou instabilidade e o olhar buscou fuga lateral.',
      'Sinais comuns de tensão cognitiva.'
    ],
    conclusion: 'Tensão cognitiva elevada.',
    technicalSummary: 'Pitch instável · Jitter elevado · Desvio de olhar'
  },
  5: {
    title: 'Convicção rápida (zona cinzenta)',
    lines: [
      'Resposta muito rápida, sem sinais claros de estresse.',
      'Em perguntas simples, isso indica convicção.',
      'Em perguntas difíceis, pode indicar risco.'
    ],
    conclusion: 'Zona cinzenta. Contexto importa.',
    technicalSummary: 'Latência mínima · Estabilidade vocal moderada'
  },
  6: {
    title: 'Coerência entre fala e expressão',
    lines: [
      'A expressão facial acompanhou a narrativa da resposta.',
      'Pouca discrepância entre voz, olhar e movimentos labiais.',
      'Sinal de coerência comportamental.'
    ],
    conclusion: 'Coerência comportamental alta.',
    technicalSummary: 'Sincronia facial · Ritmo vocal constante'
  },
  7: {
    title: 'Indício de improviso',
    lines: [
      'A resposta começou firme, mas apresentou micro-hesitações no meio da fala.',
      'Esse padrão costuma surgir quando a justificativa é construída em tempo real.'
    ],
    conclusion: 'Possível improviso detectado.',
    technicalSummary: 'Latência média · Pausas curtas · Micro-expressões intermitentes'
  },
  8: {
    title: 'Confiança emocional elevada',
    lines: [
      'A voz ganhou força conforme a resposta avançava.',
      'Expressão facial aberta e estável.',
      'Esse padrão é comum quando o jogador acredita no que diz.'
    ],
    conclusion: 'Alta confiança emocional.',
    technicalSummary: 'Crescimento de intensidade vocal · Expressão relaxada'
  },
  9: {
    title: 'Sinais mistos detectados',
    lines: [
      'A resposta verbal foi segura, mas o rosto apresentou tensão localizada.',
      'Pode indicar nervosismo situacional, não necessariamente blefe.'
    ],
    conclusion: 'Sinais conflitantes. Atenção.',
    technicalSummary: 'Pitch firme · Tensão facial pontual'
  },
  10: {
    title: 'Zona de risco comportamental',
    lines: [
      'Variação vocal elevada e micro-expressões rápidas no início da fala.',
      'Esse padrão costuma surgir quando há conflito interno entre certeza e dúvida.'
    ],
    conclusion: 'Alto risco de blefe.',
    technicalSummary: 'Jitter alto · Expressões faciais rápidas · Ritmo irregular'
  }
};

const ZONE_LABELS: Record<CombinedZone, string> = {
  conviction: 'Convicção Alta',
  mixed: 'Zona de Atenção',
  bluff: 'Zona de Blefe'
};

const ZONE_COLORS: Record<CombinedZone, 'emerald' | 'yellow' | 'red'> = {
  conviction: 'emerald',
  mixed: 'yellow',
  bluff: 'red'
};

/**
 * Calculate vocal suspicion score from voice metrics (0-100)
 */
function calculateVocalScore(metrics: VoiceMetrics): number {
  let score = 0;
  let factors = 0;

  // Response latency
  if (metrics.responseLatencyMs !== undefined) {
    const latency = metrics.responseLatencyMs;
    if (latency < 1500) score += 65;
    else if (latency < 3000) score += 35;
    else if (latency < 5000) score += 20;
    else if (latency < 8000) score += 40;
    else score += 60;
    factors++;
  }

  // Pitch stability
  if (metrics.pitchStability !== undefined) {
    if (metrics.pitchStability === 'stable') score += 15;
    else if (metrics.pitchStability === 'micro-tremors') score += 50;
    else score += 75;
    factors++;
  }

  // Jitter
  if (metrics.jitter !== undefined) {
    if (metrics.jitter < 0.5) score += 10;
    else if (metrics.jitter < 1.0) score += 35;
    else if (metrics.jitter < 2.0) score += 60;
    else score += 80;
    factors++;
  }

  // Shimmer
  if (metrics.shimmer !== undefined) {
    if (metrics.shimmer < 3) score += 10;
    else if (metrics.shimmer < 6) score += 40;
    else if (metrics.shimmer < 10) score += 65;
    else score += 85;
    factors++;
  }

  // Speech rate
  if (metrics.speechRateBPM !== undefined) {
    const rate = metrics.speechRateBPM;
    if (rate < 80) score += 55;
    else if (rate < 120) score += 20;
    else if (rate < 180) score += 40;
    else score += 70;
    factors++;
  }

  return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * Select scenario based on combined analysis
 */
function selectScenarioId(
  vocalScore: number,
  facialScore: number,
  voiceMetrics: VoiceMetrics,
  facialAnalysis: VideoForensicsResult | null
): number {
  const combinedScore = (vocalScore * 0.6) + (facialScore * 0.4);
  
  // Check for specific patterns
  const hasLowLatency = (voiceMetrics.responseLatencyMs ?? 3000) < 2000;
  const hasStableVoice = voiceMetrics.pitchStability === 'stable';
  const hasHighJitter = (voiceMetrics.jitter ?? 0) > 1.5;
  const hasGazeDeviation = facialAnalysis?.eyeGaze?.dominantDirection !== 'straight';
  const hasMicroExpressions = (facialAnalysis?.microExpressions?.detected?.length ?? 0) > 2;
  const hasFacialTension = (facialAnalysis?.facialStress?.overallScore ?? 0) > 50;

  // Conviction zone (combinedScore < 35)
  if (combinedScore < 35) {
    if (hasLowLatency && hasStableVoice && !hasFacialTension) {
      return 1; // Convicção sólida sob pressão
    }
    if (!hasMicroExpressions && !hasGazeDeviation) {
      return 6; // Coerência entre fala e expressão
    }
    return 8; // Confiança emocional elevada
  }

  // Mixed zone (combinedScore 35-65)
  if (combinedScore < 65) {
    if (hasLowLatency && hasMicroExpressions) {
      return 2; // Segurança que pode enganar
    }
    if (!hasHighJitter && hasFacialTension) {
      return 9; // Sinais mistos detectados
    }
    if (hasStableVoice && hasFacialTension) {
      return 3; // Atenção: excesso de controle
    }
    if (hasLowLatency) {
      return 5; // Convicção rápida (zona cinzenta)
    }
    return 7; // Indício de improviso
  }

  // Bluff zone (combinedScore >= 65)
  if (hasHighJitter && hasGazeDeviation) {
    return 4; // Pressão emocional detectada
  }
  return 10; // Zona de risco comportamental
}

/**
 * Determine zone from combined score
 */
function determineZone(combinedScore: number): CombinedZone {
  if (combinedScore < 35) return 'conviction';
  if (combinedScore < 65) return 'mixed';
  return 'bluff';
}

/**
 * Generate combined reading from vocal + facial analysis
 * This is the main function for Mycroft 2.0 combined analysis
 */
export function generateCombinedReading(
  voiceMetrics: VoiceMetrics,
  facialAnalysis: VideoForensicsResult | null
): CombinedReading {
  const vocalScore = calculateVocalScore(voiceMetrics);
  const facialScore = facialAnalysis?.overallFacialSuspicion ?? 50;
  const combinedScore = (vocalScore * 0.6) + (facialScore * 0.4);
  
  const scenarioId = selectScenarioId(vocalScore, facialScore, voiceMetrics, facialAnalysis);
  const scenario = COMBINED_SCENARIOS[scenarioId];
  const zone = determineZone(combinedScore);

  // Enhance technical summary with actual metrics if available
  let technicalSummary = scenario.technicalSummary;
  
  // Add facial-specific details if available
  if (facialAnalysis) {
    const gazeLabel = facialAnalysis.eyeGaze.dominantDirection === 'straight' 
      ? 'Olhar direto' 
      : facialAnalysis.eyeGaze.dominantDirection === 'left'
        ? 'Olhar esquerda'
        : facialAnalysis.eyeGaze.dominantDirection === 'right'
          ? 'Olhar direita'
          : 'Olhar desviado';
    
    if (facialAnalysis.microExpressions.detected.length > 0) {
      technicalSummary += ` · ${facialAnalysis.microExpressions.detected.length} micro-expressão(ões)`;
    }
    if (facialAnalysis.eyeGaze.dominantDirection !== 'straight') {
      technicalSummary += ` · ${gazeLabel}`;
    }
  }

  return {
    zone,
    scenarioId,
    title: scenario.title,
    lines: scenario.lines,
    conclusion: scenario.conclusion,
    technicalSummary,
    zoneLabel: ZONE_LABELS[zone],
    color: ZONE_COLORS[zone],
    vocalScore,
    facialScore,
    combinedScore
  };
}

/**
 * Generate fallback reading when analysis data is incomplete
 */
export function getFallbackCombinedReading(): CombinedReading {
  return {
    zone: 'mixed',
    scenarioId: 5,
    title: 'Análise Incompleta',
    lines: [
      'Dados biométricos insuficientes para análise completa.',
      'O sistema não conseguiu capturar todas as métricas necessárias.'
    ],
    conclusion: 'Júri deve decidir com informações limitadas.',
    technicalSummary: 'Métricas parciais disponíveis',
    zoneLabel: 'Zona de Atenção',
    color: 'yellow',
    vocalScore: 50,
    facialScore: 50,
    combinedScore: 50
  };
}

/**
 * Generate text for TTS narration
 */
export function generateCombinedReadingText(reading: CombinedReading): string {
  return `${reading.title}. ${reading.lines.join(' ')} ${reading.conclusion}`;
}
