// Jury Claude Service - Client-side wrapper for Claude Jury Edge Function
// Calls server-side Edge Function to keep API key secure

import { supabase } from '@/integrations/supabase/client';

// ===========================
// TYPES & INTERFACES
// ===========================

export type JurorProfile = "conservador" | "agressivo" | "neutro";
export type VoteDecision = "CLARO" | "BLEFE";

export interface JuryVoteRequest {
  question: string;
  playerAnswer: string;
  correctAnswer: string;
  transcription: string;
  mycroftAnalysis: {
    stressScore: number;
    microExpressions: string[];
    gazeDeviation: string;
    vocalHesitation: number;
    confidenceTone: string;
    vocalJitter: number;
    facialTension: number;
    combinedScore: number;
  };
}

export interface JuryVote {
  juror: string;
  profile: JurorProfile;
  vote: VoteDecision;
  confidence: number;
  reasoning: string;
  processingTimeMs?: number;
}

export interface JuryVerdict {
  votes: JuryVote[];
  convicted: boolean;
  unanimous: boolean;
  totalProcessingTimeMs: number;
  costEstimate: number;
}

// ===========================
// MAIN API FUNCTIONS
// ===========================

/**
 * Get votes from all 3 AI jurors via Edge Function
 * This is the main function to call from your game logic
 */
export async function getJuryVerdict(
  request: JuryVoteRequest
): Promise<JuryVerdict> {
  console.log('[JuryService] Requesting AI jury verdict...');
  
  try {
    const { data, error } = await supabase.functions.invoke('claude-jury', {
      body: {
        type: 'verdict',
        request,
      },
    });
    
    if (error) {
      console.error('[JuryService] Edge function error:', error);
      throw new Error(error.message);
    }
    
    if (!data || !data.votes) {
      console.error('[JuryService] Invalid response:', data);
      throw new Error('Invalid verdict response');
    }
    
    console.log('[JuryService] Verdict received:', data.convicted ? 'CONVICTED' : 'CAUGHT');
    return data as JuryVerdict;
  } catch (error) {
    console.error('[JuryService] Error getting verdict:', error);
    // Return fallback verdict
    return generateFallbackVerdict();
  }
}

/**
 * Validate if the Claude API is properly configured
 */
export async function validateJuryApiKey(): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke('claude-jury', {
      body: { type: 'validate' },
    });
    
    if (error) {
      console.error('[JuryService] Validation error:', error);
      return false;
    }
    
    return data?.valid === true;
  } catch (error) {
    console.error('[JuryService] Validation failed:', error);
    return false;
  }
}

/**
 * Generate fallback verdict when API is unavailable
 */
export function generateFallbackVerdict(): JuryVerdict {
  const votes: JuryVote[] = [
    {
      juror: 'O Prudente',
      profile: 'conservador',
      vote: Math.random() > 0.5 ? 'CLARO' : 'BLEFE',
      confidence: 50,
      reasoning: 'Sistema indisponível - voto aleatório',
    },
    {
      juror: 'O Tubarão',
      profile: 'agressivo',
      vote: Math.random() > 0.5 ? 'CLARO' : 'BLEFE',
      confidence: 50,
      reasoning: 'Sistema indisponível - voto aleatório',
    },
    {
      juror: 'O Quant',
      profile: 'neutro',
      vote: Math.random() > 0.5 ? 'CLARO' : 'BLEFE',
      confidence: 50,
      reasoning: 'Sistema indisponível - voto aleatório',
    },
  ];
  
  const claroCount = votes.filter(v => v.vote === 'CLARO').length;
  
  return {
    votes,
    convicted: claroCount >= 2,
    unanimous: claroCount === 0 || claroCount === 3,
    totalProcessingTimeMs: 0,
    costEstimate: 0,
  };
}
