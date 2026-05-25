import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Wallet, Target, Percent, BarChart3, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface Props {
  userId: string;
}

interface ImportedBet {
  id: string;
  stake: number;
  odd: number;
  profit_loss: number | null;
  result: string | null;
  bet_date: string | null;
  source: string;
  bookmaker: string | null;
  market: string;
}

export default function ImportedBetsAnalytics({ userId }: Props) {
  const [bets, setBets] = useState<ImportedBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBets();
  }, [userId]);

  const loadBets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('imported_bets')
      .select('id, stake, odd, profit_loss, result, bet_date, source, bookmaker, market')
      .eq('user_id', userId)
      .order('bet_date', { ascending: true });

    setBets((data as ImportedBet[]) || []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const settled = bets.filter(b => b.result === 'green' || b.result === 'red');
    const greens = settled.filter(b => b.result === 'green');
    const reds = settled.filter(b => b.result === 'red');
    const totalStaked = settled.reduce((s, b) => s + b.stake, 0);
    const totalPL = settled.reduce((s, b) => s + (b.profit_loss || 0), 0);
    const roi = totalStaked > 0 ? (totalPL / totalStaked) * 100 : 0;
    const winRate = settled.length > 0 ? (greens.length / settled.length) * 100 : 0;
    const avgOdd = settled.length > 0 ? settled.reduce((s, b) => s + b.odd, 0) / settled.length : 0;

    // Profit factor
    const grossProfit = greens.reduce((s, b) => s + (b.profit_loss || 0), 0);
    const grossLoss = Math.abs(reds.reduce((s, b) => s + (b.profit_loss || 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let worstStreak = 0;
    let currentLossStreak = 0;
    for (const b of settled) {
      if (b.result === 'green') {
        currentStreak++;
        currentLossStreak = 0;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentLossStreak++;
        currentStreak = 0;
        worstStreak = Math.max(worstStreak, currentLossStreak);
      }
    }

    return {
      total: bets.length,
      settled: settled.length,
      greens: greens.length,
      reds: reds.length,
      pending: bets.filter(b => b.result === 'pending').length,
      totalStaked,
      totalPL,
      roi,
      winRate,
      avgOdd,
      profitFactor,
      bestStreak,
      worstStreak,
    };
  }, [bets]);

  const chartData = useMemo(() => {
    const settled = bets.filter(b => b.result === 'green' || b.result === 'red');
    let cumulative = 0;
    return settled.map((b, i) => {
      cumulative += b.profit_loss || 0;
      return {
        index: i + 1,
        date: b.bet_date ? new Date(b.bet_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : `#${i + 1}`,
        pl: +(cumulative).toFixed(2),
      };
    });
  }, [bets]);

  const bookmakerBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; pl: number; staked: number; greens: number }>();
    bets.filter(b => b.result === 'green' || b.result === 'red').forEach(b => {
      const key = b.bookmaker || b.source || 'Desconhecido';
      const existing = map.get(key) || { count: 0, pl: 0, staked: 0, greens: 0 };
      existing.count++;
      existing.pl += b.profit_loss || 0;
      existing.staked += b.stake;
      existing.greens += b.result === 'green' ? 1 : 0;
      map.set(key, existing);
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      ...data,
      roi: data.staked > 0 ? (data.pl / data.staked) * 100 : 0,
      winRate: data.count > 0 ? (data.greens / data.count) * 100 : 0,
    }));
  }, [bets]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (bets.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-muted-foreground text-sm">Nenhuma entrada importada ainda.</p>
        <p className="text-muted-foreground text-xs">Importe via CSV/PDF ou sincronize com a Betfair.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Entradas', value: stats.total, icon: Target, color: 'text-primary' },
          { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: Percent, color: 'text-primary' },
          { label: 'P&L Total', value: `R$ ${stats.totalPL.toFixed(2)}`, icon: stats.totalPL >= 0 ? TrendingUp : TrendingDown, color: stats.totalPL >= 0 ? 'text-success' : 'text-destructive' },
          { label: 'ROI', value: `${stats.roi.toFixed(1)}%`, icon: Wallet, color: stats.roi >= 0 ? 'text-success' : 'text-destructive' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-lg p-3 space-y-1"
          >
            <div className="flex items-center gap-1.5">
              <kpi.icon className={cn("w-3.5 h-3.5", kpi.color)} />
              <span className="text-[10px] text-muted-foreground font-mono uppercase">{kpi.label}</span>
            </div>
            <p className={cn("text-lg font-mono font-bold", kpi.color)}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: 'Greens', value: stats.greens, color: 'text-success' },
          { label: 'Reds', value: stats.reds, color: 'text-destructive' },
          { label: 'Odd Média', value: stats.avgOdd.toFixed(2), color: 'text-foreground' },
          { label: 'Profit Factor', value: stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2), color: stats.profitFactor >= 1 ? 'text-success' : 'text-destructive' },
          { label: 'Melhor Streak', value: `${stats.bestStreak}W`, color: 'text-success' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.03 }}
            className="bg-card border border-border rounded-lg p-2.5 text-center"
          >
            <p className="text-[9px] text-muted-foreground font-mono uppercase">{s.label}</p>
            <p className={cn("text-sm font-mono font-bold", s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* P&L Evolution Chart */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-lg p-4"
        >
          <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase mb-3">
            Evolução P&L — Entradas Reais
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="plGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'P&L']}
              />
              <Area type="monotone" dataKey="pl" stroke="hsl(var(--primary))" fill="url(#plGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Bookmaker Breakdown */}
      {bookmakerBreakdown.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border rounded-lg p-4 space-y-3"
        >
          <h3 className="font-mono text-xs font-semibold text-muted-foreground uppercase">
            Performance por Casa
          </h3>
          <div className="space-y-2">
            {bookmakerBreakdown.map(b => (
              <div key={b.name} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-mono font-bold text-foreground">{b.name}</p>
                  <p className="text-[10px] text-muted-foreground">{b.count} entradas · WR {b.winRate.toFixed(0)}%</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-sm font-mono font-bold", b.pl >= 0 ? 'text-success' : 'text-destructive')}>
                    {b.pl >= 0 ? '+' : ''}R$ {b.pl.toFixed(2)}
                  </p>
                  <p className={cn("text-[10px] font-mono", b.roi >= 0 ? 'text-success' : 'text-destructive')}>
                    ROI {b.roi.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
