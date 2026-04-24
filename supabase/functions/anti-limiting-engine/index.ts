import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { startEdgeRun } from "../_shared/edgeRunLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Anti-Limiting Engine
 * 
 * Generates strategies to avoid bookmaker account restrictions:
 * 1. Bet Delay Randomization — optimal timing windows
 * 2. Stake Diversification — randomized stake sizes
 * 3. Market Diversification — spread across different markets
 * 4. Bookmaker Rotation — distribute bets across bookmakers
 * 5. Mug Betting — camouflage value bets with normal-looking activity
 */

interface AntiLimitInput {
  user_id?: string;
  original_stake: number;
  market: string;
  odd: number;
  bookmaker: string;
  asset_score?: number;
  // Recent activity
  recent_bets_count_24h?: number;
  recent_bets_same_bookmaker?: number;
  recent_avg_stake?: number;
  // Preferences
  bookmakers_available?: string[];
  max_delay_minutes?: number;
}

interface DelayStrategy {
  min_delay_seconds: number;
  max_delay_seconds: number;
  recommended_delay_seconds: number;
  reason: string;
}

interface StakeStrategy {
  original_stake: number;
  adjusted_stake: number;
  noise_range: [number, number]; // min/max of randomized stake
  round_to: number; // e.g., round to nearest 5 or 10
  reason: string;
}

interface DiversificationStrategy {
  primary_bookmaker: string;
  alternative_bookmakers: string[];
  mug_bet_suggestion?: {
    market: string;
    type: string;
    reason: string;
  };
  bet_frequency_advice: string;
}

interface RiskProfile {
  limiting_risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  risk_score: number; // 0-100
  risk_factors: string[];
  recommendations: string[];
}

interface AntiLimitResult {
  delay: DelayStrategy;
  stake: StakeStrategy;
  diversification: DiversificationStrategy;
  risk_profile: RiskProfile;
  stealth_score: number; // 0-100, how "invisible" this bet looks
}

// Bookmaker intelligence profiles
const BOOKMAKER_PROFILES: Record<string, { strictness: number; stake_rounding: number; name: string }> = {
  bet365: { strictness: 80, stake_rounding: 5, name: "Bet365" },
  betfair: { strictness: 40, stake_rounding: 1, name: "Betfair" },
  pinnacle: { strictness: 10, stake_rounding: 1, name: "Pinnacle" },
  "1xbet": { strictness: 60, stake_rounding: 10, name: "1xBet" },
  betway: { strictness: 70, stake_rounding: 5, name: "Betway" },
  novibet: { strictness: 65, stake_rounding: 5, name: "Novibet" },
  sportingbet: { strictness: 75, stake_rounding: 5, name: "Sportingbet" },
  pixbet: { strictness: 50, stake_rounding: 1, name: "PixBet" },
  estrelabet: { strictness: 55, stake_rounding: 1, name: "EstrelaBet" },
};

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function roundTo(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const run = startEdgeRun("anti-limiting-engine");
  try {
    const input: AntiLimitInput = await req.json();
    const bookProfile = BOOKMAKER_PROFILES[input.bookmaker.toLowerCase()] || { strictness: 50, stake_rounding: 5, name: input.bookmaker };
    const maxDelay = (input.max_delay_minutes || 30) * 60;

    // ============ 1. DELAY STRATEGY ============
    const isHighValue = (input.asset_score || 0) > 75;
    const isSharpOdd = input.odd < 1.5 || input.odd > 4.0;
    
    // More delay for sharp bookmakers and high-value bets
    let baseDelay = bookProfile.strictness > 60 ? 120 : 30;
    if (isHighValue) baseDelay += 60;
    if (isSharpOdd) baseDelay += 30;

    const minDelay = Math.min(baseDelay, maxDelay);
    const maxDelayCalc = Math.min(baseDelay * 3, maxDelay);
    const recommendedDelay = Math.min(getRandomInt(minDelay, maxDelayCalc), maxDelay);

    const delay: DelayStrategy = {
      min_delay_seconds: minDelay,
      max_delay_seconds: maxDelayCalc,
      recommended_delay_seconds: recommendedDelay,
      reason: bookProfile.strictness > 60
        ? `${bookProfile.name} tem monitoramento ativo. Espere ${Math.round(recommendedDelay / 60)}min.`
        : `${bookProfile.name} é tolerante. Delay mínimo de ${Math.round(minDelay / 60)}min.`,
    };

    // ============ 2. STAKE STRATEGY ============
    const rounding = bookProfile.stake_rounding;
    const noise = input.original_stake * 0.15; // ±15% noise
    const noiseMin = roundTo(Math.max(1, input.original_stake - noise), rounding);
    const noiseMax = roundTo(input.original_stake + noise, rounding);
    const adjustedStake = roundTo(
      input.original_stake + (Math.random() - 0.5) * noise * 2,
      rounding
    );

    const stake: StakeStrategy = {
      original_stake: input.original_stake,
      adjusted_stake: Math.max(rounding, adjustedStake),
      noise_range: [noiseMin, noiseMax],
      round_to: rounding,
      reason: `Stake arredondado para múltiplos de R$${rounding} com variação ±15%`,
    };

    // ============ 3. DIVERSIFICATION ============
    const available = input.bookmakers_available || Object.keys(BOOKMAKER_PROFILES);
    const alternatives = available
      .filter(b => b.toLowerCase() !== input.bookmaker.toLowerCase())
      .sort((a, b) => {
        const pa = BOOKMAKER_PROFILES[a.toLowerCase()]?.strictness || 50;
        const pb = BOOKMAKER_PROFILES[b.toLowerCase()]?.strictness || 50;
        return pa - pb; // Prefer less strict
      })
      .slice(0, 3);

    // Mug bet suggestions
    const mugMarkets = ["1X2 Favorito", "Under 2.5 (jogo grande)", "Dupla Chance", "Empate/Favorito"];
    const mugBet = bookProfile.strictness > 60 ? {
      market: mugMarkets[getRandomInt(0, mugMarkets.length - 1)],
      type: "camouflage",
      reason: "Aposte em mercados populares intercalando com apostas de valor",
    } : undefined;

    const recentSameBook = input.recent_bets_same_bookmaker || 0;
    let freqAdvice = "Frequência normal";
    if (recentSameBook > 5) freqAdvice = "⚠️ Muitas apostas no mesmo book. Alterne para: " + alternatives.slice(0, 2).join(", ");
    else if (recentSameBook > 3) freqAdvice = "Considere alternar books nas próximas apostas";

    const diversification: DiversificationStrategy = {
      primary_bookmaker: input.bookmaker,
      alternative_bookmakers: alternatives,
      mug_bet_suggestion: mugBet,
      bet_frequency_advice: freqAdvice,
    };

    // ============ 4. RISK PROFILE ============
    const riskFactors: string[] = [];
    let riskScore = 0;

    // High-value bets attract attention
    if (isHighValue) { riskScore += 15; riskFactors.push("Aposta de alto valor (Asset Score > 75)"); }
    if (isSharpOdd) { riskScore += 10; riskFactors.push("Odd fora do padrão recreational"); }
    if (recentSameBook > 5) { riskScore += 20; riskFactors.push(`${recentSameBook} apostas recentes no mesmo book`); }
    if (input.original_stake > (input.recent_avg_stake || 50) * 2) { riskScore += 15; riskFactors.push("Stake muito acima da média"); }
    if (bookProfile.strictness > 70) { riskScore += 20; riskFactors.push(`${bookProfile.name} é um book restritivo`); }
    if ((input.recent_bets_count_24h || 0) > 10) { riskScore += 10; riskFactors.push("Volume alto de apostas nas últimas 24h"); }

    riskScore = Math.min(100, riskScore);
    const limitingRisk: RiskProfile["limiting_risk"] =
      riskScore >= 70 ? "CRITICAL" : riskScore >= 45 ? "HIGH" : riskScore >= 20 ? "MEDIUM" : "LOW";

    const recommendations: string[] = [];
    if (riskScore > 50) recommendations.push("Reduza a frequência de apostas neste book");
    if (riskScore > 30) recommendations.push("Intercale com mug bets em mercados populares");
    if (alternatives.length > 0) recommendations.push(`Alterne para: ${alternatives[0]}`);
    if (riskScore < 20) recommendations.push("Perfil de risco baixo. Continue operando normalmente.");

    const riskProfile: RiskProfile = { limiting_risk: limitingRisk, risk_score: riskScore, risk_factors: riskFactors, recommendations };

    // ============ 5. STEALTH SCORE ============
    const stealthScore = Math.max(0, Math.min(100, 100 - riskScore + (mugBet ? 10 : 0)));

    const result: AntiLimitResult = {
      delay,
      stake,
      diversification,
      risk_profile: riskProfile,
      stealth_score: stealthScore,
    };

    await run.success({ statusCode: 200, context: { bookmaker: input.bookmaker } });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Anti-limiting error:", err);
    const message = err instanceof Error ? err.message : String(err);
    await run.error(err, { statusCode: 500 });
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
