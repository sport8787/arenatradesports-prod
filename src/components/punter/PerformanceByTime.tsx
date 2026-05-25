import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Clock, TrendingUp, AlertTriangle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface PerformanceByTimeProps {
  userId: string;
}

interface TimeSlot {
  hour: number;
  winRate: number;
  total: number;
  profit: number;
}

interface DaySlot {
  day: number;
  label: string;
  winRate: number;
  total: number;
  profit: number;
}

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function PerformanceByTime({ userId }: PerformanceByTimeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['performance-by-time', userId],
    queryFn: async () => {
      const { data: bets } = await supabase
        .from('virtual_bets_punter')
        .select('created_at, status, profit_loss')
        .eq('user_id', userId)
        .in('status', ['green', 'red']);

      if (!bets || bets.length < 5) return null;

      const byHour: Record<number, { wins: number; total: number; profit: number }> = {};
      const byDay: Record<number, { wins: number; total: number; profit: number }> = {};

      for (const bet of bets) {
        const d = new Date(bet.created_at);
        const hour = d.getHours();
        const day = d.getDay();
        const profit = Number(bet.profit_loss) || 0;

        if (!byHour[hour]) byHour[hour] = { wins: 0, total: 0, profit: 0 };
        byHour[hour].total++;
        if (bet.status === 'green') byHour[hour].wins++;
        byHour[hour].profit += profit;

        if (!byDay[day]) byDay[day] = { wins: 0, total: 0, profit: 0 };
        byDay[day].total++;
        if (bet.status === 'green') byDay[day].wins++;
        byDay[day].profit += profit;
      }

      const hourSlots: TimeSlot[] = Object.entries(byHour)
        .map(([h, d]) => ({ hour: parseInt(h), winRate: (d.wins / d.total) * 100, total: d.total, profit: d.profit }))
        .filter(s => s.total >= 3)
        .sort((a, b) => b.winRate - a.winRate);

      const daySlots: DaySlot[] = Object.entries(byDay)
        .map(([d, data]) => ({ day: parseInt(d), label: DAY_LABELS[parseInt(d)], winRate: (data.wins / data.total) * 100, total: data.total, profit: data.profit }))
        .filter(s => s.total >= 2)
        .sort((a, b) => b.winRate - a.winRate);

      return { hourSlots, daySlots, totalBets: bets.length };
    },
    staleTime: 120_000,
  });

  if (isLoading || !data) return null;

  const bestHour = data.hourSlots[0];
  const worstHour = data.hourSlots[data.hourSlots.length - 1];
  const bestDay = data.daySlots[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg bg-card overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            PADRÕES TEMPORAIS
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">{data.totalBets} entradas analisadas</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Best hour */}
        {bestHour && (
          <div className="bg-success/5 border border-success/15 rounded-lg p-3 flex items-start gap-3">
            <TrendingUp className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-mono font-semibold text-success">Melhor Horário</p>
              <p className="text-[11px] font-mono text-foreground/80 mt-0.5">
                {bestHour.hour}h–{bestHour.hour + 1}h: {bestHour.winRate.toFixed(1)}% win rate ({bestHour.total} entradas)
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                💡 Priorize entradas nesse horário
              </p>
            </div>
          </div>
        )}

        {/* Worst hour */}
        {worstHour && worstHour.winRate < 45 && worstHour.hour !== bestHour?.hour && (
          <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-3 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-mono font-semibold text-destructive">Horário de Tilt</p>
              <p className="text-[11px] font-mono text-foreground/80 mt-0.5">
                {worstHour.hour}h–{worstHour.hour + 1}h: {worstHour.winRate.toFixed(1)}% win rate ({worstHour.total} entradas)
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                🛑 Considere evitar entradas nesse horário
              </p>
            </div>
          </div>
        )}

        {/* Day of week breakdown */}
        {data.daySlots.length > 0 && (
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2">POR DIA DA SEMANA</p>
            <div className="grid grid-cols-7 gap-1">
              {DAY_LABELS.map((label, i) => {
                const slot = data.daySlots.find(s => s.day === i);
                const wr = slot ? slot.winRate : 0;
                const hasData = slot && slot.total >= 2;
                return (
                  <div key={i} className="text-center">
                    <p className="text-[9px] font-mono text-muted-foreground mb-1">{label}</p>
                    <div className={cn(
                      "h-8 rounded flex items-end justify-center",
                      hasData ? 'bg-muted/30' : 'bg-muted/10'
                    )}>
                      {hasData && (
                        <div
                          className={cn(
                            "w-full rounded transition-all",
                            wr >= 55 ? 'bg-success/60' : wr >= 45 ? 'bg-warning/60' : 'bg-destructive/60'
                          )}
                          style={{ height: `${Math.max(15, wr)}%` }}
                        />
                      )}
                    </div>
                    <p className={cn(
                      "text-[9px] font-mono mt-0.5",
                      hasData ? (wr >= 55 ? 'text-success' : wr >= 45 ? 'text-warning' : 'text-destructive') : 'text-muted-foreground/30'
                    )}>
                      {hasData ? `${wr.toFixed(0)}%` : '—'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Best day insight */}
        {bestDay && (
          <p className="text-[10px] font-mono text-muted-foreground">
            📅 Melhor dia: <span className="text-foreground font-semibold">{bestDay.label}</span> ({bestDay.winRate.toFixed(0)}% WR, {bestDay.total} entradas)
          </p>
        )}
      </div>
    </motion.div>
  );
}
