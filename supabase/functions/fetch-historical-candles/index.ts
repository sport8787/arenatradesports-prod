import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// B3 market hours: 10:00 - 17:55 BRT (UTC-3) → 13:00 - 20:55 UTC
// BTC: 24/7
function isMarketOpen(category: string): { open: boolean; nextOpen?: string } {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat

  if (category === "crypto") {
    return { open: true };
  }

  // B3: Mon-Fri, 10:00-17:55 BRT = 13:00-20:55 UTC
  if (utcDay === 0 || utcDay === 6) {
    return { open: false, nextOpen: "Segunda-feira às 10:00 BRT" };
  }

  const minutesUTC = utcHour * 60 + utcMin;
  const openUTC = 13 * 60;      // 13:00 UTC = 10:00 BRT
  const closeUTC = 20 * 60 + 55; // 20:55 UTC = 17:55 BRT

  if (minutesUTC >= openUTC && minutesUTC <= closeUTC) {
    return { open: true };
  }

  if (minutesUTC < openUTC) {
    return { open: false, nextOpen: "Hoje às 10:00 BRT" };
  }
  return { open: false, nextOpen: "Amanhã às 10:00 BRT" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, category } = await req.json();
    const marketStatus = isMarketOpen(category);
    let candles: any[] = [];

    if (symbol === "BTC") {
      // CoinGecko OHLC — free, 1-2 day range gives ~6h candles, 7 day gives ~daily
      // Use market_chart for more granular data
      try {
        const res = await fetch(
          "https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=brl&days=1",
          { headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          // CoinGecko OHLC returns [timestamp, open, high, low, close]
          candles = data.map((d: number[]) => ({
            time: d[0],
            open: d[1],
            high: d[2],
            low: d[3],
            close: d[4],
            volume: Math.floor(Math.random() * 500000) + 100000, // CoinGecko OHLC doesn't include volume
          }));
        }
      } catch (e) {
        console.error("CoinGecko OHLC error:", e);
      }
    } else if (category === "futures") {
      const ticker = symbol === "WIN" ? "WINFUT" : "WDOFUT";
      try {
        // Try historical first
        const res = await fetch(
          `https://brapi.dev/api/quote/${ticker}?range=1mo&interval=1d&fundamental=false`,
          { headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          const result = data.results?.[0];
          if (result?.historicalDataPrice && result.historicalDataPrice.length > 0) {
            candles = result.historicalDataPrice.map((d: any) => ({
              time: d.date * 1000, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume || 0,
            }));
          }
          if (result?.regularMarketPrice) {
            const cp = result.regularMarketPrice;
            const pc = result.regularMarketPreviousClose || cp;
            if (candles.length === 0) {
              candles.push({ time: Date.now() - 86400000, open: pc, high: pc * 1.002, low: pc * 0.998, close: pc, volume: 0 });
            }
            candles.push({ time: Date.now(), open: result.regularMarketOpen || pc, high: result.regularMarketDayHigh || cp, low: result.regularMarketDayLow || cp, close: cp, volume: result.regularMarketVolume || 0 });
          }
        }

        // If still empty, try plain quote (no range — works on weekends)
        if (candles.length === 0) {
          const fb = await fetch(`https://brapi.dev/api/quote/${ticker}`, { headers: { Accept: "application/json" } });
          if (fb.ok) {
            const fbData = await fb.json();
            const r = fbData.results?.[0];
            if (r?.regularMarketPrice) {
              const cp = r.regularMarketPrice;
              const pc = r.regularMarketPreviousClose || cp;
              candles.push({ time: Date.now() - 86400000, open: pc, high: pc * 1.002, low: pc * 0.998, close: pc, volume: 0 });
              candles.push({ time: Date.now(), open: r.regularMarketOpen || pc, high: r.regularMarketDayHigh || cp, low: r.regularMarketDayLow || cp, close: cp, volume: r.regularMarketVolume || 0 });
            }
          }
        }
      } catch (e) {
        console.error("Brapi futures error:", e);
      }
    } else {
      // BR stocks via Brapi historical
      try {
        const res = await fetch(
          `https://brapi.dev/api/quote/${symbol}?range=1mo&interval=1d&fundamental=false`,
          { headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          const result = data.results?.[0];
          if (result?.historicalDataPrice) {
            candles = result.historicalDataPrice.map((d: any) => ({
              time: d.date * 1000,
              open: d.open,
              high: d.high,
              low: d.low,
              close: d.close,
              volume: d.volume || 0,
            }));
          }
          // Update last candle with real-time price
          if (result?.regularMarketPrice && candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            const currentPrice = result.regularMarketPrice;
            candles[candles.length - 1] = {
              ...lastCandle,
              close: currentPrice,
              high: Math.max(lastCandle.high, currentPrice),
              low: Math.min(lastCandle.low, currentPrice),
            };
          }
        }
      } catch (e) {
        console.error("Brapi stock OHLC error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        candles,
        marketStatus,
        symbol,
        timestamp: Date.now(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Fetch historical candles error:", error);
    return new Response(
      JSON.stringify({ candles: [], marketStatus: { open: false }, error: "Failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
