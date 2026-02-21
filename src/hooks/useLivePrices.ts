import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LivePrice {
  price: number;
  change24h: number;
  source: string;
  lastUpdated: number;
}

export interface LivePrices {
  [symbol: string]: LivePrice;
}

export function useLivePrices(pollIntervalMs = 60000) {
  const [prices, setPrices] = useState<LivePrices>({});
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchPrices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-live-prices');
      if (error) throw error;

      if (data?.prices && Object.keys(data.prices).length > 0) {
        // Track previous prices for color change
        setPreviousPrices(prev => {
          const newPrev: Record<string, number> = { ...prev };
          Object.entries(prices).forEach(([sym, p]) => {
            newPrev[sym] = (p as LivePrice).price;
          });
          return newPrev;
        });

        const livePrices: LivePrices = {};
        for (const [symbol, info] of Object.entries(data.prices)) {
          const p = info as any;
          livePrices[symbol] = {
            price: p.price,
            change24h: p.change24h,
            source: p.source,
            lastUpdated: data.timestamp,
          };
        }
        setPrices(livePrices);
        setIsLive(true);
      }
    } catch (e) {
      console.error('[LivePrices] Fetch error:', e);
      setIsLive(false);
    } finally {
      setLoading(false);
    }
  }, [prices]);

  useEffect(() => {
    fetchPrices();
    intervalRef.current = setInterval(fetchPrices, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollIntervalMs]);

  const getPriceDirection = useCallback((symbol: string): 'up' | 'down' | 'neutral' => {
    const current = prices[symbol]?.price;
    const previous = previousPrices[symbol];
    if (!current || !previous) return 'neutral';
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  }, [prices, previousPrices]);

  return { prices, isLive, loading, getPriceDirection, refetch: fetchPrices };
}
