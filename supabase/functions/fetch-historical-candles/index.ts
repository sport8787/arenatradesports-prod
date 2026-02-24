import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// B3 market hours: 10:00 - 17:55 BRT (UTC-3) → 13:00 - 20:55 UTC
function isMarketOpen(category: string): { open: boolean; nextOpen?: string } {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const utcDay = now.getUTCDay();

  if (category === "crypto") {
    return { open: true };
  }

  if (utcDay === 0 || utcDay === 6) {
    return { open: false, nextOpen: "Segunda-feira às 10:00 BRT" };
  }

  const minutesUTC = utcHour * 60 + utcMin;
  const openUTC = 13 * 60;
  const closeUTC = 20 * 60 + 55;

  if (minutesUTC >= openUTC && minutesUTC <= closeUTC) {
    return { open: true };
  }

  if (minutesUTC < openUTC) {
    return { open: false, nextOpen: "Hoje às 10:00 BRT" };
  }
  return { open: false, nextOpen: "Amanhã às 10:00 BRT" };
}

// Map timeframe to CoinGecko days parameter and expected candle interval
function getCoingeckoParams(timeframe: string): { days: string; expectedIntervalMs: number } {
  switch (timeframe) {
    case '5m':
      // CoinGecko free tier: days=1 gives ~30min candles. For 5m we need Binance klines.
      return { days: '1', expectedIntervalMs: 5 * 60 * 1000 };
    case '15m':
      return { days: '1', expectedIntervalMs: 15 * 60 * 1000 };
    case '30m':
      return { days: '1', expectedIntervalMs: 30 * 60 * 1000 };
    case '1h':
      return { days: '7', expectedIntervalMs: 60 * 60 * 1000 };
    default:
      return { days: '1', expectedIntervalMs: 30 * 60 * 1000 };
  }
}

// Map timeframe to Binance kline interval string
function getBinanceInterval(timeframe: string): string {
  switch (timeframe) {
    case '5m': return '5m';
    case '15m': return '15m';
    case '30m': return '30m';
    case '1h': return '1h';
    default: return '30m';
  }
}

// Map timeframe to Brapi range/interval
function getBrapiParams(timeframe: string): { range: string; interval: string } {
  switch (timeframe) {
    case '5m':
      return { range: '5d', interval: '15m' }; // Brapi min is 15m
    case '15m':
      return { range: '5d', interval: '15m' };
    case '30m':
      return { range: '1mo', interval: '1d' }; // Brapi doesn't support 30m, use daily
    case '1h':
      return { range: '1mo', interval: '1d' };
    default:
      return { range: '1mo', interval: '1d' };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, category, timeframe = '30m' } = await req.json();
    const marketStatus = isMarketOpen(category);
    let candles: any[] = [];

    if (symbol === "BTC") {
      // Use Binance klines API for all BTC timeframes — real OHLCV data
      const binanceInterval = getBinanceInterval(timeframe);
      const limit = timeframe === '5m' ? 100 : timeframe === '15m' ? 80 : timeframe === '1h' ? 48 : 48;
      
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCBRL&interval=${binanceInterval}&limit=${limit}`,
          { headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          // Binance klines: [openTime, open, high, low, close, volume, closeTime, ...]
          candles = data.map((d: any[]) => ({
            time: d[0],
            open: parseFloat(d[1]),
            high: parseFloat(d[2]),
            low: parseFloat(d[3]),
            close: parseFloat(d[4]),
            volume: parseFloat(d[5]),
          }));
        }
      } catch (e) {
        console.error("Binance klines error:", e);
      }

      // Fallback to CoinGecko if Binance fails
      if (candles.length === 0) {
        try {
          const { days } = getCoingeckoParams(timeframe);
          const res = await fetch(
            `https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=brl&days=${days}`,
            { headers: { Accept: "application/json" } }
          );
          if (res.ok) {
            const data = await res.json();
            candles = data.map((d: number[]) => ({
              time: d[0],
              open: d[1],
              high: d[2],
              low: d[3],
              close: d[4],
              volume: Math.floor(Math.random() * 500000) + 100000,
            }));
          }
        } catch (e) {
          console.error("CoinGecko OHLC fallback error:", e);
        }
      }
    } else if (category === "futures") {
      const BRAPI_TOKEN = Deno.env.get("BRAPI_TOKEN") || "";
      
      // WIN tracks Ibovespa (^BVSP) 1:1. WDO tracks USD/BRL × 1000.
      const ticker = symbol === "WIN" ? "%5EBVSP" : "USDBRL=X";
      const isWDO = symbol === "WDO";
      
      console.log(`Futures candles proxy ticker: ${ticker} for ${symbol}`);
      const { range, interval } = getBrapiParams(timeframe);
      try {
        const res = await fetch(
          `https://brapi.dev/api/quote/${ticker}?range=${range}&interval=${interval}&fundamental=false&token=${BRAPI_TOKEN}`,
          { headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          const result = data.results?.[0];
          if (result?.historicalDataPrice && result.historicalDataPrice.length > 0) {
            candles = result.historicalDataPrice
              .filter((d: any) => d.close > 0 && d.open > 0) // Filter out zero-value candles
              .map((d: any) => ({
              time: d.date * 1000,
              open: isWDO ? Math.round(d.open * 1000 * 100) / 100 : Math.round(d.open),
              high: isWDO ? Math.round(d.high * 1000 * 100) / 100 : Math.round(d.high),
              low: isWDO ? Math.round(d.low * 1000 * 100) / 100 : Math.round(d.low),
              close: isWDO ? Math.round(d.close * 1000 * 100) / 100 : Math.round(d.close),
              volume: d.volume || 0,
            }));
          }
          if (result?.regularMarketPrice) {
            const cp = isWDO ? Math.round(result.regularMarketPrice * 1000 * 100) / 100 : Math.round(result.regularMarketPrice);
            const pc = result.regularMarketPreviousClose 
              ? (isWDO ? Math.round(result.regularMarketPreviousClose * 1000 * 100) / 100 : Math.round(result.regularMarketPreviousClose))
              : cp;
            if (candles.length === 0) {
              candles.push({ time: Date.now() - 86400000, open: pc, high: pc * 1.002, low: pc * 0.998, close: pc, volume: 0 });
            }
            const openP = result.regularMarketOpen 
              ? (isWDO ? Math.round(result.regularMarketOpen * 1000 * 100) / 100 : Math.round(result.regularMarketOpen))
              : pc;
            const highP = result.regularMarketDayHigh
              ? (isWDO ? Math.round(result.regularMarketDayHigh * 1000 * 100) / 100 : Math.round(result.regularMarketDayHigh))
              : cp;
            const lowP = result.regularMarketDayLow
              ? (isWDO ? Math.round(result.regularMarketDayLow * 1000 * 100) / 100 : Math.round(result.regularMarketDayLow))
              : cp;
            candles.push({ time: Date.now(), open: openP, high: highP, low: lowP, close: cp, volume: result.regularMarketVolume || 0 });
          }
        } else {
          console.error("Brapi proxy candles status:", res.status, await res.text());
        }
      } catch (e) {
        console.error("Brapi futures proxy error:", e);
      }
    } else {
      // BR stocks via Brapi
      const BRAPI_TOKEN = Deno.env.get("BRAPI_TOKEN") || "";
      const { range, interval } = getBrapiParams(timeframe);
      try {
        const res = await fetch(
          `https://brapi.dev/api/quote/${symbol}?range=${range}&interval=${interval}&fundamental=false&token=${BRAPI_TOKEN}`,
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
        timeframe,
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
