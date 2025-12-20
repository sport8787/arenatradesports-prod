import { useState, useCallback, useRef } from 'react';

export interface VerdictMetrics {
  responseTimeMs: number;
  successfulBluffs: number;
  caughtBluffs: number;
  totalRounds: number;
  audioRecordingDuration?: number;
}

export interface VerdictReport {
  protocolCode: string;
  metrics: VerdictMetrics;
  analysis: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  fullVerdict: string;
}

// Generate random protocol code
const generateProtocolCode = (): string => {
  const codes = ['402', '503', '101', '707', '999', '314', '227'];
  const code = codes[Math.floor(Math.random() * codes.length)];
  return `Protocolo de Análise ${code} concluído.`;
};

// Analyze response time
const analyzeResponseTime = (timeMs: number): string | null => {
  if (timeMs > 15000) {
    return 'Sobrecarga Cognitiva Severa detectada. Tempo de processamento excede parâmetros normais.';
  }
  if (timeMs > 10000) {
    return 'Sobrecarga Cognitiva. Hesitação prolongada indica conflito decisório.';
  }
  if (timeMs > 7000) {
    return 'Latência moderada. Padrão consistente com fabricação de resposta.';
  }
  if (timeMs < 2000) {
    return 'Resposta impulsiva. Possível conhecimento prévio ou confiança excessiva.';
  }
  return null;
};

// Analyze bluff history
const analyzeBluffHistory = (successful: number, caught: number): string | null => {
  const total = successful + caught;
  if (total === 0) return null;
  
  const successRate = successful / total;
  
  if (successRate >= 0.8 && total >= 3) {
    return 'Perfil de Manipulador Experiente. Taxa de sucesso em blefes excede 80%.';
  }
  if (successRate <= 0.2 && total >= 3) {
    return 'Jogador de baixa credibilidade. Histórico comprometido.';
  }
  if (caught >= 3) {
    return `Alerta: ${caught} flagras registrados. Credibilidade em declínio.`;
  }
  if (successful >= 3) {
    return `Atenção: ${successful} blefes bem-sucedidos. Adversário habilidoso.`;
  }
  return null;
};

// Simulate audio stress analysis
const analyzeAudioStress = (durationMs?: number): string | null => {
  if (!durationMs) return null;
  
  // Simulate random analysis results
  const analyses = [
    'Análise de frequência vocal: Micro-tremores detectados na faixa 85-120Hz.',
    'Padrão de hesitação identificado. Pausas irregulares sugerem elaboração mental.',
    'Velocidade de fala acelerada em 23%. Indicador de ansiedade moderada.',
    'Tom de voz estável. Controle emocional acima da média.',
    'Variação de pitch detectada. Possível indicador de estresse narrativo.',
    'Cadência vocal uniforme. Resposta potencialmente ensaiada.',
  ];
  
  return analyses[Math.floor(Math.random() * analyses.length)];
};

// Determine risk level
const calculateRiskLevel = (metrics: VerdictMetrics): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' => {
  let riskScore = 0;
  
  // Response time risk
  if (metrics.responseTimeMs > 15000) riskScore += 3;
  else if (metrics.responseTimeMs > 10000) riskScore += 2;
  else if (metrics.responseTimeMs > 7000) riskScore += 1;
  
  // Bluff history risk
  const total = metrics.successfulBluffs + metrics.caughtBluffs;
  if (total > 0) {
    const successRate = metrics.successfulBluffs / total;
    if (successRate >= 0.7) riskScore += 2;
  }
  if (metrics.successfulBluffs >= 4) riskScore += 2;
  
  if (riskScore >= 5) return 'CRITICAL';
  if (riskScore >= 3) return 'HIGH';
  if (riskScore >= 1) return 'MEDIUM';
  return 'LOW';
};

// Generate recommendation based on analysis
const generateRecommendation = (riskLevel: string, metrics: VerdictMetrics): string => {
  const recommendations = {
    CRITICAL: [
      'Recomendação: Máxima vigilância. Alta probabilidade de blefe em andamento.',
      'Veredicto: Jogador em modo de alto risco. Duvidar é estatisticamente favorável.',
    ],
    HIGH: [
      'Avaliação: Padrões suspeitos detectados. Proceder com cautela.',
      'Sugestão: Analisar linguagem corporal para confirmação.',
    ],
    MEDIUM: [
      'Status: Dentro dos parâmetros normais. Nenhuma anomalia crítica.',
      'Observação: Monitoramento contínuo recomendado.',
    ],
    LOW: [
      'Conclusão: Comportamento consistente com resposta genuína.',
      'Nota: Baixa probabilidade de engano baseado em dados disponíveis.',
    ],
  };
  
  const options = recommendations[riskLevel as keyof typeof recommendations] || recommendations.LOW;
  return options[Math.floor(Math.random() * options.length)];
};

export function useMycroftVerdict() {
  const [metrics, setMetrics] = useState<VerdictMetrics>({
    responseTimeMs: 0,
    successfulBluffs: 0,
    caughtBluffs: 0,
    totalRounds: 0,
  });
  
  const responseStartTime = useRef<number | null>(null);

  // Start tracking response time when question is shown
  const startResponseTimer = useCallback(() => {
    responseStartTime.current = Date.now();
  }, []);

  // Stop timer and record response time
  const stopResponseTimer = useCallback(() => {
    if (responseStartTime.current) {
      const elapsed = Date.now() - responseStartTime.current;
      setMetrics(prev => ({ ...prev, responseTimeMs: elapsed }));
      responseStartTime.current = null;
      return elapsed;
    }
    return 0;
  }, []);

  // Record bluff result
  const recordBluffResult = useCallback((wasSuccessful: boolean) => {
    setMetrics(prev => ({
      ...prev,
      successfulBluffs: prev.successfulBluffs + (wasSuccessful ? 1 : 0),
      caughtBluffs: prev.caughtBluffs + (wasSuccessful ? 0 : 1),
      totalRounds: prev.totalRounds + 1,
    }));
  }, []);

  // Record audio duration
  const recordAudioDuration = useCallback((durationMs: number) => {
    setMetrics(prev => ({ ...prev, audioRecordingDuration: durationMs }));
  }, []);

  // Generate full verdict report
  const generateVerdict = useCallback((): VerdictReport => {
    const analysis: string[] = [];
    
    // Protocol code
    const protocolCode = generateProtocolCode();
    
    // Analyze response time
    const responseAnalysis = analyzeResponseTime(metrics.responseTimeMs);
    if (responseAnalysis) analysis.push(responseAnalysis);
    
    // Analyze bluff history
    const historyAnalysis = analyzeBluffHistory(metrics.successfulBluffs, metrics.caughtBluffs);
    if (historyAnalysis) analysis.push(historyAnalysis);
    
    // Analyze audio
    const audioAnalysis = analyzeAudioStress(metrics.audioRecordingDuration);
    if (audioAnalysis) analysis.push(audioAnalysis);
    
    // If no analysis points, add generic one
    if (analysis.length === 0) {
      analysis.push('Dados insuficientes para análise conclusiva. Coleta de métricas em andamento.');
    }
    
    // Calculate risk
    const riskLevel = calculateRiskLevel(metrics);
    
    // Generate recommendation
    const recommendation = generateRecommendation(riskLevel, metrics);
    
    // Build full verdict text for TTS
    const fullVerdict = [
      protocolCode,
      ...analysis,
      recommendation,
    ].join(' ');
    
    return {
      protocolCode,
      metrics,
      analysis,
      riskLevel,
      recommendation,
      fullVerdict,
    };
  }, [metrics]);

  // Reset metrics for new game
  const resetMetrics = useCallback(() => {
    setMetrics({
      responseTimeMs: 0,
      successfulBluffs: 0,
      caughtBluffs: 0,
      totalRounds: 0,
    });
  }, []);

  return {
    metrics,
    startResponseTimer,
    stopResponseTimer,
    recordBluffResult,
    recordAudioDuration,
    generateVerdict,
    resetMetrics,
  };
}