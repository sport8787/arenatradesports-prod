import { useQuery } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { BarChart3, Trophy, Flame, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface DailySummaryWidgetProps {
  userId: string;
}

interface DaySummary {
  horus: { total: number; wins: number; losses: number; profit: number };
  manual: { total: number; wins: number; losses: number; profit: number };
  bestBet: { match: string; profit: number } | null;
  bestMarket: { name: string; profit: number } | null;
}

export default function DailySummaryWidget({ userId }: DailySummaryWidgetProps) {
  // Compute summary from actual bets (real-time, no stored table needed initially)
  const { data: summary, isLoading } = useQuery({
    queryKey: ['daily-summary-live', userId],
    queryFn: async (): Promise<DaySummary | null> => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [horusRes, manualRes] = await Promise.all([
        supabase
          .from('virtual_bets_punter')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', todayStart.toISOString()),
        supabase
          .from('virtual_bets_manual')
          .select('*')
          .eq('user_id', userId)
          .gte('created_at', todayStart.toISOString()),
      ]);

      const horusBets = horusRes.data || [];
      const manualBets = manualRes.data || [];

      if (horusBets.length === 0 && manualBets.length === 0) return null;

      const toNum = (v: any) => Number(v) || 0;

      const calcStats = (bets: any[]) => ({
        total: bets.length,
        wins: bets.filter(b => b.status === 'green' || b.result === 'green').length,
        losses: bets.filter(b => b.status === 'red' || b.result === 'red').length,
        profit: bets.reduce((sum, b) => sum + toNum(b.profit_loss), 0),
      });

      const allBets = [...horusBets, ...manualBets];
      const settledBets = allBets.filter(b => b.status === 'green' || b.status === 'red');

      // Best bet
      const bestBet = settledBets
        .filter(b => toNum(b.profit_loss) > 0)
        .sort((a, b) => toNum(b.profit_loss) - toNum(a.profit_loss))[0];

      // Best market
      const marketMap: Record<string, { profit: number }> = {};
      for (const bet of settledBets) {
        const m = bet.market || 'Outros';
        if (!marketMap[m]) marketMap[m] = { profit: 0 };
        marketMap[m].profit += toNum(bet.profit_loss);
      }
      const bestMarketEntry = Object.entries(marketMap)
        .sort((a, b) => b[1].profit - a[1].profit)[0];

      return {
        horus: calcStats(horusBets),
        manual: calcStats(manualBets),
        bestBet: bestBet
          ? { match: bestBet.match_name || bestBet.match_id, profit: toNum(bestBet.profit_loss) }
          : null,
        bestMarket: bestMarketEntry && bestMarketEntry[1].profit > 0
          ? { name: bestMarketEntry[0], profit: bestMarketEntry[1].profit }
          : null,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (isLoading || !summary) return null;

  const totalProfit = summary.horus.profit + summary.manual.profit;
  const totalBets = summary.horus.total + summary.manual.total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg bg-card overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            RESUMO DE HOJE
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">{totalBets} operações</span>
          <span className={cn(
            "font-mono text-xs font-bold",
            totalProfit >= 0 ? 'text-success' : 'text-destructive'
          )}>
            {totalProfit >= 0 ? '+' : ''}R$ {totalProfit.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Hórus */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Bot className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] font-mono text-muted-foreground">HÓRUS</span>
          </div>
          <p className="text-xs font-mono text-foreground">
            {summary.horus.wins}W / {summary.horus.losses}L
            {summary.horus.total - summary.horus.wins - summary.horus.losses > 0 && (
              <span className="text-muted-foreground ml-1">
                ({summary.horus.total - summary.horus.wins - summary.horus.losses} pend.)
              </span>
            )}
          </p>
          <p className={cn(
            "font-mono text-lg font-bold mt-0.5",
            summary.horus.profit >= 0 ? 'text-success' : 'text-destructive'
          )}>
            {summary.horus.profit >= 0 ? '+' : ''}R$ {Math.abs(summary.horus.profit).toFixed(2)}
          </p>
        </div>

        {/* Manual */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] font-mono text-muted-foreground">MANUAL</span>
          </div>
          <p className="text-xs font-mono text-foreground">
            {summary.manual.wins}W / {summary.manual.losses}L
            {summary.manual.total - summary.manual.wins - summary.manual.losses > 0 && (
              <span className="text-muted-foreground ml-1">
                ({summary.manual.total - summary.manual.wins - summary.manual.losses} pend.)
              </span>
            )}
          </p>
          <p className={cn(
            "font-mono text-lg font-bold mt-0.5",
            summary.manual.profit >= 0 ? 'text-success' : 'text-destructive'
          )}>
            {summary.manual.profit >= 0 ? '+' : ''}R$ {Math.abs(summary.manual.profit).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Highlights */}
      {(summary.bestBet || summary.bestMarket) && (
        <div className="px-3 pb-3 grid grid-cols-2 gap-2">
          {summary.bestBet && (
            <div className="bg-success/5 border border-success/15 rounded p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Trophy className="w-3 h-3 text-success" />
                <span className="text-[9px] font-mono text-muted-foreground">MELHOR APOSTA</span>
              </div>
              <p className="text-[10px] font-mono text-foreground truncate">{summary.bestBet.match}</p>
              <p className="text-xs font-mono font-bold text-success">
                +R$ {summary.bestBet.profit.toFixed(2)}
              </p>
            </div>
          )}
          {summary.bestMarket && (
            <div className="bg-warning/5 border border-warning/15 rounded p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Flame className="w-3 h-3 text-warning" />
                <span className="text-[9px] font-mono text-muted-foreground">MERCADO DESTAQUE</span>
              </div>
              <p className="text-[10px] font-mono text-foreground truncate">{summary.bestMarket.name}</p>
              <p className="text-xs font-mono font-bold text-warning">
                +R$ {summary.bestMarket.profit.toFixed(2)}
              </p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
