// Mycroft Combined Reading Service v2.0
// Generates humanized readings from BOTH vocal and facial analysis
// Uses the 10 combined scenarios provided by the design spec
// Integrates with Mycroft 2.0 Engine for baseline adaptive analysis

import { VoiceMetrics } from './audioForensicsService';
import type { VideoForensicsResult } from './videoForensicsService';
import { analyzeWithMycroft2, type VocalAnalysisResult, type AudioMetrics } from './mycroft2Engine';

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
  // Mycroft 2.0 fields
  confidence?: 'low' | 'medium' | 'high';
  reasoning?: string;
  counterpoint?: string;
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
 * Calculate facial suspicion score from facial analysis (0-100)
 */
function calculateFacialScore(facialAnalysis: VideoForensicsResult | null): number {
  if (!facialAnalysis) return 50;
  
  // Use the overallFacialSuspicion if available
  if (facialAnalysis.overallFacialSuspicion !== undefined) {
    return facialAnalysis.overallFacialSuspicion;
  }
  
  // Fallback calculation
  let score = 0;
  let factors = 0;
  
  // Eye gaze deviation
  if (facialAnalysis.eyeGaze?.dominantDirection) {
    if (facialAnalysis.eyeGaze.dominantDirection === 'straight') {
      score += 20;
    } else {
      score += 60;
    }
    factors++;
  }
  
  // Micro-expressions count
  const microExpCount = facialAnalysis.microExpressions?.detected?.length || 0;
  if (microExpCount === 0) {
    score += 20;
  } else if (microExpCount <= 2) {
    score += 40;
  } else {
    score += 70;
  }
  factors++;
  
  // Facial stress score
  if (facialAnalysis.facialStress?.overallScore !== undefined) {
    score += facialAnalysis.facialStress.overallScore;
    factors++;
  }
  
  return factors > 0 ? Math.round(score / factors) : 50;
}

/**
 * Select scenario based on combined analysis
 * Simplified lookup table instead of nested if/else
 */
function selectScenarioId(
  vocalScore: number,
  facialScore: number,
  voiceMetrics: VoiceMetrics,
  facialAnalysis: VideoForensicsResult | null
): number {
  const combinedScore = (vocalScore * 0.6) + (facialScore * 0.4);
  
  // Pattern detection
  const hasLowLatency = (voiceMetrics.responseLatencyMs ?? 3000) < 2000;
  const hasStableVoice = voiceMetrics.pitchStability === 'stable';
  const hasHighJitter = (voiceMetrics.jitter ?? 0) > 1.5;
  const hasGazeDeviation = facialAnalysis?.eyeGaze?.dominantDirection !== 'straight';
  const hasMicroExpressions = (facialAnalysis?.microExpressions?.detected?.length ?? 0) > 2;
  const hasFacialTension = (facialAnalysis?.facialStress?.overallScore ?? 0) > 50;

  // Scenario selection lookup table
  const scenarios = [
    // Conviction zone (combinedScore < 35)
    { condition: () => combinedScore < 35 && hasLowLatency && hasStableVoice && !hasFacialTension, id: 1 },
    { condition: () => combinedScore < 35 && !hasMicroExpressions && !hasGazeDeviation, id: 6 },
    { condition: () => combinedScore < 35, id: 8 },
    
    // Mixed zone (combinedScore 35-65)
    { condition: () => combinedScore < 65 && hasLowLatency && hasMicroExpressions, id: 2 },
    { condition: () => combinedScore < 65 && !hasHighJitter && hasFacialTension, id: 9 },
    { condition: () => combinedScore < 65 && hasStableVoice && hasFacialTension, id: 3 },
    { condition: () => combinedScore < 65 && hasLowLatency, id: 5 },
    { condition: () => combinedScore < 65, id: 7 },
    
    // Bluff zone (combinedScore >= 65)
    { condition: () => hasHighJitter && hasGazeDeviation, id: 4 },
    { condition: () => true, id: 10 }, // default
  ];

  for (const scenario of scenarios) {
    if (scenario.condition()) {
      return scenario.id;
    }
  }

  return 5; // fallback
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
 * Generate combined reading WITH Mycroft 2.0 Engine integration
 * This uses adaptive baseline for vocal analysis + facial fusion
 */
export async function generateCombinedReadingWithBaseline(
  voiceMetrics: VoiceMetrics,
  facialAnalysis: VideoForensicsResult | null,
  userId: string | null,
  wasCorrect?: boolean
): Promise<CombinedReading> {
  try {
    // Get Mycroft 2.0 vocal analysis with adaptive baseline
    const audioMetrics = convertToAudioMetrics(voiceMetrics);
    const vocalAnalysis = await analyzeWithMycroft2(userId, audioMetrics, wasCorrect);
    
    // Map Mycroft 2.0 zones to combined zones
    const vocalZoneMap: Record<string, number> = {
      'truth': 20,      // Low suspicion
      'attention': 50,  // Medium suspicion
      'bluff': 80,      // High suspicion
    };
    const vocalScore = vocalZoneMap[vocalAnalysis.zone] || 50;
    
    // Calculate facial score
    const facialScore = calculateFacialScore(facialAnalysis);
    
    // Combined score: 60% vocal + 40% facial
    const combinedScore = (vocalScore * 0.6) + (facialScore * 0.4);
    
    // Select scenario
    const scenarioId = selectScenarioId(vocalScore, facialScore, voiceMetrics, facialAnalysis);
    const scenario = COMBINED_SCENARIOS[scenarioId];
    const zone = determineZone(combinedScore);

    // Enhance technical summary with actual metrics
    let technicalSummary = scenario.technicalSummary;
    
    // Add Mycroft 2.0 insights
    if (vocalAnalysis.confidence) {
      technicalSummary += ` · Confiança: ${vocalAnalysis.confidence}`;
    }
    
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
      combinedScore,
      confidence: vocalAnalysis.confidence,
      reasoning: vocalAnalysis.reasoning,
      counterpoint: vocalAnalysis.counterpoint,
    };
  } catch (error) {
    console.error('[MycroftCombinedReading] Error with Mycroft 2.0:', error);
    // Fallback to legacy method
    return generateCombinedReading(voiceMetrics, facialAnalysis);
  }
}

/**
 * LEGACY: Generate combined reading from vocal + facial analysis
 * Without adaptive baseline (fallback method)
 * CRITICAL: Uses REAL vocal metrics with HIGHLY SENSITIVE scoring
 */
export function generateCombinedReading(
  voiceMetrics: VoiceMetrics,
  facialAnalysis: VideoForensicsResult | null
): CombinedReading {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[MycroftCombinedReading] 🔬 GENERATING COMBINED READING');
  console.log('═══════════════════════════════════════════════════════════════');
  
  // CRITICAL: Calculate vocal score from REAL metrics
  const vocalScore = calculateSimpleVocalScore(voiceMetrics);
  
  // Calculate facial score (defaults to 50 if no video)
  const facialScore = calculateFacialScore(facialAnalysis);
  
  // Combined score: 60% vocal + 40% facial
  // If no facial analysis, use 100% vocal
  const combinedScore = facialAnalysis 
    ? (vocalScore * 0.6) + (facialScore * 0.4)
    : vocalScore; // Use ONLY vocal if no video
  
  console.log('');
  console.log('📊 SCORE BREAKDOWN:');
  console.log(`  • Vocal Score: ${vocalScore}/100 (${facialAnalysis ? '60%' : '100%'} weight)`);
  console.log(`  • Facial Score: ${facialScore}/100 (${facialAnalysis ? '40%' : '0%'} weight)`);
  console.log(`  • Combined Score: ${combinedScore.toFixed(1)}/100`);
  console.log(`  • Zone: ${combinedScore > 65 ? '🔴 BLUFF' : combinedScore > 35 ? '🟡 ATTENTION' : '🟢 CONVICTION'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
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
    combinedScore: Math.round(combinedScore)
  };
}

/**
 * Improved vocal score calculation - HIGHLY SENSITIVE to real stress signals
 * Higher score = more suspicious/bluff-like
 * CRITICAL: Uses REAL metrics with AGGRESSIVE scoring to detect hesitation
 */
function calculateSimpleVocalScore(metrics: VoiceMetrics): number {
  let score = 0;
  let factors = 0;

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('[MycroftCombinedReading] 🔬 CALCULATING VOCAL SUSPICION SCORE');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 RAW METRICS RECEIVED:');
  console.log('  • responseLatencyMs:', metrics.responseLatencyMs);
  console.log('  • pitchStability:', metrics.pitchStability);
  console.log('  • jitter:', metrics.jitter);
  console.log('  • shimmer:', metrics.shimmer);
  console.log('  • speechRateBPM:', metrics.speechRateBPM);
  console.log('  • silentPeriods:', metrics.silentPeriods);
  console.log('  • fillerWordsCount:', metrics.fillerWordsCount);
  console.log('  • speechContinuity:', metrics.speechContinuity);
  console.log('  • longestPause:', metrics.longestPause);
  console.log('═══════════════════════════════════════════════════════════════');

  // ═══════════════════════════════════════════════════════════════
  // 1. RESPONSE LATENCY - How long before they started speaking
  // ═══════════════════════════════════════════════════════════════
  if (metrics.responseLatencyMs !== undefined && metrics.responseLatencyMs > 0) {
    const latency = metrics.responseLatencyMs;
    let latencyScore = 0;
    
    if (latency < 500) latencyScore = 45; // Very fast = possibly rehearsed
    else if (latency < 1000) latencyScore = 25; // Quick confident
    else if (latency < 2000) latencyScore = 35; // Normal thinking
    else if (latency < 4000) latencyScore = 60; // Hesitating
    else if (latency < 6000) latencyScore = 75; // Struggling
    else latencyScore = 90; // Very slow = big problem
    
    score += latencyScore;
    factors++;
    console.log(`  🕐 Latency (${latency}ms) → +${latencyScore} points`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. PITCH STABILITY - Voice trembling indicator
  // ═══════════════════════════════════════════════════════════════
  if (metrics.pitchStability !== undefined) {
    let pitchScore = 0;
    
    if (metrics.pitchStability === 'stable') pitchScore = 15;
    else if (metrics.pitchStability === 'micro-tremors') pitchScore = 60; // INCREASED
    else pitchScore = 85; // Unstable = high stress
    
    score += pitchScore;
    factors++;
    console.log(`  🎵 Pitch stability (${metrics.pitchStability}) → +${pitchScore} points`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 3. JITTER - Cycle-to-cycle pitch variation (key stress marker)
  // ═══════════════════════════════════════════════════════════════
  if (metrics.jitter !== undefined && metrics.jitter > 0) {
    let jitterScore = 0;
    
    if (metrics.jitter < 0.2) jitterScore = 10; // Very stable
    else if (metrics.jitter < 0.5) jitterScore = 25; // Normal
    else if (metrics.jitter < 1.0) jitterScore = 50; // Moderate stress
    else if (metrics.jitter < 1.5) jitterScore = 70; // High stress
    else if (metrics.jitter < 2.5) jitterScore = 85; // Very high stress
    else jitterScore = 95; // Extreme instability
    
    score += jitterScore;
    factors++;
    console.log(`  📈 Jitter (${metrics.jitter.toFixed(2)}%) → +${jitterScore} points`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. SHIMMER - Amplitude variation
  // ═══════════════════════════════════════════════════════════════
  if (metrics.shimmer !== undefined && metrics.shimmer > 0) {
    let shimmerScore = 0;
    
    if (metrics.shimmer < 2) shimmerScore = 10;
    else if (metrics.shimmer < 4) shimmerScore = 30;
    else if (metrics.shimmer < 6) shimmerScore = 50;
    else if (metrics.shimmer < 10) shimmerScore = 70;
    else shimmerScore = 90;
    
    score += shimmerScore;
    factors++;
    console.log(`  🔊 Shimmer (${metrics.shimmer.toFixed(2)}%) → +${shimmerScore} points`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. SPEECH RATE - Too fast or too slow indicates stress
  // ═══════════════════════════════════════════════════════════════
  if (metrics.speechRateBPM !== undefined && metrics.speechRateBPM > 0) {
    let rateScore = 0;
    const rate = metrics.speechRateBPM;
    
    if (rate < 50) rateScore = 80; // Very slow = struggling
    else if (rate < 80) rateScore = 55; // Slow = hesitant
    else if (rate < 130) rateScore = 20; // Normal pace
    else if (rate < 170) rateScore = 45; // Fast = nervous
    else rateScore = 75; // Very fast = panicking
    
    score += rateScore;
    factors++;
    console.log(`  🗣️ Speech rate (${rate} BPM) → +${rateScore} points`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. SILENT PERIODS - Pauses during speech (KEY HESITATION MARKER)
  // ═══════════════════════════════════════════════════════════════
  if (metrics.silentPeriods !== undefined) {
    let pauseScore = 0;
    
    if (metrics.silentPeriods === 0) pauseScore = 10;
    else if (metrics.silentPeriods === 1) pauseScore = 45; // INCREASED
    else if (metrics.silentPeriods === 2) pauseScore = 65; // INCREASED
    else if (metrics.silentPeriods <= 4) pauseScore = 80; // INCREASED
    else pauseScore = 95; // Many pauses = extreme hesitation
    
    score += pauseScore;
    factors++;
    console.log(`  ⏸️ Silent periods (${metrics.silentPeriods}) → +${pauseScore} points ⚠️ KEY METRIC`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 7. FILLER WORDS - "uhm", "ahh" patterns (KEY HESITATION MARKER)
  // ═══════════════════════════════════════════════════════════════
  if (metrics.fillerWordsCount !== undefined) {
    let fillerScore = 0;
    
    if (metrics.fillerWordsCount === 0) fillerScore = 10;
    else if (metrics.fillerWordsCount <= 1) fillerScore = 40;
    else if (metrics.fillerWordsCount <= 3) fillerScore = 65; // INCREASED
    else if (metrics.fillerWordsCount <= 5) fillerScore = 80; // INCREASED
    else fillerScore = 95; // Excessive hesitation markers
    
    score += fillerScore;
    factors++;
    console.log(`  💬 Filler words (${metrics.fillerWordsCount}) → +${fillerScore} points ⚠️ KEY METRIC`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 8. SPEECH CONTINUITY - Overall fluency (0-100, higher = better)
  // ═══════════════════════════════════════════════════════════════
  if (metrics.speechContinuity !== undefined) {
    let continuityScore = 0;
    const continuity = metrics.speechContinuity;
    
    if (continuity >= 85) continuityScore = 10; // Excellent fluency
    else if (continuity >= 70) continuityScore = 30; // Good
    else if (continuity >= 55) continuityScore = 55; // Moderate breaks
    else if (continuity >= 40) continuityScore = 75; // Choppy speech
    else continuityScore = 95; // Very fragmented = high stress
    
    score += continuityScore;
    factors++;
    console.log(`  📊 Speech continuity (${continuity}%) → +${continuityScore} points ⚠️ KEY METRIC`);
  }

  // ═══════════════════════════════════════════════════════════════
  // 9. LONGEST PAUSE - Duration of the longest pause
  // ═══════════════════════════════════════════════════════════════
  if (metrics.longestPause !== undefined && metrics.longestPause > 0) {
    let pauseDurScore = 0;
    const pauseSeconds = metrics.longestPause / 1000;
    
    if (pauseSeconds < 0.3) pauseDurScore = 10;
    else if (pauseSeconds < 0.8) pauseDurScore = 30;
    else if (pauseSeconds < 1.5) pauseDurScore = 50;
    else if (pauseSeconds < 2.5) pauseDurScore = 70;
    else if (pauseSeconds < 4) pauseDurScore = 85;
    else pauseDurScore = 95; // Very long pause = thinking hard
    
    score += pauseDurScore;
    factors++;
    console.log(`  ⏱️ Longest pause (${pauseSeconds.toFixed(1)}s) → +${pauseDurScore} points`);
  }

  // ═══════════════════════════════════════════════════════════════
  // FINAL CALCULATION
  // ═══════════════════════════════════════════════════════════════
  const finalScore = factors > 0 ? Math.round(score / factors) : 50;
  
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`📊 FINAL VOCAL SUSPICION SCORE: ${finalScore}/100`);
  console.log(`   (from ${factors} factors, total raw: ${score})`);
  console.log(`   ${finalScore > 65 ? '🔴 BLUFF ZONE' : finalScore > 35 ? '🟡 ATTENTION ZONE' : '🟢 CONVICTION ZONE'}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  return finalScore;
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
