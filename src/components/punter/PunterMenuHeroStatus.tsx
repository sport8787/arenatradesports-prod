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

const CACHE_KEY = 'menu-hero-status-v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Faixa compacta no /menu — espelha a lógica da página /punter/liquidacoes
 * (mesmas fontes: punter_sinais + sinais_favorito_prelive + eventos_raros_sinais)
 * para que os números sejam idênticos.
 *
 * Métricas (últimos 7 dias por commence_time):
 *   - Entradas hoje: APROVADOS de punter_analyses cujo jogo começa hoje
 *   - ROI 7d: lucro hipotético em unidades / total apostado (1u por entrada liquidado)
 *   - G/R 7d: contagem de green/red entre entradas decididos
 */
export default function PunterMenuHeroStatus() {
  const cached = readCache<Omit<Stats, 'loading'>>(CACHE_KEY, CACHE_TTL_MS);
  const [stats, setStats] = useState<Stats>(
    cached
      ? { ...cached, loading: false }
      : { signalsToday: 0, roi7d: null, greens: 0, reds: 0, loading: true }
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const since7dDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const since7d = since7dDate.toISOString();
        const periodEnd = Date.now() + 86400000;

        // Entradas APROVADOS em aberto — MESMA fonte/filtro do /punter
        // (punter_sinais APROVADO, commence_time > now - 3h, dedup por home_away_market)
        const inPlayCutoffIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const { data: openSignals } = await supabase
          .from('punter_sinais')
          .select('home_team, away_team, market')
          .eq('verdict', 'APROVADO')
          .gt('commence_time', inPlayCutoffIso)
          .limit(200);
        const openDedup = new Set<string>();
        for (const s of openSignals || []) {
          const key = `${(s as any).home_team}_${(s as any).away_team}_${(s as any).market}`
            .toLowerCase()
            .replace(/\s+/g, '_');
          openDedup.add(key);
        }
        const countToday = openDedup.size;

        // Mesmas 3 fontes da página /liquidações
        const [{ data: sigs }, { data: favoritos }, { data: raros }] = await Promise.all([
          supabase
            .from('punter_sinais')
            .select('odd, stake_amount, resultado, profit_loss, commence_time')
            .gte('commence_time', since7d)
            .limit(500),
          supabase
            .from('sinais_favorito_prelive')
            .select('match_date, fav_odd, resultado_vitoria, resultado_over15, resultado_over25')
            .gte('match_date', since7d)
            .limit(200),
          supabase
            .from('eventos_raros_sinais')
            .select('odd_entrada, resultado, profit_loss, status, created_at, candidato_id')
            .gte('created_at', since7d)
            .limit(200),
        ]);

        const STAKE_UNIT = 1;
        const norm = (v: any) => (v ? String(v).toLowerCase() : null);
        const inPeriod = (iso: string | null) => {
          if (!iso) return false;
          const t = new Date(iso).getTime();
          return !isNaN(t) && t >= since7dDate.getTime() && t <= periodEnd;
        };

        type Decided = { result: 'green' | 'red'; odd: number | null; profit: number | null; stake: number | null };
        const decided: Decided[] = [];

        // punter_sinais
        for (const s of sigs || []) {
          if (!inPeriod((s as any).commence_time)) continue;
          const r = norm((s as any).resultado);
          if (r !== 'green' && r !== 'red') continue;
          decided.push({
            result: r,
            odd: (s as any).odd != null ? Number((s as any).odd) : null,
            profit: (s as any).profit_loss != null ? Number((s as any).profit_loss) : null,
            stake: (s as any).stake_amount != null ? Number((s as any).stake_amount) : null,
          });
        }

        // plano favorito (3 mercados por linha)
        for (const f of favoritos || []) {
          if (!inPeriod((f as any).match_date)) continue;
          const favOdd = (f as any).fav_odd != null ? Number((f as any).fav_odd) : null;
          const items: Array<{ result: any; odd: number | null }> = [
            { result: (f as any).resultado_vitoria, odd: favOdd },
            { result: (f as any).resultado_over15, odd: 1.45 },
            { result: (f as any).resultado_over25, odd: 1.85 },
          ];
          for (const it of items) {
            const r = norm(it.result);
            if (r !== 'green' && r !== 'red') continue;
            decided.push({ result: r, odd: it.odd, profit: null, stake: null });
          }
        }

        // eventos raros
        for (const e of raros || []) {
          if (!inPeriod((e as any).created_at)) continue;
          const r = norm((e as any).resultado);
          if (r !== 'green' && r !== 'red') continue;
          decided.push({
            result: r,
            odd: (e as any).odd_entrada != null ? Number((e as any).odd_entrada) : null,
            profit: (e as any).profit_loss != null ? Number((e as any).profit_loss) : null,
            stake: null,
          });
        }

        let totalProfit = 0;
        let totalStaked = 0;
        let greens = 0;
        let reds = 0;
        for (const d of decided) {
          totalStaked += STAKE_UNIT;
          if (d.result === 'red') {
            totalProfit += -STAKE_UNIT;
            reds += 1;
          } else {
            greens += 1;
            if (d.odd != null && d.odd > 1) {
              totalProfit += (d.odd - 1) * STAKE_UNIT;
            } else if (d.profit != null && d.stake != null && d.stake > 0) {
              totalProfit += d.profit / d.stake;
            } else if (d.profit != null && d.profit > 0) {
              totalProfit += d.profit;
            }
          }
        }
        const roi = totalStaked > 0 ? (totalProfit / totalStaked) * 100 : null;

        const fresh: Omit<Stats, 'loading'> = {
          signalsToday: countToday || 0,
          roi7d: roi,
          greens,
          reds,
        };

        if (!cancelled) setStats({ ...fresh, loading: false });
        writeCache(CACHE_KEY, fresh);
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
            Entradas em aberto
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
