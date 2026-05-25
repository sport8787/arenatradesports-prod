import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Clock, TrendingUp, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

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
 * para o usuário logado. Usa virtual_bets_punter (entradas reais do Hórus,
 * incluindo as pendentes geradas pelo auto-bet global).
 *
 * PnL: soma APENAS profit_loss de bets concluídas (status green/red).
 * Pendentes contam como 0 para não distorcer o total.
 */
export default function TodayResultsCard({ todayFilterActive, onToggleFilter }: Props) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    greens: 0, reds: 0, pending: 0, total: 0, pnl: 0, loading: true,
  });

  const load = async () => {
    if (!user) {
      setStats({ greens: 0, reds: 0, pending: 0, total: 0, pnl: 0, loading: false });
      return;
    }
    setStats(s => ({ ...s, loading: true }));
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('virtual_bets_punter')
      .select('status, profit_loss')
      .eq('user_id', user.id)
      .gte('created_at', startOfDay.toISOString());

    if (error || !data) {
      setStats(s => ({ ...s, loading: false }));
      return;
    }

    let greens = 0, reds = 0, pending = 0, pnl = 0;
    for (const row of data as Array<{ status: string | null; profit_loss: number | null }>) {
      if (row.status === 'green') {
        greens++;
        pnl += Number(row.profit_loss ?? 0);
      } else if (row.status === 'red') {
        reds++;
        pnl += Number(row.profit_loss ?? 0);
      } else {
        // pending, cancelled, etc — não soma no PnL
        pending++;
      }
    }
    setStats({ greens, reds, pending, total: data.length, pnl, loading: false });
  };

  useEffect(() => {
    load();
    if (!user) return;
    // realtime: atualiza quando alguma bet do usuário muda
    const channel = supabase
      .channel(`virtual_bets_punter_today_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'virtual_bets_punter', filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    const interval = setInterval(load, 60_000); // refresh a cada 1 min
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
