import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AssetScoreInput {
  match_id: string;
  market: string;
  probability_model: number;
  probability_market: number;
  odd: number;
  confidence?: number;
  league?: string;
}

interface AssetScoreResult {
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

function calculateAssetScore(input: AssetScoreInput, patternData: any, marketData: any, sharpData: any): AssetScoreResult {
  const { probability_model, probability_market, odd, confidence } = input;

  // 1. Edge & EV
  const edge = probability_model - probability_market;
  const ev = (probability_model * odd) - 1;

  // 2. Kelly Criterion
  const b = odd - 1;
  const p = probability_model;
  const q = 1 - p;
  const kellyFull = b > 0 ? ((b * p - q) / b) : 0;
  const kellyQuarter = Math.max(0, kellyFull * 0.25);

  // ====== COMPONENTES DO ASSET SCORE ======

  // Componente 1: Probabilidade do Modelo (25%)
  // Score baseado na confiança do modelo na previsão
  let probabilityScore = 0;
  if (probability_model >= 0.70) probabilityScore = 95;
  else if (probability_model >= 0.60) probabilityScore = 80;
  else if (probability_model >= 0.50) probabilityScore = 65;
  else if (probability_model >= 0.40) probabilityScore = 45;
  else probabilityScore = 25;

  // Boost por confidence do Mycroft
  if (confidence && confidence > 80) probabilityScore = Math.min(100, probabilityScore + 10);

  // Componente 2: Market Edge / Value (25%)
  // Quão grande é o edge sobre o mercado
  let marketEdgeScore = 0;
  if (edge >= 0.15) marketEdgeScore = 100;
  else if (edge >= 0.10) marketEdgeScore = 85;
  else if (edge >= 0.07) marketEdgeScore = 70;
  else if (edge >= 0.05) marketEdgeScore = 55;
  else if (edge >= 0.03) marketEdgeScore = 40;
  else if (edge >= 0.01) marketEdgeScore = 25;
  else marketEdgeScore = 10;

  // Componente 3: Força Estatística (20%)
  // Baseado em market_analysis (MIS/ODI) e sharp money
  let statisticalStrength = 50; // baseline

  if (marketData) {
    const mis = marketData.market_inefficiency_score || 0;
    if (mis >= 0.10) statisticalStrength += 25;
    else if (mis >= 0.05) statisticalStrength += 15;
    else if (mis >= 0.02) statisticalStrength += 5;

    const odi = Math.abs(marketData.odds_drift_index || 0);
    if (odi >= 0.15) statisticalStrength += 10;
    else if (odi >= 0.08) statisticalStrength += 5;
  }

  if (sharpData) {
    const sas = sharpData.sharp_activity_score || 0;
    if (sas >= 40) statisticalStrength += 15;
    else if (sas >= 25) statisticalStrength += 10;
    else if (sas >= 10) statisticalStrength += 5;

    // Bonus por sinais específicos
    if (sharpData.has_rlm) statisticalStrength += 5;
    if (sharpData.has_steam) statisticalStrength += 5;
    if (sharpData.has_consensus) statisticalStrength += 5;
  }

  statisticalStrength = Math.min(100, statisticalStrength);

  // Componente 4: Confiança no Padrão (15%)
  // Baseado em arena_patterns
  let patternConfidence = 30; // baseline sem padrão

  if (patternData && patternData.is_profitable) {
    patternConfidence = patternData.confidence || 50;
    // Boost por sample size
    if (patternData.sample_size >= 500) patternConfidence = Math.min(100, patternConfidence + 15);
    else if (patternData.sample_size >= 300) patternConfidence = Math.min(100, patternConfidence + 10);
    else if (patternData.sample_size >= 100) patternConfidence = Math.min(100, patternConfidence + 5);

    // Boost por ROI positivo
    if (patternData.roi >= 15) patternConfidence = Math.min(100, patternConfidence + 10);
    else if (patternData.roi >= 8) patternConfidence = Math.min(100, patternConfidence + 5);
  }

  // Componente 5: Liquidez / Estabilidade (15%)
  // Baseado na odd (odds extremas = menos líquidas)
  let liquidityStability = 70; // baseline
  if (odd >= 1.30 && odd <= 3.50) liquidityStability = 90; // faixa mais líquida
  else if (odd >= 1.15 && odd <= 5.00) liquidityStability = 70;
  else if (odd >= 1.10 && odd <= 8.00) liquidityStability = 50;
  else liquidityStability = 30; // odds muito extremas

  // EV positivo boost
  if (ev > 0.10) liquidityStability = Math.min(100, liquidityStability + 10);

  // ====== CÁLCULO FINAL ======
  // Pesos: Prob 25% | Edge 25% | Stats 20% | Pattern 15% | Liquidity 15%
  const assetScore = Math.round(
    probabilityScore * 0.25 +
    marketEdgeScore * 0.25 +
    statisticalStrength * 0.20 +
    patternConfidence * 0.15 +
    liquidityStability * 0.15
  );

  // Classificação
  let classification: AssetScoreResult["classification"];
  if (assetScore >= 80) classification = "ELITE";
  else if (assetScore >= 70) classification = "PREMIUM";
  else if (assetScore >= 60) classification = "STRONG";
  else if (assetScore >= 50) classification = "SPECULATIVE";
  else classification = "IGNORAR";

  return {
    asset_score: Math.min(100, Math.max(0, assetScore)),
    classification,
    components: {
      probability_score: probabilityScore,
      market_edge_score: marketEdgeScore,
      statistical_strength: statisticalStrength,
      pattern_confidence: patternConfidence,
      liquidity_stability: liquidityStability,
    },
    edge: Math.round(edge * 10000) / 100, // em %
    ev: Math.round(ev * 10000) / 100, // em %
    kelly_stake: Math.round(kellyFull * 10000) / 100,
    kelly_quarter: Math.round(kellyQuarter * 10000) / 100,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: AssetScoreInput | { batch: AssetScoreInput[] } = await req.json();

    // Support single or batch
    const inputs = "batch" in body ? body.batch : [body];
    const results: (AssetScoreResult & { match_id: string; market: string })[] = [];

    for (const input of inputs) {
      const { match_id, market, league } = input;

      // Fetch pattern data
      const { data: patternData } = league
        ? await supabase
            .from("arena_patterns")
            .select("*")
            .eq("league", league)
            .eq("market", market)
            .eq("is_profitable", true)
            .maybeSingle()
        : { data: null };

      // Fetch market analysis
      const { data: marketData } = await supabase
        .from("market_analysis")
        .select("*")
        .eq("match_id", match_id)
        .eq("market", market)
        .order("analyzed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch sharp money signals
      const { data: sharpData } = await supabase
        .from("sharp_money_signals")
        .select("*")
        .eq("match_id", match_id)
        .eq("market", market)
        .order("detected_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const result = calculateAssetScore(input, patternData, marketData, sharpData);
      results.push({ ...result, match_id, market });
    }

    const response = "batch" in body ? { results } : results[0];

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in betting-asset-score:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
