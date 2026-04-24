import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Clock, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Stats {
  greens: number;
  reds: number;
  pending: number;
  total: number;
  pnl: number;
  loading: boolean;
}

interface Props {
  /** quando true, ativa o filtro "Apenas hoje" na lista pai */
  todayFilterActive: boolean;
  onToggleFilter: () => void;
}

/**
 * Card no topo da Arena Punter mostrando Greens/Reds/Pending do dia
 * (apenas sinais Hórus de hoje — punter_signals criados com created_at::date = today).
 * Inclui um botão "Apenas hoje" que ativa um filtro visual na lista de sinais.
 */
export default function TodayResultsCard({ todayFilterActive, onToggleFilter }: Props) {
  const [stats, setStats] = useState<Stats>({
    greens: 0, reds: 0, pending: 0, total: 0, pnl: 0, loading: true,
  });

  const load = async () => {
    setStats(s => ({ ...s, loading: true }));
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('punter_signals')
      .select('result, profit_loss, stake_amount, odd')
      .gte('created_at', startOfDay.toISOString());

    if (error || !data) {
      setStats(s => ({ ...s, loading: false }));
      return;
    }

    let greens = 0, reds = 0, pending = 0, pnl = 0;
    for (const row of data as Array<{ result: string | null; profit_loss: number | null }>) {
      if (row.result === 'green') { greens++; pnl += Number(row.profit_loss ?? 0); }
      else if (row.result === 'red') { reds++; pnl += Number(row.profit_loss ?? 0); }
      else pending++;
    }
    setStats({ greens, reds, pending, total: data.length, pnl, loading: false });
  };

  useEffect(() => {
    load();
    // realtime: atualiza quando algum signal de hoje muda
    const channel = supabase
      .channel('punter_signals_today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'punter_signals' }, () => load())
      .subscribe();
    const interval = setInterval(load, 60_000); // refresh a cada 1 min
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  const winRate = stats.greens + stats.reds > 0
    ? Math.round((stats.greens / (stats.greens + stats.reds)) * 100)
    : 0;

  const pnlColor = stats.pnl > 0 ? 'text-success' : stats.pnl < 0 ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          RESULTADOS DE HOJE
        </span>
        <Button
          size="sm"
          variant={todayFilterActive ? 'default' : 'outline'}
          onClick={onToggleFilter}
          className="h-7 text-[10px] gap-1"
          aria-pressed={todayFilterActive}
        >
          <Filter className="w-3 h-3" />
          {todayFilterActive ? 'Filtro: Apenas hoje' : 'Filtrar apenas hoje'}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-border">
        <div className="px-4 py-3 flex flex-col items-start gap-1">
          <div className="flex items-center gap-1 text-[10px] font-mono text-success/80 uppercase tracking-wider">
            <CheckCircle2 className="w-3 h-3" /> Greens
          </div>
          <span className="font-mono text-xl font-bold text-success">
            {stats.loading ? '—' : stats.greens}
          </span>
        </div>

        <div className="px-4 py-3 flex flex-col items-start gap-1">
          <div className="flex items-center gap-1 text-[10px] font-mono text-destructive/80 uppercase tracking-wider">
            <XCircle className="w-3 h-3" /> Reds
          </div>
          <span className="font-mono text-xl font-bold text-destructive">
            {stats.loading ? '—' : stats.reds}
          </span>
        </div>

        <div className="px-4 py-3 flex flex-col items-start gap-1">
          <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <Clock className="w-3 h-3" /> Pendentes
          </div>
          <span className="font-mono text-xl font-bold text-foreground">
            {stats.loading ? '—' : stats.pending}
          </span>
        </div>

        <div className="px-4 py-3 flex flex-col items-start gap-1">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Acerto</div>
          <span className="font-mono text-xl font-bold text-foreground">
            {stats.loading ? '—' : `${winRate}%`}
          </span>
        </div>

        <div className="px-4 py-3 flex flex-col items-start gap-1 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            <TrendingUp className="w-3 h-3" /> PnL Hoje
          </div>
          <span className={`font-mono text-xl font-bold ${pnlColor}`}>
            {stats.loading ? '—' : `${stats.pnl >= 0 ? '+' : ''}R$ ${stats.pnl.toFixed(2)}`}
          </span>
        </div>
      </div>
    </div>
  );
}
