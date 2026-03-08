import { supabase } from "@/integrations/supabase/client";

export interface OddsOpportunity {
  market: string;
  best_bookmaker: string;
  best_odd: number;
  worst_bookmaker?: string;
  worst_odd?: number;
  average_odd: number;
  spread_pct: number;
  value_pct?: number;
  bookmaker_count: number;
  signal?: "strong_value" | "moderate_value" | "light_value";
  all_odds?: Array<{ bookmaker: string; odd: number; movement?: number }>;
}

export interface ScanResult {
  match_id?: string;
  total_markets?: number;
  total_events?: number;
  total_opportunities?: number;
  opportunities: OddsOpportunity[];
  best_value?: OddsOpportunity | null;
}

export const smartOddsScannerService = {
  async scanMatch(matchId: string, market?: string): Promise<ScanResult> {
    const { data, error } = await supabase.functions.invoke("smart-odds-scanner", {
      body: { match_id: matchId, market },
    });
    if (error) throw error;
    return data.scan;
  },

  async scanLive(sport?: string): Promise<ScanResult> {
    const { data, error } = await supabase.functions.invoke("smart-odds-scanner", {
      body: { sport: sport || "soccer" },
    });
    if (error) throw error;
    return data.scan;
  },

  getSignalBadge(signal?: string): string {
    switch (signal) {
      case "strong_value": return "🔥 Valor Forte";
      case "moderate_value": return "✅ Valor Moderado";
      case "light_value": return "💡 Valor Leve";
      default: return "➖";
    }
  },

  getSignalColor(signal?: string): string {
    switch (signal) {
      case "strong_value": return "text-green-400";
      case "moderate_value": return "text-yellow-400";
      case "light_value": return "text-blue-400";
      default: return "text-muted-foreground";
    }
  },
};
