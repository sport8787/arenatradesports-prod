import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Question } from '@/types/game';

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

  // Generate verdict using AI with actual question context
  const generateVerdict = useCallback(async (
    question: Question,
    userResponse: 'A' | 'B' | 'C' | 'D'
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
      // Call the AI edge function for fact-checked verdict
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
        },
      });
      
      if (error) {
        console.error('Error generating AI verdict:', error);
        throw error;
      }
      
      const aiVerdict = data?.verdict || '';
      
      // Validate the verdict contains relevant keywords
      const userKeyword = userResponseText.split(' ')[0]?.toLowerCase() || '';
      const correctKeyword = correctAnswerText.split(' ')[0]?.toLowerCase() || '';
      const verdictLower = aiVerdict.toLowerCase();
      
      const isValid = 
        verdictLower.includes(userKeyword) || 
        verdictLower.includes(correctKeyword) ||
        verdictLower.includes('protocolo') ||
        verdictLower.includes(isCorrect ? 'corret' : 'incorret');
      
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
        protocolCode
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
        protocolCode
      );
      
      const analysis: string[] = [];
      if (!isCorrect) {
        analysis.push(`Erro factual: respondeu "${userResponseText}" quando a correta era "${correctAnswerText}".`);
      } else {
        analysis.push('Resposta correta confirmada.');
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

// Generate a fallback verdict based strictly on actual game data
function generateFallbackVerdict(
  question: Question,
  userResponseText: string,
  correctAnswerText: string,
  isCorrect: boolean,
  metrics: VerdictMetrics,
  protocolCode: string
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
  
  return `${protocolCode} ${timeAnalysis} ${factCheck} ${bluffHistory}`.trim();
}