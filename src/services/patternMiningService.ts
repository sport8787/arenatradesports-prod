import { supabase } from "@/integrations/supabase/client";

export interface PatternData {
  league: string;
  market: string;
  wins: number;
  losses: number;
  sample_size: number;
  win_rate: number;
  roi: number;
  avg_odd: number;
  confidence: number;
  is_profitable: boolean;
  pattern_type: string;
}

export interface PatternMiningResult {
  patterns: PatternData[];
  total_patterns: number;
  total_bets_analyzed: number;
  profitable_patterns: number;
}

/**
 * Triggers the Pattern Mining Engine to recalculate all patterns
 */
export async function runPatternMining(userId?: string): Promise<PatternMiningResult> {
  const { data, error } = await supabase.functions.invoke("pattern-mining-engine", {
    body: { user_id: userId, min_sample: 30 },
  });

  if (error) throw error;
  return data as PatternMiningResult;
}

/**
 * Fetches cached patterns from arena_patterns table
 */
export async function getCachedPatterns(onlyProfitable = true): Promise<PatternData[]> {
  let query = supabase
    .from("arena_patterns")
    .select("*")
    .order("roi", { ascending: false });

  if (onlyProfitable) {
    query = query.eq("is_profitable", true);
  }

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return (data as unknown as PatternData[]) || [];
}

/**
 * Gets the pattern for a specific league + market
 */
export async function getPatternForBet(league: string, market: string): Promise<PatternData | null> {
  const { data } = await supabase
    .from("arena_patterns")
    .select("*")
    .eq("league", league)
    .eq("market", market)
    .maybeSingle();

  return (data as unknown as PatternData) || null;
}
