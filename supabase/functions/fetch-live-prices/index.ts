import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// CoinGecko free API for BTC
// BR stocks: use Brapi (free tier) for PETR4, VALE3, ITUB4
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const prices: Record<string, { price: number; change24h: number; source: string }> = {};

    // Fetch BTC from Binance (real-time, no key needed)
    try {
      // Get BTC/BRL price from Binance
      const btcRes = await fetch(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCBRL",
        { headers: { "Accept": "application/json" } }
      );
      if (btcRes.ok) {
        const btcData = await btcRes.json();
        const currentPrice = parseFloat(btcData.lastPrice) || 0;
        const priceChange = parseFloat(btcData.priceChangePercent) || 0;
        prices["BTC"] = {
          price: currentPrice,
          change24h: priceChange,
          source: "binance",
        };
      } else {
        // Fallback to CoinGecko if Binance fails
        const cgRes = await fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl&include_24hr_change=true",
          { headers: { "Accept": "application/json" } }
        );
        if (cgRes.ok) {
          const cgData = await cgRes.json();
          prices["BTC"] = {
            price: cgData.bitcoin?.brl || 0,
            change24h: cgData.bitcoin?.brl_24h_change || 0,
            source: "coingecko",
          };
        }
      }
    } catch (e) {
      console.error("Binance/BTC error:", e);
    }

    // Fetch BR stocks from Brapi (free tier)
    const brStocks = ["PETR4", "VALE3", "ITUB4"];
    try {
      const stocksQuery = brStocks.join(",");
      const stockRes = await fetch(
        `https://brapi.dev/api/quote/${stocksQuery}`,
        { headers: { "Accept": "application/json" } }
      );
      if (stockRes.ok) {
        const stockData = await stockRes.json();
        if (stockData.results) {
          for (const result of stockData.results) {
            prices[result.symbol] = {
              price: result.regularMarketPrice || 0,
              change24h: result.regularMarketChangePercent || 0,
              source: "brapi",
            };
          }
        }
      }
    } catch (e) {
      console.error("Brapi error:", e);
    }

    // Fetch Mini Contracts (WIN/WDO) via Brapi dynamic ticker
    // Brapi accepts tickers like WINFUT, WDOFUT for the most liquid contract
    try {
      const futuresRes = await fetch(
        `https://brapi.dev/api/quote/WINFUT,WDOFUT`,
        { headers: { "Accept": "application/json" } }
      );
      if (futuresRes.ok) {
        const futData = await futuresRes.json();
        if (futData.results) {
          for (const result of futData.results) {
            const sym = result.symbol?.startsWith("WIN") ? "WIN" : result.symbol?.startsWith("WDO") ? "WDO" : null;
            if (sym) {
              prices[sym] = {
                price: result.regularMarketPrice || 0,
                change24h: result.regularMarketChangePercent || 0,
                source: "brapi-futures",
              };
            }
          }
        }
      }
    } catch (e) {
      console.error("Brapi futures error:", e);
    }

    return new Response(JSON.stringify({ prices, timestamp: Date.now() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Fetch prices error:", error);
    return new Response(JSON.stringify({ prices: {}, timestamp: Date.now(), error: "Failed to fetch prices" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
