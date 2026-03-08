import { supabase } from '@/integrations/supabase/client';

export interface MMDResult {
  match_id: string;
  market: string;
  mis: number;
  odi: number;
  inefficiency_level: string;
  prob_model: number;
  prob_market: number;
  bookmakers_analyzed: number;
  has_rlm: boolean;
  suspicious: boolean;
}

export interface MMDResponse {
  ok: boolean;
  total_analyzed: number;
  suspicious_count: number;
  results: MMDResult[];
}

export async function runMarketManipulationDetector(matchIds?: string[]): Promise<MMDResponse> {
  const { data, error } = await supabase.functions.invoke('market-manipulation-detector', {
    body: { match_ids: matchIds },
  });
  if (error) throw error;
  return data;
}
