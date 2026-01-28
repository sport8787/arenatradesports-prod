// audioForensicsTypes.ts - Tipos para o sistema de forensics de áudio

export interface VoiceMetrics {
  jitter: number;              // 0-100 (variação rápida de amplitude)
  shimmer: number;             // 0-100 (variação de energia)
  silentPeriods: number;       // Quantidade de pausas detectadas
  longestPause: number;        // Duração em ms da maior pausa
  fillerWordsCount: number;    // "uhm", "ahh", hesitações
  speechContinuity: number;    // 0-100 (% do tempo falando)
  pitchStability: number;      // 0-100 (estabilidade de frequência)
  recordingDurationMs: number; // Duração total da gravação
}

export interface ForensicsSession {
  getMetrics: () => VoiceMetrics;
  stop: () => void;
}

export interface MycroftAnalysis {
  // Scores
  stressScore: number;
  combinedScore: number;
  
  // Zone
  zone: 'truth' | 'attention' | 'bluff';
  scenarioId: number;
  confidence: 'low' | 'medium' | 'high';
  
  // Métricas vocais
  vocalJitter: number;
  vocalShimmer: number;
  silentPeriods: number;
  longestPauseMs: number;
  fillerWordsCount: number;
  speechContinuity: number;
  pitchStability: number;
  
  // Métricas faciais (placeholder)
  microExpressions: string[];
  gazeDeviation: string;
  facialTension: number;
  
  // Contexto
  wasCorrect: boolean;
  playerAnswer: string;
  correctAnswer: string;
  recordingDurationMs: number;
  
  // Reasoning
  reasoning: string;
}
