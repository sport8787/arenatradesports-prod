import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OddsComparatorProps {
  matchId?: string;
  homeTeam: string;
  awayTeam: string;
  market?: string;
}

interface BookmakerOdd {
  bookmaker: string;
  market: string;
  odd: number;
  movement?: 'up' | 'down' | 'stable';
}

export default function OddsComparator({ matchId, homeTeam, awayTeam, market }: OddsComparatorProps) {
  const [odds, setOdds] = useState<BookmakerOdd[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    fetchOdds();
    // FutOdds permite polling a cada 10s — Exchange real-time
    const id = setInterval(fetchOdds, 10_000);
    return () => clearInterval(id);
  }, [matchId, market]);

  const fetchOdds = async () => {
    setLoading(true);
    setError(null);
    try {
      // Betfair Exchange real
      const bfRow: BookmakerOdd[] = [];
      try {
        const { data: bfData } = await supabase.functions.invoke('futodds-live-odd', {
          body: { home: homeTeam, away: awayTeam, market: market || 'h2h' },
        });
        if (bfData?.odd && bfData.odd > 1.01) {
          bfRow.push({
            bookmaker: 'Betfair Exchange (LIVE)',
            market: market || 'h2h',
            odd: Number(bfData.odd),
            movement: 'stable',
          });
        }
      } catch { /* sem cobertura Betfair */ }

      // Try to get odds from cached_odds_games first
      const { data: cached } = await supabase
        .from('cached_odds_games')
        .select('bookmakers')
        .or(`home_team.ilike.%${homeTeam.slice(0, 8)}%,away_team.ilike.%${awayTeam.slice(0, 8)}%`)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached?.bookmakers) {
        const bks = cached.bookmakers as any[];
        const parsed: BookmakerOdd[] = [];
        for (const bk of bks) {
          const markets = bk.markets || [];
          for (const mkt of markets) {
            const outcomes = mkt.outcomes || [];
            for (const outcome of outcomes) {
              parsed.push({
                bookmaker: bk.title || bk.key || 'N/A',
                market: `${mkt.key}: ${outcome.name}`,
                odd: outcome.price,
                movement: 'stable',
              });
            }
          }
        }
        // Filter to the specific market if given, else show h2h
        const targetKey = market?.toLowerCase() || 'h2h';
        const filtered = parsed.filter(p => 
          p.market.toLowerCase().includes(targetKey) || 
          p.market.toLowerCase().includes('h2h')
        );
        const finalList = filtered.length > 0 ? filtered.slice(0, 15) : parsed.slice(0, 15);
        setOdds([...bfRow, ...finalList]);

      } else {
        // Fallback: check arena_odds table
        const { data: arenaOdds } = await supabase
          .from('arena_odds')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false })
          .limit(15);

        if (arenaOdds && arenaOdds.length > 0) {
          setOdds([...bfRow, ...arenaOdds.map(o => ({
            bookmaker: o.bookmaker,
            market: o.market,
            odd: o.odd_current ?? o.odd_open ?? 0,
            movement: (o.movement_pct
              ? o.movement_pct > 0 ? 'up' : o.movement_pct < 0 ? 'down' : 'stable'
              : 'stable') as 'up' | 'down' | 'stable',
          }))]);
        } else if (bfRow.length > 0) {
          setOdds(bfRow);
        } else {
          setError('Odds não disponíveis para este jogo');
        }
      }
    } catch (e) {
      setError('Erro ao buscar odds');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Buscando odds...
      </div>
    );
  }

  if (error || odds.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        {error || 'Odds não disponíveis'}
      </div>
    );
  }

  // Group by bookmaker
  const byBookmaker = new Map<string, BookmakerOdd[]>();
  odds.forEach(o => {
    const arr = byBookmaker.get(o.bookmaker) || [];
    arr.push(o);
    byBookmaker.set(o.bookmaker, arr);
  });

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-orbitron uppercase tracking-wider">
              <th className="px-2 py-1.5 text-left">Casa</th>
              <th className="px-2 py-1.5 text-left">Mercado</th>
              <th className="px-2 py-1.5 text-center">Odd</th>
              <th className="px-2 py-1.5 text-center">Mov.</th>
            </tr>
          </thead>
          <tbody>
            {odds.map((o, i) => {
              // Find best odd for this market across bookmakers
              const sameMarketOdds = odds.filter(x => x.market === o.market);
              const bestOdd = Math.max(...sameMarketOdds.map(x => x.odd));
              const isBest = o.odd === bestOdd && sameMarketOdds.length > 1;

              return (
                <tr key={i} className="border-b border-border/30 hover:bg-muted/20">
                  <td className="px-2 py-1.5 text-foreground font-medium">{o.bookmaker}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{o.market}</td>
                  <td className={cn('px-2 py-1.5 text-center font-orbitron font-bold', isBest ? 'text-[#4ADE80]' : 'text-foreground')}>
                    {o.odd.toFixed(2)}
                    {isBest && <span className="ml-1 text-[8px]">🏆</span>}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {o.movement === 'up' && <TrendingUp className="w-3 h-3 text-[#22C55E] inline" />}
                    {o.movement === 'down' && <TrendingDown className="w-3 h-3 text-[#EF4444] inline" />}
                    {o.movement === 'stable' && <Minus className="w-3 h-3 text-muted-foreground inline" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <a
        href="https://promos.betfair.bet.br/choose-your-refer-and-earn-offer?referrerCode=DWGLHVUTF"
        target="_blank"
        rel="noopener noreferrer sponsored"
        className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg bg-[#FFB80C] hover:bg-[#FFC93D] text-black font-orbitron font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_12px_rgba(255,184,12,0.25)]"
      >
        Apostar na Betfair →
      </a>
    </div>
  );
}
