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
    const { match_id, market, sport = "soccer" } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const oddsApiKey = Deno.env.get("THE_ODDS_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Mode 1: Scan specific match across bookmakers
    if (match_id) {
      // Load stored odds
      const { data: storedOdds } = await supabase
        .from("arena_odds")
        .select("*")
        .eq("match_id", match_id)
        .order("created_at", { ascending: false });

      if (!storedOdds || storedOdds.length === 0) {
        return new Response(JSON.stringify({
          success: true,
          scan: { match_id, opportunities: [], message: "No odds data available" },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by market
      const byMarket: Record<string, any[]> = {};
      for (const o of storedOdds) {
        if (!byMarket[o.market]) byMarket[o.market] = [];
        byMarket[o.market].push(o);
      }

      const opportunities: any[] = [];

      for (const [mkt, odds] of Object.entries(byMarket)) {
        if (market && mkt !== market) continue;
        if (odds.length < 2) continue;

        // Find best and worst odds
        const sorted = odds
          .filter(o => o.odd_current != null)
          .sort((a, b) => (b.odd_current || 0) - (a.odd_current || 0));

        if (sorted.length < 2) continue;

        const best = sorted[0];
        const worst = sorted[sorted.length - 1];
        const spread = ((best.odd_current - worst.odd_current) / worst.odd_current) * 100;
        const avgOdd = sorted.reduce((s: number, o: any) => s + o.odd_current, 0) / sorted.length;

        // Detect value: best odd significantly above average
        const valuePct = ((best.odd_current - avgOdd) / avgOdd) * 100;

        if (spread > 3) {
          opportunities.push({
            market: mkt,
            best_bookmaker: best.bookmaker,
            best_odd: best.odd_current,
            worst_bookmaker: worst.bookmaker,
            worst_odd: worst.odd_current,
            average_odd: Math.round(avgOdd * 100) / 100,
            spread_pct: Math.round(spread * 100) / 100,
            value_pct: Math.round(valuePct * 100) / 100,
            bookmaker_count: sorted.length,
            all_odds: sorted.map(o => ({
              bookmaker: o.bookmaker,
              odd: o.odd_current,
              movement: o.movement_pct,
            })),
            signal: spread > 10 ? "strong_value" : spread > 5 ? "moderate_value" : "light_value",
          });
        }
      }

      // Sort by spread (biggest opportunities first)
      opportunities.sort((a, b) => b.spread_pct - a.spread_pct);

      return new Response(JSON.stringify({
        success: true,
        scan: {
          match_id,
          total_markets: Object.keys(byMarket).length,
          opportunities,
          best_value: opportunities[0] || null,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mode 2: Scan all available matches for cross-bookmaker value
    // Fetch from The Odds API if key available
    if (oddsApiKey) {
      const sportKey = sport === "soccer" ? "soccer_epl" : sport;
      const apiUrl = `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${oddsApiKey}&regions=eu&markets=h2h,totals&oddsFormat=decimal`;

      const apiResponse = await fetch(apiUrl);
      if (!apiResponse.ok) {
        throw new Error(`Odds API error: ${apiResponse.status}`);
      }

      const apiData = await apiResponse.json();
      const scanResults: any[] = [];

      for (const event of apiData) {
        const bookmakerOdds: Record<string, any[]> = {};

        for (const bm of event.bookmakers || []) {
          for (const mkt of bm.markets || []) {
            for (const outcome of mkt.outcomes || []) {
              const key = `${mkt.key}_${outcome.name}`;
              if (!bookmakerOdds[key]) bookmakerOdds[key] = [];
              bookmakerOdds[key].push({
                bookmaker: bm.title,
                odd: outcome.price,
              });
            }
          }
        }

        for (const [mktKey, odds] of Object.entries(bookmakerOdds)) {
          if (odds.length < 3) continue;

          const sorted = odds.sort((a: any, b: any) => b.odd - a.odd);
          const best = sorted[0];
          const worst = sorted[sorted.length - 1];
          const avgOdd = odds.reduce((s: number, o: any) => s + o.odd, 0) / odds.length;
          const spread = ((best.odd - worst.odd) / worst.odd) * 100;

          if (spread > 5) {
            scanResults.push({
              event_id: event.id,
              home: event.home_team,
              away: event.away_team,
              commence_time: event.commence_time,
              market: mktKey,
              best_bookmaker: best.bookmaker,
              best_odd: best.odd,
              average_odd: Math.round(avgOdd * 100) / 100,
              spread_pct: Math.round(spread * 100) / 100,
              bookmaker_count: odds.length,
            });
          }
        }

        // Store odds in arena_odds for future CLV calculation
        for (const bm of event.bookmakers || []) {
          for (const mkt of bm.markets || []) {
            for (const outcome of mkt.outcomes || []) {
              try {
                await supabase.from("arena_odds").upsert({
                  match_id: event.id,
                  bookmaker: bm.title,
                  market: `${mkt.key}_${outcome.name}`,
                  odd_current: outcome.price,
                  timestamp_current: new Date().toISOString(),
                }, {
                  onConflict: "match_id,bookmaker,market",
                });
              } catch (_) {}
            }
          }
        }
      }

      scanResults.sort((a, b) => b.spread_pct - a.spread_pct);

      return new Response(JSON.stringify({
        success: true,
        scan: {
          total_events: apiData.length,
          opportunities: scanResults.slice(0, 20),
          total_opportunities: scanResults.length,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: "Provide match_id or configure THE_ODDS_API_KEY for live scanning",
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Smart Odds Scanner error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
