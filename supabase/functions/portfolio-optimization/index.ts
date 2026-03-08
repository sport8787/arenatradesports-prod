import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, active_bets, bankroll } = await req.json();
    if (!user_id) throw new Error("Missing user_id");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Load correlation matrix
    const { data: correlations } = await supabase
      .from("bet_correlations")
      .select("*")
      .gte("sample_size", 20);

    const corrMap = new Map<string, number>();
    if (correlations) {
      for (const c of correlations) {
        corrMap.set(`${c.market_a}|${c.market_b}`, c.correlation_coefficient ?? 0);
        corrMap.set(`${c.market_b}|${c.market_a}`, c.correlation_coefficient ?? 0);
      }
    }

    // 2. Load active/pending bets
    let bets = active_bets || [];
    if (bets.length === 0) {
      const { data: pendingBets } = await supabase
        .from("bets_history")
        .select("*")
        .eq("user_id", user_id)
        .is("result", null)
        .order("created_at", { ascending: false })
        .limit(20);
      bets = pendingBets || [];
    }

    if (bets.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        portfolio: { total_exposure: 0, risk_level: "none", adjustments: [] },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Calculate portfolio risk
    const totalStake = bets.reduce((s: number, b: any) => s + (b.stake || 0), 0);
    const bankrollAmount = bankroll || 1000;
    const exposurePct = (totalStake / bankrollAmount) * 100;

    // 4. Detect correlated bets and adjust stakes
    const adjustments: any[] = [];
    const processedPairs = new Set<string>();

    for (let i = 0; i < bets.length; i++) {
      for (let j = i + 1; j < bets.length; j++) {
        const betA = bets[i];
        const betB = bets[j];
        const pairKey = `${betA.id}|${betB.id}`;
        if (processedPairs.has(pairKey)) continue;
        processedPairs.add(pairKey);

        // Check market correlation
        const corr = corrMap.get(`${betA.market}|${betB.market}`) ?? 0;
        
        // Check if same match (highly correlated)
        const sameMatch = betA.match_id === betB.match_id;
        const effectiveCorr = sameMatch ? Math.max(corr, 0.7) : corr;

        if (effectiveCorr > 0.4) {
          // High correlation — reduce stake on lower-scored bet
          const weakerBet = (betA.asset_score || 0) < (betB.asset_score || 0) ? betA : betB;
          const reductionFactor = Math.min(0.5, effectiveCorr * 0.6);
          
          adjustments.push({
            bet_id: weakerBet.id,
            match_id: weakerBet.match_id,
            market: weakerBet.market,
            original_stake: weakerBet.stake,
            adjusted_stake: Math.round(weakerBet.stake * (1 - reductionFactor) * 100) / 100,
            reduction_pct: Math.round(reductionFactor * 100),
            reason: sameMatch 
              ? `Same match correlation with ${betA.id === weakerBet.id ? betB.market : betA.market}`
              : `Market correlation (${Math.round(effectiveCorr * 100)}%) with ${betA.id === weakerBet.id ? betB.market : betA.market}`,
            correlated_with: betA.id === weakerBet.id ? betB.id : betA.id,
            correlation: effectiveCorr,
          });
        }
      }
    }

    // 5. Portfolio-level risk assessment
    let riskLevel: string;
    let riskScore: number;
    const uniqueMatches = new Set(bets.map((b: any) => b.match_id)).size;
    const uniqueLeagues = new Set(bets.map((b: any) => b.league).filter(Boolean)).size;
    const diversificationScore = Math.min(100, (uniqueMatches / Math.max(1, bets.length)) * 50 + (uniqueLeagues / Math.max(1, bets.length)) * 50);

    if (exposurePct > 30 || adjustments.length > 3) {
      riskLevel = "high";
      riskScore = Math.min(100, exposurePct + adjustments.length * 10);
    } else if (exposurePct > 15 || adjustments.length > 1) {
      riskLevel = "medium";
      riskScore = exposurePct + adjustments.length * 5;
    } else {
      riskLevel = "low";
      riskScore = exposurePct;
    }

    // 6. Max exposure guard
    const maxExposurePct = 25;
    let globalReduction = 0;
    if (exposurePct > maxExposurePct) {
      globalReduction = Math.round(((exposurePct - maxExposurePct) / exposurePct) * 100);
    }

    return new Response(JSON.stringify({
      success: true,
      portfolio: {
        total_bets: bets.length,
        total_stake: totalStake,
        exposure_pct: Math.round(exposurePct * 100) / 100,
        risk_level: riskLevel,
        risk_score: Math.round(riskScore),
        diversification_score: Math.round(diversificationScore),
        unique_matches: uniqueMatches,
        unique_leagues: uniqueLeagues,
        global_reduction_pct: globalReduction,
        adjustments,
        recommendations: generateRecommendations(riskLevel, exposurePct, diversificationScore, adjustments.length),
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Portfolio Optimization error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateRecommendations(
  riskLevel: string, 
  exposure: number, 
  diversification: number, 
  correlatedPairs: number
): string[] {
  const recs: string[] = [];
  
  if (exposure > 25) {
    recs.push(`⚠️ Exposição total (${exposure.toFixed(1)}%) acima do limite seguro de 25%. Reduza stakes.`);
  }
  if (correlatedPairs > 0) {
    recs.push(`🔗 ${correlatedPairs} par(es) de apostas correlacionadas detectados. Stakes ajustados automaticamente.`);
  }
  if (diversification < 40) {
    recs.push(`📊 Diversificação baixa (${diversification.toFixed(0)}%). Distribua apostas em mais partidas/ligas.`);
  }
  if (riskLevel === "high") {
    recs.push("🛡️ Risco alto no portfólio. Considere reduzir número de apostas simultâneas.");
  }
  if (recs.length === 0) {
    recs.push("✅ Portfólio equilibrado. Exposição e diversificação dentro dos parâmetros.");
  }
  
  return recs;
}
