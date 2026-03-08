import { supabase } from "@/integrations/supabase/client";

export interface AssetScoreInput {
  match_id: string;
  market: string;
  probability_model: number;
  probability_market: number;
  odd: number;
  confidence?: number;
  league?: string;
}

export interface AssetScoreResult {
  match_id: string;
  market: string;
  asset_score: number;
  classification: "ELITE" | "PREMIUM" | "STRONG" | "SPECULATIVE" | "IGNORAR";
  components: {
    probability_score: number;
    market_edge_score: number;
    statistical_strength: number;
    pattern_confidence: number;
    liquidity_stability: number;
  };
  edge: number;
  ev: number;
  kelly_stake: number;
  kelly_quarter: number;
}

// Cache em memória para evitar chamadas repetidas
const scoreCache = new Map<string, { result: AssetScoreResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCacheKey(input: AssetScoreInput): string {
  return `${input.match_id}:${input.market}:${input.odd}`;
}

export async function calculateBettingAssetScore(
  input: AssetScoreInput
): Promise<AssetScoreResult | null> {
  const cacheKey = getCacheKey(input);
  const cached = scoreCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }

  try {
    const { data, error } = await supabase.functions.invoke("betting-asset-score", {
      body: input,
    });

    if (error) {
      console.error("[BAS] Error:", error);
      return null;
    }

    const result = data as AssetScoreResult;
    scoreCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  } catch (err) {
    console.error("[BAS] Exception:", err);
    return null;
  }
}

export async function calculateBatchAssetScores(
  inputs: AssetScoreInput[]
): Promise<AssetScoreResult[]> {
  // Check cache first
  const uncached: AssetScoreInput[] = [];
  const cachedResults: AssetScoreResult[] = [];

  for (const input of inputs) {
    const cacheKey = getCacheKey(input);
    const cached = scoreCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      cachedResults.push(cached.result);
    } else {
      uncached.push(input);
    }
  }

  if (uncached.length === 0) return cachedResults;

  try {
    const { data, error } = await supabase.functions.invoke("betting-asset-score", {
      body: { batch: uncached },
    });

    if (error) {
      console.error("[BAS] Batch error:", error);
      return cachedResults;
    }

    const newResults = (data as { results: AssetScoreResult[] }).results || [];

    // Cache new results
    for (const result of newResults) {
      const input = uncached.find(
        (i) => i.match_id === result.match_id && i.market === result.market
      );
      if (input) {
        scoreCache.set(getCacheKey(input), { result, timestamp: Date.now() });
      }
    }

    return [...cachedResults, ...newResults];
  } catch (err) {
    console.error("[BAS] Batch exception:", err);
    return cachedResults;
  }
}

export function getClassificationColor(classification: AssetScoreResult["classification"]): string {
  switch (classification) {
    case "ELITE": return "text-yellow-400";
    case "PREMIUM": return "text-emerald-400";
    case "STRONG": return "text-blue-400";
    case "SPECULATIVE": return "text-orange-400";
    case "IGNORAR": return "text-muted-foreground";
  }
}

export function getClassificationBadge(classification: AssetScoreResult["classification"]): string {
  switch (classification) {
    case "ELITE": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "PREMIUM": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "STRONG": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    case "SPECULATIVE": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "IGNORAR": return "bg-muted text-muted-foreground border-border";
  }
}
