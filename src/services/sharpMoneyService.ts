import { supabase } from '@/integrations/supabase/client';

export interface SharpSignalResult {
  match_id: string;
  market: string;
  has_rlm: boolean;
  has_steam: boolean;
  has_consensus: boolean;
  sharp_activity_score: number;
  avg_movement_pct: number;
  bookmakers_tracked: number;
  level: string;
}

export interface SharpMoneyResponse {
  ok: boolean;
  total_detected: number;
  steam_count: number;
  rlm_count: number;
  signals: SharpSignalResult[];
}

export async function runSharpMoneyDetector(matchIds?: string[]): Promise<SharpMoneyResponse> {
  const { data, error } = await supabase.functions.invoke('sharp-money-detector', {
    body: { match_ids: matchIds },
  });
  if (error) throw error;
  return data;
}
