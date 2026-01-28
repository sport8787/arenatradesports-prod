import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Question } from '@/types/game';
import { VoiceMetrics } from '@/services/audioForensicsService';

export interface VerdictMetrics {
  responseTimeMs: number;
  successfulBluffs: number;
  caughtBluffs: number;
  totalRounds: number;
  audioRecordingDuration?: number;
}

export interface QuestionContext {
  question: Question;
  userResponse: string; // The option letter the user chose (A, B, C, D)
  userResponseText: string; // The actual text of the option chosen
  correctAnswerText: string; // The actual text of the correct answer
}

export interface VerdictReport {
  protocolCode: string;
  metrics: VerdictMetrics;
  analysis: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendation: string;
  fullVerdict: string;
  questionContext?: QuestionContext;
  charCount?: number;
  withinLimit?: boolean;
}

// Generate random protocol code
const generateProtocolCode = (): string => {
  const codes = ['402', '503', '101', '707', '999', '314', '227'];
  const code = codes[Math.floor(Math.random() * codes.length)];
  return `Protocolo de Análise ${code} concluído.`;
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

// Get answer text from question
const getAnswerText = (question: Question, option: 'A' | 'B' | 'C' | 'D'): string => {
  switch (option) {
    case 'A': return question.option_a;
    case 'B': return question.option_b;
    case 'C': return question.option_c;
    case 'D': return question.option_d;
    default: return '';
  }
};

export function useMycroftVerdict() {
  const [metrics, setMetrics] = useState<VerdictMetrics>({
    responseTimeMs: 0,
    successfulBluffs: 0,
    caughtBluffs: 0,
    totalRounds: 0,
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
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

  // Generate verdict with ACTUAL voiceMetrics
  const generateVerdict = useCallback(async (
    question: Question,
    userResponse: 'A' | 'B' | 'C' | 'D',
    voiceMetrics?: VoiceMetrics
  ): Promise<VerdictReport> => {
    setIsGenerating(true);
    
    const userResponseText = getAnswerText(question, userResponse);
    const correctAnswerText = getAnswerText(question, question.correct_option);
    const isCorrect = userResponse === question.correct_option;
    
    const questionContext: QuestionContext = {
      question,
      userResponse,
      userResponseText,
      correctAnswerText,
    };
    
    const protocolCode = generateProtocolCode();
    const riskLevel = calculateRiskLevel(metrics);
    
    try {
      // Now passes voiceMetrics to edge function
      const { data, error } = await supabase.functions.invoke('mycroft-ai', {
        body: {
          type: 'verdict',
          questionText: question.question_text,
          correctAnswer: correctAnswerText,
          userResponse: userResponseText,
          metrics: {
            responseTimeMs: metrics.responseTimeMs,
            successfulBluffs: metrics.successfulBluffs,
            caughtBluffs: metrics.caughtBluffs,
          },
          // Pass complete voice forensics data
          voiceMetrics: voiceMetrics ? {
            responseLatencyMs: voiceMetrics.responseLatencyMs,
            pitchStability: voiceMetrics.pitchStability,
            speechRateBPM: voiceMetrics.speechRateBPM,
            avgPitch: voiceMetrics.avgPitch,
            pitchVariance: voiceMetrics.pitchVariance,
            jitter: voiceMetrics.jitter,
            shimmer: voiceMetrics.shimmer,
            harmonicsToNoise: voiceMetrics.harmonicsToNoise,
            recordingDurationMs: voiceMetrics.recordingDurationMs,
          } : undefined,
        },
      });
      
      if (error) {
        console.error('Error generating AI verdict:', error);
        throw error;
      }
      
      const aiVerdict = data?.verdict || '';
      const charCount = data?.charCount;
      const withinLimit = data?.withinLimit;
      
      // Log if we received forensic data in the verdict
      if (voiceMetrics) {
        console.log('✅ VoiceMetrics sent to edge function:', {
          latency: voiceMetrics.responseLatencyMs,
          jitter: voiceMetrics.jitter,
          shimmer: voiceMetrics.shimmer,
          pitch: voiceMetrics.avgPitch,
        });
      }
      
      // Validate the verdict contains relevant keywords
      const userKeyword = userResponseText.split(' ')[0]?.toLowerCase() || '';
      const correctKeyword = correctAnswerText.split(' ')[0]?.toLowerCase() || '';
      const verdictLower = aiVerdict.toLowerCase();
      
      const isValid = 
        verdictLower.includes(userKeyword) || 
        verdictLower.includes(correctKeyword) ||
        verdictLower.includes('protocolo') ||
        verdictLower.includes(isCorrect ? 'corret' : 'incorret') ||
        verdictLower.includes('latência') || // Check for forensic terms
        verdictLower.includes('jitter') ||
        verdictLower.includes('pitch');
      
      if (!isValid && aiVerdict) {
        console.warn('AI verdict failed validation, using fallback');
      }
      
      // Use AI verdict if valid, otherwise generate fallback
      const finalVerdict = (isValid && aiVerdict) ? aiVerdict : generateFallbackVerdict(
        question,
        userResponseText,
        correctAnswerText,
        isCorrect,
        metrics,
        protocolCode,
        voiceMetrics
      );
      
      // Parse analysis from verdict
      const analysis: string[] = [];
      if (metrics.responseTimeMs > 10000) {
        analysis.push('Sobrecarga Cognitiva detectada.');
      }
      if (metrics.successfulBluffs >= 3) {
        analysis.push(`${metrics.successfulBluffs} blefes bem-sucedidos registrados.`);
      }
      if (metrics.caughtBluffs >= 2) {
        analysis.push(`Jogador flagrado ${metrics.caughtBluffs} vezes.`);
      }
      if (!isCorrect) {
        analysis.push(`Erro factual: respondeu "${userResponseText}" quando a correta era "${correctAnswerText}".`);
      } else {
        analysis.push('Resposta correta confirmada.');
      }
      
      // Add voice metrics to analysis if available
      if (voiceMetrics) {
        if (voiceMetrics.jitter && voiceMetrics.jitter > 1.5) {
          analysis.push(`Jitter vocal elevado: ${voiceMetrics.jitter.toFixed(2)}%.`);
        }
        if (voiceMetrics.pitchStability === 'unstable') {
          analysis.push('Instabilidade vocal detectada.');
        }
      }
      
      const recommendation = isCorrect 
        ? 'Veracidade técnica validada. Nenhuma anomalia crítica detectada.'
        : 'Erro registrado. Credibilidade em análise.';
      
      setIsGenerating(false);
      
      return {
        protocolCode,
        metrics,
        analysis,
        riskLevel,
        recommendation,
        fullVerdict: finalVerdict,
        questionContext,
        charCount,
        withinLimit,
      };
    } catch (error) {
      console.error('Failed to generate AI verdict, using fallback:', error);
      setIsGenerating(false);
      
      // Fallback verdict based on actual data
      const fallbackVerdict = generateFallbackVerdict(
        question,
        userResponseText,
        correctAnswerText,
        isCorrect,
        metrics,
        protocolCode,
        voiceMetrics
      );
      
      const analysis: string[] = [];
      if (!isCorrect) {
        analysis.push(`Erro factual: respondeu "${userResponseText}" quando a correta era "${correctAnswerText}".`);
      } else {
        analysis.push('Resposta correta confirmada.');
      }
      
      // Add voice metrics to analysis if available
      if (voiceMetrics) {
        if (voiceMetrics.jitter && voiceMetrics.jitter > 1.5) {
          analysis.push(`Jitter vocal elevado: ${voiceMetrics.jitter.toFixed(2)}%.`);
        }
        if (voiceMetrics.responseLatencyMs && voiceMetrics.responseLatencyMs < 1500) {
          analysis.push(`Resposta muito rápida: ${voiceMetrics.responseLatencyMs}ms.`);
        }
      }
      
      return {
        protocolCode,
        metrics,
        analysis,
        riskLevel,
        recommendation: isCorrect ? 'Veracidade confirmada.' : 'Erro registrado.',
        fullVerdict: fallbackVerdict,
        questionContext,
      };
    }
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
    isGenerating,
    startResponseTimer,
    stopResponseTimer,
    recordBluffResult,
    recordAudioDuration,
    generateVerdict,
    resetMetrics,
  };
}

// Generate a fallback verdict with voice forensics data
function generateFallbackVerdict(
  question: Question,
  userResponseText: string,
  correctAnswerText: string,
  isCorrect: boolean,
  metrics: VerdictMetrics,
  protocolCode: string,
  voiceMetrics?: VoiceMetrics
): string {
  const timeAnalysis = metrics.responseTimeMs > 10000 
    ? 'Sobrecarga Cognitiva detectada.' 
    : metrics.responseTimeMs < 2000 
      ? 'Resposta impulsiva registrada.' 
      : 'Tempo de resposta normal.';
  
  const factCheck = isCorrect
    ? `Resposta "${userResponseText}" está tecnicamente correta. Veracidade validada.`
    : `Erro factual detectado. Jogador respondeu "${userResponseText}", mas a resposta correta era "${correctAnswerText}".`;
  
  const bluffHistory = metrics.successfulBluffs > 0 || metrics.caughtBluffs > 0
    ? `Histórico: ${metrics.successfulBluffs} blefes bem-sucedidos, ${metrics.caughtBluffs} flagras.`
    : '';
  
  // Add voice forensics data if available
  let voiceAnalysis = '';
  if (voiceMetrics) {
    const forensicData: string[] = [];
    
    if (voiceMetrics.responseLatencyMs !== undefined) {
      forensicData.push(`Latência: ${voiceMetrics.responseLatencyMs}ms`);
    }
    
    if (voiceMetrics.jitter !== undefined) {
      forensicData.push(`Jitter: ${voiceMetrics.jitter.toFixed(2)}%`);
    }
    
    if (voiceMetrics.pitchStability) {
      const stabilityLabel = voiceMetrics.pitchStability === 'stable' ? 'estável' : 
                             voiceMetrics.pitchStability === 'micro-tremors' ? 'micro-tremores' : 'instável';
      forensicData.push(`Pitch: ${stabilityLabel}`);
    }
    
    if (voiceMetrics.speechRateBPM !== undefined) {
      forensicData.push(`Velocidade: ${voiceMetrics.speechRateBPM} wpm`);
    }
    
    if (forensicData.length > 0) {
      voiceAnalysis = `Análise Forense: ${forensicData.join(', ')}.`;
    }
  }
  
  return `${protocolCode} ${timeAnalysis} ${factCheck} ${voiceAnalysis} ${bluffHistory}`.trim();
}
