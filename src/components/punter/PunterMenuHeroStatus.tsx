import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { readCache, writeCache } from '@/lib/sessionCache';

interface Stats {
  signalsToday: number;
  roi7d: number | null;
  greens: number;
  reds: number;
  loading: boolean;
}

const CACHE_KEY = 'menu-hero-status';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — fresh enough sem ficar piscando

/**
 * Faixa compacta no /menu mostrando o pulso recente do Punter:
 *  - Sinais APROVADOS para hoje (punter_analyses, commence_time = hoje)
 *  - ROI 7 dias (calculado em unidades, base 1u por sinal liquidado)
 *  - Green/Red 7 dias
 *
 * IMPORTANTE: ROI usa a odd registrada no sinal (referência exibida na aprovação).
 *   green: lucro = (odd - 1) por unidade apostada
 *   red:   lucro = -1 por unidade apostada
 * Quando a odd está ausente, tentamos derivar de profit_loss/stake_amount.
 */
export default function PunterMenuHeroStatus() {
  const [stats, setStats] = useState<Stats>({
    signalsToday: 0,
    roi7d: null,
    greens: 0,
    reds: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        // Sinais APROVADOS cujos jogos começam hoje (fonte de verdade: punter_analyses)
        const { count: countToday } = await supabase
          .from('punter_analyses')
          .select('id', { count: 'exact', head: true })
          .eq('verdict', 'APROVADO')
          .gte('commence_time', startOfToday.toISOString())
          .lte('commence_time', endOfToday.toISOString());

        // Resolvidos nos últimos 7d para ROI/Win Rate
        const { data: resolved } = await supabase
          .from('punter_signals')
          .select('result, profit_loss, stake_amount, odd')
          .gte('resulted_at', since7d)
          .in('result', ['green', 'red'])
          .eq('dismissed', false);

        let totalUnits = 0; // somatório lucro/prejuízo em unidades
        let totalStakeUnits = 0; // total apostado (1u por sinal)
        let greens = 0;
        let reds = 0;
        (resolved || []).forEach((r: any) => {
          const isGreen = r.result === 'green';
          const isRed = r.result === 'red';
          if (!isGreen && !isRed) return;

          totalStakeUnits += 1; // base 1u por sinal liquidado

          if (isRed) {
            totalUnits += -1;
            reds += 1;
            return;
          }

          // Green
          greens += 1;
          const odd = Number(r.odd);
          if (odd && odd > 1) {
            totalUnits += odd - 1;
          } else if (r.profit_loss && r.stake_amount && Number(r.stake_amount) > 0) {
            // fallback: deriva ratio quando não temos odd
            totalUnits += Number(r.profit_loss) / Number(r.stake_amount);
          } else {
            // sem dados suficientes: assume payout neutro ~ 0 (não inflar)
            totalUnits += 0;
          }
        });
        const roi = totalStakeUnits > 0 ? (totalUnits / totalStakeUnits) * 100 : null;

        if (!cancelled) {
          setStats({
            signalsToday: countToday || 0,
            roi7d: roi,
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

  const RoiIcon = stats.roi7d === null
    ? Minus
    : stats.roi7d >= 0
    ? TrendingUp
    : TrendingDown;
  const roiColor = stats.roi7d === null
    ? 'text-muted-foreground'
    : stats.roi7d >= 0
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
            ROI 7d
          </p>
          <p className={`text-sm font-semibold ${roiColor}`}>
            {stats.loading || stats.roi7d === null
              ? '—'
              : `${stats.roi7d >= 0 ? '+' : ''}${stats.roi7d.toFixed(1)}%`}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 font-mono text-[11px] font-bold">
          G/R
        </span>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Green / Red 7d
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
