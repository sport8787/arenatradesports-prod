import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Stats {
  signalsToday: number;
  roi24h: number | null;
  greens: number;
  reds: number;
  loading: boolean;
}

/**
 * Faixa compacta no /menu mostrando o pulso do dia:
 *  - Sinais Mycroft enviados hoje (Punter)
 *  - ROI 24h (sinais resolvidos nas últimas 24h)
 *  - Green/Red 24h
 *
 * Tudo derivado de punter_signals: nada de mock.
 */
export default function PunterMenuHeroStatus() {
  const [stats, setStats] = useState<Stats>({
    signalsToday: 0,
    roi24h: null,
    greens: 0,
    reds: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        // Sinais enviados hoje (qualquer status — aprovados/sent)
        const { count: countToday } = await supabase
          .from('punter_signals')
          .select('id', { count: 'exact', head: true })
          .gte('sent_at', today.toISOString())
          .eq('dismissed', false);

        // Resolvidos nas últimas 24h para ROI
        const { data: resolved } = await supabase
          .from('punter_signals')
          .select('result, profit_loss, stake_amount, odd')
          .gte('resulted_at', since24h)
          .in('result', ['green', 'red'])
          .eq('dismissed', false);

        let totalStake = 0;
        let totalPnl = 0;
        let greens = 0;
        let reds = 0;
        (resolved || []).forEach((r: any) => {
          const stake = Number(r.stake_amount) || 0;
          const pnl = Number(r.profit_loss) || 0;
          totalStake += stake;
          totalPnl += pnl;
          if (r.result === 'green') greens += 1;
          if (r.result === 'red') reds += 1;
        });
        const roi = totalStake > 0 ? (totalPnl / totalStake) * 100 : null;

        if (!cancelled) {
          setStats({
            signalsToday: countToday || 0,
            roi24h: roi,
            greens,
            reds,
            loading: false,
          });
        }
      } catch (e) {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const RoiIcon = stats.roi24h === null
    ? Minus
    : stats.roi24h >= 0
    ? TrendingUp
    : TrendingDown;
  const roiColor = stats.roi24h === null
    ? 'text-muted-foreground'
    : stats.roi24h >= 0
    ? 'text-emerald-400'
    : 'text-red-400';

  return (
    <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm px-4 py-3 grid grid-cols-3 gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Activity className="h-4 w-4" />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Sinais hoje
          </p>
          <p className="text-sm font-semibold text-foreground">
            {stats.loading ? '—' : stats.signalsToday}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted/40 ${roiColor}`}>
          <RoiIcon className="h-4 w-4" />
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            ROI 24h
          </p>
          <p className={`text-sm font-semibold ${roiColor}`}>
            {stats.loading || stats.roi24h === null
              ? '—'
              : `${stats.roi24h >= 0 ? '+' : ''}${stats.roi24h.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-bold">
          G/R
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Green / Red 24h
          </p>
          <p className="text-sm font-semibold">
            <span className="text-emerald-400">{stats.loading ? '—' : stats.greens}</span>
            <span className="text-muted-foreground/60"> / </span>
            <span className="text-red-400">{stats.loading ? '—' : stats.reds}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
