// Mycroft 2.0 Engine - Adaptive Baseline Behavioral Analysis
// Eliminates false positives by learning player's normal vocal patterns

import { supabase } from '@/integrations/supabase/client';

// ========================================
// TYPES
// ========================================

export interface UserVocalProfile {
  userId: string;
  samplesCount: number;
  baseline: {
    avgPitch: number;
    avgJitter: number;
    avgShimmer: number;
    avgLatency: number;
    avgSpeechRate: number;
  };
  stdDev: {
    pitchStdDev: number;
    jitterStdDev: number;
    shimmerStdDev: number;
    latencyStdDev: number;
    speechRateStdDev: number;
  };
}

export interface FeatureAnalysis {
  value: number;
  deviation: number; // -100 to +100
  signal: 'neutral' | 'pro-conviction' | 'pro-bluff';
  weight: number;
}

export interface VocalAnalysisResult {
  overallSuspicion: 'low' | 'medium' | 'high';
  confidence: 'low' | 'medium' | 'high';
  stressScore: number;
  features: {
    speed: FeatureAnalysis;
    pitch: FeatureAnalysis;
    jitter: FeatureAnalysis;
    shimmer: FeatureAnalysis;
    latency: FeatureAnalysis;
  };
  reasoning: string;
  counterpoint: string;
  wasCorrect?: boolean;
  // Human-readable scenario
  scenarioId: number;
  scenarioText: {
    title: string;
    body: string;
    conclusion: string;
  };
  zone: 'truth' | 'attention' | 'bluff';
}

export interface AudioMetrics {
  pitch: number;
  jitter: number;
  shimmer: number;
  hnr: number;
  latency: number;
  speechRate: number;
}

// ========================================
// SCENARIOS (Human-readable feedback)
// ========================================

const SCENARIOS = {
  // 🟢 TRUTH SCENARIOS (1-3)
  1: {
    zone: 'truth' as const,
    title: 'Convicção Alta',
    body: 'Voz firme, resposta no tempo certo. Nenhuma hesitação relevante sob pressão.',
    conclusion: 'Alta convicção. Provavelmente verdade.',
    variations: ['Provavelmente verdade', 'Tende à verdade', 'Convicção elevada']
  },
  2: {
    zone: 'truth' as const,
    title: 'Verdade com Tensão',
    body: 'Houve tensão, mas o discurso se manteve consistente. A pressão não quebrou a narrativa.',
    conclusion: 'Tende à verdade.',
    variations: ['Consistente sob pressão', 'Narrativa mantida', 'Tensão controlada']
  },
  3: {
    zone: 'truth' as const,
    title: 'Verdade no Limite',
    body: 'A resposta foi correta, mas a voz oscilou no limite. Pequenas variações sob estresse.',
    conclusion: 'Verdade, por pouco.',
    variations: ['Por pouco', 'No limite', 'Quase escorregou']
  },
  
  // 🟡 ATTENTION SCENARIOS (4-6)
  4: {
    zone: 'attention' as const,
    title: 'Zona de Atenção',
    body: 'Ritmo irregular e pausas calculadas. Pode ser controle… ou encenação.',
    conclusion: 'Zona de atenção. Júri decide.',
    variations: ['Sinais mistos', 'Análise inconclusiva', 'Júri decide']
  },
  5: {
    zone: 'attention' as const,
    title: 'Convicção Inconsistente',
    body: 'A narrativa se manteve, mas a convicção variou. A voz não acompanhou a segurança esperada.',
    conclusion: 'Resultado inconclusivo.',
    variations: ['Inconsistência detectada', 'Padrão irregular', 'Dúvida razoável']
  },
  6: {
    zone: 'attention' as const,
    title: 'Sinais Conflitantes',
    body: 'A fala soa convincente, mas o corpo vocal não confirma totalmente. Indícios mistos.',
    conclusion: 'Leitura aberta.',
    variations: ['Indícios mistos', 'Leitura aberta', 'Conflito de sinais']
  },
  
  // 🔴 BLUFF SCENARIOS (7-10)
  7: {
    zone: 'bluff' as const,
    title: 'Possível Blefe',
    body: 'Resposta rápida demais, voz instável sob pressão. Padrões típicos de blefe.',
    conclusion: 'Suspeita elevada.',
    variations: ['Suspeita elevada', 'Padrão de blefe', 'Alerta ativado']
  },
  8: {
    zone: 'bluff' as const,
    title: 'Blefe Bem Executado',
    body: 'Controle emocional aparente, mas microvariações revelam tensão. Blefe tecnicamente bem construído.',
    conclusion: 'Alto risco.',
    variations: ['Alto risco', 'Blefe sofisticado', 'Técnica detectada']
  },
  9: {
    zone: 'bluff' as const,
    title: 'Convicção Forçada',
    body: 'Tom firme demais para o contexto. Convicção parece ensaiada.',
    conclusion: 'Provável blefe.',
    variations: ['Provável blefe', 'Ensaio detectado', 'Convicção artificial']
  },
  10: {
    zone: 'bluff' as const,
    title: 'Blefe sob Colapso',
    body: 'A pressão quebrou o ritmo. Pausas, aceleração e instabilidade vocal.',
    conclusion: 'Sinais claros de blefe.',
    variations: ['Colapso detectado', 'Sinais claros', 'Blefe evidente']
  }
};

// ========================================
// BASELINE MANAGEMENT
// ========================================

async function getOrCreateUserProfile(userId: string): Promise<UserVocalProfile | null> {
  try {
    const { data, error } = await supabase
      .from('user_vocal_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[Mycroft2] Error fetching profile:', error);
      return null;
    }

    if (!data) {
      // Profile doesn't exist, create it
      const { data: newProfile, error: createError } = await supabase
        .from('user_vocal_profiles')
        .insert({
          user_id: userId,
          samples_count: 0,
          avg_pitch: 0,
          avg_jitter: 0,
          avg_shimmer: 0,
          avg_latency: 0,
          avg_speech_rate: 0,
          pitch_std_dev: 0,
          jitter_std_dev: 0,
          shimmer_std_dev: 0,
          latency_std_dev: 0,
          speech_rate_std_dev: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('[Mycroft2] Error creating profile:', createError);
        return null;
      }

      return newProfile ? mapDbToProfile(newProfile) : null;
    }

    return mapDbToProfile(data);
  } catch (err) {
    console.error('[Mycroft2] Profile error:', err);
    return null;
  }
}

async function updateUserProfile(
  userId: string,
  newMetrics: AudioMetrics
): Promise<void> {
  const profile = await getOrCreateUserProfile(userId);
  if (!profile) return;

  const n = profile.samplesCount;
  const newN = n + 1;

  // Update running averages (incremental mean)
  const newAvgPitch = (profile.baseline.avgPitch * n + newMetrics.pitch) / newN;
  const newAvgJitter = (profile.baseline.avgJitter * n + newMetrics.jitter) / newN;
  const newAvgShimmer = (profile.baseline.avgShimmer * n + newMetrics.shimmer) / newN;
  const newAvgLatency = (profile.baseline.avgLatency * n + newMetrics.latency) / newN;
  const newAvgSpeechRate = (profile.baseline.avgSpeechRate * n + newMetrics.speechRate) / newN;

  // Update standard deviations (simplified Welford's approach)
  const pitchDiff = Math.abs(newMetrics.pitch - profile.baseline.avgPitch);
  const jitterDiff = Math.abs(newMetrics.jitter - profile.baseline.avgJitter);
  const shimmerDiff = Math.abs(newMetrics.shimmer - profile.baseline.avgShimmer);
  const latencyDiff = Math.abs(newMetrics.latency - profile.baseline.avgLatency);
  const speechRateDiff = Math.abs(newMetrics.speechRate - profile.baseline.avgSpeechRate);

  const newPitchStdDev = (profile.stdDev.pitchStdDev * n + pitchDiff) / newN;
  const newJitterStdDev = (profile.stdDev.jitterStdDev * n + jitterDiff) / newN;
  const newShimmerStdDev = (profile.stdDev.shimmerStdDev * n + shimmerDiff) / newN;
  const newLatencyStdDev = (profile.stdDev.latencyStdDev * n + latencyDiff) / newN;
  const newSpeechRateStdDev = (profile.stdDev.speechRateStdDev * n + speechRateDiff) / newN;

  await supabase
    .from('user_vocal_profiles')
    .update({
      samples_count: newN,
      avg_pitch: newAvgPitch,
      avg_jitter: newAvgJitter,
      avg_shimmer: newAvgShimmer,
      avg_latency: newAvgLatency,
      avg_speech_rate: newAvgSpeechRate,
      pitch_std_dev: newPitchStdDev,
      jitter_std_dev: newJitterStdDev,
      shimmer_std_dev: newShimmerStdDev,
      latency_std_dev: newLatencyStdDev,
      speech_rate_std_dev: newSpeechRateStdDev,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  console.log(`[Mycroft2] Updated profile for user ${userId}, samples: ${newN}`);
}

// ========================================
// COMBINED FEATURE ANALYSIS
// ========================================

function analyzeFeature(
  current: number,
  baseline: number,
  stdDev: number,
  higherIsBad: boolean = true
): FeatureAnalysis {
  if (stdDev === 0 || baseline === 0) {
    return {
      value: current,
      deviation: 0,
      signal: 'neutral',
      weight: 0,
    };
  }

  // Calculate how many standard deviations away from baseline
  const zScore = (current - baseline) / stdDev;
  const deviationPercent = Math.min(100, Math.max(-100, zScore * 33)); // Cap at ±100

  let signal: 'neutral' | 'pro-conviction' | 'pro-bluff' = 'neutral';
  let weight = 0;

  if (Math.abs(zScore) > 1.5) {
    // More than 1.5 std devs away = significant
    if (higherIsBad) {
      signal = zScore > 0 ? 'pro-bluff' : 'pro-conviction';
    } else {
      signal = zScore > 0 ? 'pro-conviction' : 'pro-bluff';
    }
    weight = Math.min(1, Math.abs(zScore) / 3); // Weight increases with deviation
  }

  return {
    value: current,
    deviation: deviationPercent,
    signal,
    weight,
  };
}

function calculateStressScore(features: VocalAnalysisResult['features']): number {
  // Weighted combination (não usa features isoladas)
  const weights = {
    latency: 0.30,
    jitter: 0.25,
    pitch: 0.25,
    speed: 0.10,
    shimmer: 0.10,
  };

  let score = 0;

  if (features.latency.signal === 'pro-bluff') score += weights.latency * features.latency.weight * 100;
  if (features.jitter.signal === 'pro-bluff') score += weights.jitter * features.jitter.weight * 100;
  if (features.pitch.signal === 'pro-bluff') score += weights.pitch * features.pitch.weight * 100;
  if (features.speed.signal === 'pro-bluff') score += weights.speed * features.speed.weight * 100;
  if (features.shimmer.signal === 'pro-bluff') score += weights.shimmer * features.shimmer.weight * 100;

  // REGRA COMBINADA: Se múltiplas features apontam pro-bluff, aumenta score
  const bluffSignals = Object.values(features).filter(f => f.signal === 'pro-bluff').length;
  if (bluffSignals >= 3) {
    score *= 1.2; // 20% boost if 3+ features agree
  }

  // REGRA COMBINADA: Se múltiplas features apontam pro-conviction, reduz score
  const convictionSignals = Object.values(features).filter(f => f.signal === 'pro-conviction').length;
  if (convictionSignals >= 3) {
    score *= 0.7; // 30% reduction if 3+ features show conviction
  }

  return Math.min(100, Math.max(0, score));
}

function selectScenario(
  stressScore: number,
  features: VocalAnalysisResult['features'],
  wasCorrect?: boolean
): { scenarioId: number; zone: 'truth' | 'attention' | 'bluff' } {
  // AJUSTE DE GABARITO: Se acertou, tendência pro-convicção
  let adjustedScore = stressScore;
  if (wasCorrect === true) {
    adjustedScore *= 0.8; // 20% reduction if correct
  }

  // Determine zone based on adjusted score
  if (adjustedScore < 25) {
    // TRUTH zone (scenarios 1-3)
    if (adjustedScore < 10) return { scenarioId: 1, zone: 'truth' };
    if (adjustedScore < 18) return { scenarioId: 2, zone: 'truth' };
    return { scenarioId: 3, zone: 'truth' };
  } else if (adjustedScore < 55) {
    // ATTENTION zone (scenarios 4-6)
    if (adjustedScore < 35) return { scenarioId: 4, zone: 'attention' };
    if (adjustedScore < 45) return { scenarioId: 5, zone: 'attention' };
    return { scenarioId: 6, zone: 'attention' };
  } else {
    // BLUFF zone (scenarios 7-10)
    if (adjustedScore < 65) return { scenarioId: 7, zone: 'bluff' };
    if (adjustedScore < 75) return { scenarioId: 8, zone: 'bluff' };
    if (adjustedScore < 85) return { scenarioId: 9, zone: 'bluff' };
    return { scenarioId: 10, zone: 'bluff' };
  }
}

function generateReasoning(features: VocalAnalysisResult['features']): { reasoning: string; counterpoint: string } {
  const signals: string[] = [];
  const counterpoints: string[] = [];

  // Speed analysis
  if (features.speed.signal === 'pro-bluff') {
    signals.push('Ritmo de fala alterado em relação ao seu padrão');
    counterpoints.push('Variação de velocidade pode indicar emoção genuína');
  } else if (features.speed.signal === 'pro-conviction') {
    signals.push('Ritmo consistente com seu padrão habitual');
  }

  // Jitter analysis
  if (features.jitter.signal === 'pro-bluff') {
    signals.push('Tremor vocal detectado acima do normal');
  } else if (features.jitter.signal === 'pro-conviction') {
    signals.push('Voz estável, sem tremores');
  }

  // Pitch analysis
  if (features.pitch.signal === 'pro-bluff') {
    signals.push('Variações de tom fora do padrão');
  }

  // Latency analysis
  if (features.latency.signal === 'pro-bluff') {
    signals.push('Tempo de resposta incomum');
    counterpoints.push('Hesitação pode indicar reflexão, não mentira');
  }

  const reasoning = signals.length > 0 ? signals.join('. ') : 'Padrão vocal dentro da normalidade';
  const counterpoint = counterpoints.length > 0 
    ? counterpoints.join('. ') 
    : 'Análise consistente com seu padrão pessoal';

  return { reasoning, counterpoint };
}

// ========================================
// MAIN ANALYSIS FUNCTION
// ========================================

export async function analyzeWithMycroft2(
  userId: string | null,
  audioMetrics: AudioMetrics,
  wasCorrect?: boolean
): Promise<VocalAnalysisResult> {
  // For non-authenticated users, use basic analysis
  if (!userId) {
    return getBasicAnalysis(audioMetrics, wasCorrect);
  }

  // 1. Get or create user profile
  const profile = await getOrCreateUserProfile(userId);

  // 2. If no baseline yet (< 5 samples), return low confidence analysis
  if (!profile || profile.samplesCount < 5) {
    // Update profile with new data
    if (profile) {
      await updateUserProfile(userId, audioMetrics);
    }

    return getLearningModeAnalysis(audioMetrics, profile?.samplesCount || 0, wasCorrect);
  }

  // 3. Analyze each feature against baseline
  const features: VocalAnalysisResult['features'] = {
    speed: analyzeFeature(audioMetrics.speechRate, profile.baseline.avgSpeechRate, profile.stdDev.speechRateStdDev, false),
    pitch: analyzeFeature(audioMetrics.pitch, profile.baseline.avgPitch, profile.stdDev.pitchStdDev),
    jitter: analyzeFeature(audioMetrics.jitter, profile.baseline.avgJitter, profile.stdDev.jitterStdDev),
    shimmer: analyzeFeature(audioMetrics.shimmer, profile.baseline.avgShimmer, profile.stdDev.shimmerStdDev),
    latency: analyzeFeature(audioMetrics.latency, profile.baseline.avgLatency, profile.stdDev.latencyStdDev),
  };

  // 4. Calculate stress score with combined logic
  let stressScore = calculateStressScore(features);

  // 5. AJUSTE DE GABARITO: Se acertou + rápido + stress baixo = pro-convicção
  if (wasCorrect === true && features.speed.signal === 'pro-bluff' && stressScore < 60) {
    stressScore *= 0.7;
    features.speed.signal = 'pro-conviction';
  }

  // 6. Determine overall suspicion
  let overallSuspicion: 'low' | 'medium' | 'high' = 'low';
  if (stressScore > 70) overallSuspicion = 'high';
  else if (stressScore > 40) overallSuspicion = 'medium';

  // 7. Determine confidence based on sample count
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  if (profile.samplesCount < 5) confidence = 'low';
  else if (profile.samplesCount >= 10) confidence = 'high';

  // 8. Select human-readable scenario
  const { scenarioId, zone } = selectScenario(stressScore, features, wasCorrect);
  const scenario = SCENARIOS[scenarioId as keyof typeof SCENARIOS];

  // 9. Generate reasoning with counterpoint
  const { reasoning, counterpoint } = generateReasoning(features);

  // 10. Update user profile with new metrics
  await updateUserProfile(userId, audioMetrics);

  return {
    overallSuspicion,
    confidence,
    stressScore: Math.round(stressScore),
    features,
    reasoning,
    counterpoint,
    wasCorrect,
    scenarioId,
    scenarioText: {
      title: scenario.title,
      body: scenario.body,
      conclusion: scenario.variations[Math.floor(Math.random() * scenario.variations.length)],
    },
    zone,
  };
}

// ========================================
// FALLBACK ANALYSIS (No baseline)
// ========================================

function getLearningModeAnalysis(
  metrics: AudioMetrics,
  samplesCount: number,
  wasCorrect?: boolean
): VocalAnalysisResult {
  const remaining = 5 - samplesCount;
  
  return {
    overallSuspicion: 'low',
    confidence: 'low',
    stressScore: 50,
    features: {
      speed: { value: metrics.speechRate, deviation: 0, signal: 'neutral', weight: 0 },
      pitch: { value: metrics.pitch, deviation: 0, signal: 'neutral', weight: 0 },
      jitter: { value: metrics.jitter, deviation: 0, signal: 'neutral', weight: 0 },
      shimmer: { value: metrics.shimmer, deviation: 0, signal: 'neutral', weight: 0 },
      latency: { value: metrics.latency, deviation: 0, signal: 'neutral', weight: 0 },
    },
    reasoning: `Mycroft está aprendendo seu padrão vocal (${samplesCount}/5 amostras)`,
    counterpoint: `Mais ${remaining} justificativa${remaining > 1 ? 's' : ''} para análise precisa`,
    wasCorrect,
    scenarioId: 5,
    scenarioText: {
      title: 'Modo Aprendizado',
      body: `Mycroft precisa conhecer seu padrão vocal normal. Coletando amostra ${samplesCount + 1} de 5.`,
      conclusion: 'Análise em progresso...',
    },
    zone: 'attention',
  };
}

function getBasicAnalysis(
  metrics: AudioMetrics,
  wasCorrect?: boolean
): VocalAnalysisResult {
  // Simple heuristic-based analysis for guests
  let stressScore = 50;
  
  // High jitter = stress
  if (metrics.jitter > 2) stressScore += 20;
  // High latency = hesitation
  if (metrics.latency > 2000) stressScore += 15;
  // Low speech rate = careful/lying
  if (metrics.speechRate < 80) stressScore += 10;
  
  // Correct answer reduces suspicion
  if (wasCorrect === true) stressScore *= 0.8;
  
  stressScore = Math.min(100, Math.max(0, stressScore));
  
  const zone = stressScore < 35 ? 'truth' : stressScore < 65 ? 'attention' : 'bluff';
  const scenarioId = zone === 'truth' ? 2 : zone === 'attention' ? 5 : 8;
  const scenario = SCENARIOS[scenarioId as keyof typeof SCENARIOS];

  return {
    overallSuspicion: zone === 'truth' ? 'low' : zone === 'attention' ? 'medium' : 'high',
    confidence: 'low',
    stressScore: Math.round(stressScore),
    features: {
      speed: { value: metrics.speechRate, deviation: 0, signal: 'neutral', weight: 0 },
      pitch: { value: metrics.pitch, deviation: 0, signal: 'neutral', weight: 0 },
      jitter: { value: metrics.jitter, deviation: 0, signal: 'neutral', weight: 0 },
      shimmer: { value: metrics.shimmer, deviation: 0, signal: 'neutral', weight: 0 },
      latency: { value: metrics.latency, deviation: 0, signal: 'neutral', weight: 0 },
    },
    reasoning: 'Análise básica (faça login para análise personalizada)',
    counterpoint: 'Baseline adaptativo requer autenticação',
    wasCorrect,
    scenarioId,
    scenarioText: {
      title: scenario.title,
      body: scenario.body,
      conclusion: scenario.conclusion,
    },
    zone,
  };
}

// ========================================
// HELPER
// ========================================

function mapDbToProfile(data: Record<string, unknown>): UserVocalProfile {
  return {
    userId: data.user_id as string,
    samplesCount: data.samples_count as number,
    baseline: {
      avgPitch: Number(data.avg_pitch) || 0,
      avgJitter: Number(data.avg_jitter) || 0,
      avgShimmer: Number(data.avg_shimmer) || 0,
      avgLatency: Number(data.avg_latency) || 0,
      avgSpeechRate: Number(data.avg_speech_rate) || 0,
    },
    stdDev: {
      pitchStdDev: Number(data.pitch_std_dev) || 0,
      jitterStdDev: Number(data.jitter_std_dev) || 0,
      shimmerStdDev: Number(data.shimmer_std_dev) || 0,
      latencyStdDev: Number(data.latency_std_dev) || 0,
      speechRateStdDev: Number(data.speech_rate_std_dev) || 0,
    },
  };
}

// Export for testing
export { SCENARIOS };
