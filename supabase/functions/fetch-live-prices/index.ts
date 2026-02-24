import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BRAPI_TOKEN = Deno.env.get("BRAPI_TOKEN") || "";
    const prices: Record<string, { price: number; change24h: number; source: string }> = {};

    // Fetch BTC from Binance (real-time, no key needed)
    try {
      const btcRes = await fetch(
        "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCBRL",
        { headers: { "Accept": "application/json" } }
      );
      if (btcRes.ok) {
        const btcData = await btcRes.json();
        prices["BTC"] = {
          price: parseFloat(btcData.lastPrice) || 0,
          change24h: parseFloat(btcData.priceChangePercent) || 0,
          source: "binance",
        };
      }
    } catch (e) {
      console.error("Binance/BTC error:", e);
    }

    // Fetch BR stocks + Ibovespa index from Brapi (for WIN proxy)
    const brStocks = ["PETR4", "VALE3", "ITUB4"];
    try {
      const stocksQuery = brStocks.join(",");
      const stockRes = await fetch(
        `https://brapi.dev/api/quote/${stocksQuery}?token=${BRAPI_TOKEN}`,
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
      console.error("Brapi stocks error:", e);
    }

    // Fetch WIN (Mini Índice) via Ibovespa index from Brapi
    // WIN tracks the Ibovespa index 1:1 in points
    try {
      const ibovRes = await fetch(
        `https://brapi.dev/api/quote/%5EBVSP?token=${BRAPI_TOKEN}`,
        { headers: { "Accept": "application/json" } }
      );
      if (ibovRes.ok) {
        const ibovData = await ibovRes.json();
        const result = ibovData.results?.[0];
        if (result?.regularMarketPrice) {
          prices["WIN"] = {
            price: Math.round(result.regularMarketPrice),
            change24h: result.regularMarketChangePercent || 0,
            source: "brapi-ibov",
          };
          console.log(`WIN (via IBOV): ${result.regularMarketPrice}`);
        }
      } else {
        console.error("Brapi IBOV status:", ibovRes.status);
      }
    } catch (e) {
      console.error("Brapi IBOV error:", e);
    }

    // Fetch WDO (Mini Dólar) via USD-BRL exchange rate
    // WDO price ≈ USD/BRL × 1000
    try {
      const usdRes = await fetch(
        `https://brapi.dev/api/quote/USDBRL=X?token=${BRAPI_TOKEN}`,
        { headers: { "Accept": "application/json" } }
      );
      if (usdRes.ok) {
        const usdData = await usdRes.json();
        const result = usdData.results?.[0];
        if (result?.regularMarketPrice) {
          prices["WDO"] = {
            price: Math.round(result.regularMarketPrice * 1000 * 100) / 100,
            change24h: result.regularMarketChangePercent || 0,
            source: "brapi-usdbrl",
          };
          console.log(`WDO (via USD/BRL): ${result.regularMarketPrice} → ${prices["WDO"].price}`);
        }
      } else {
        console.error("Brapi USD/BRL status:", usdRes.status);
      }
    } catch (e) {
      console.error("Brapi USD/BRL error:", e);
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
