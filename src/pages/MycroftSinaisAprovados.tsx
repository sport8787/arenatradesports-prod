import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Hourglass, Filter, TrendingUp, Target, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ApprovedSignal {
  id: string;
  match_id: string;
  market: string;
  verdict: string;
  odd: number | null;
  confidence: number | null;
  thesis: string | null;
  plan_name: string | null;
  result: string | null;
  final_score_home: number | null;
  final_score_away: number | null;
  settled_at: string | null;
  created_at: string;
  // join from live_matches
  home_team?: string | null;
  away_team?: string | null;
  championship?: string | null;
  current_score_home?: number | null;
  current_score_away?: number | null;
  match_status?: string | null;
}

type ResultFilter = 'all' | 'green' | 'red' | 'pending';
type PeriodFilter = 'today' | '7d' | '14d' | '30d';

const PERIOD_DAYS: Record<PeriodFilter, number> = { today: 1, '7d': 7, '14d': 14, '30d': 30 };
const PERIOD_LABELS: Record<PeriodFilter, string> = { today: 'Hoje', '7d': '7 dias', '14d': '14 dias', '30d': '30 dias' };

function getPeriodSinceISO(period: PeriodFilter): string {
  if (period === 'today') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  return new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();
}

const VERDICT_LABELS: Record<string, { label: string; className: string }> = {
  APROVADO: { label: '🎯 APROVADO', className: 'bg-success/15 text-success border-success/40' },
  APROVADO_SITUACIONAL: { label: '🎯 APROVADO • CONF. REDUZIDA', className: 'bg-success/10 text-success border-success/30' },
  LABAREDA: { label: '⚡ APROVADO LABAREDAS', className: 'bg-warning/15 text-warning border-warning/40' },
};

function isFinishedStatus(status?: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return ['finished', 'ft', 'aet', 'pen', 'fin', 'ended', 'cancelled', 'canceled', 'abandoned'].includes(s);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface AggregateStats {
  greens: number;
  reds: number;
  pnlUnits: number;   // soma de profits em unidades (stake = 1u)
  stakeUnits: number; // soma de stakes em unidades (apenas sinais com odd válida)
  validSignals: number;
}

// Fallback genérico por padrão de mercado (usado quando não há média histórica do próprio mercado)
function fallbackOddByMarket(market: string | null | undefined): number | null {
  if (!market) return null;
  const m = market.toLowerCase();
  if (m.includes('over 0.5 ht') || m.includes('back over 0.5 ht')) return 1.45;
  if (m.includes('over 0.5')) return 1.30;
  if (m.includes('over 1.5 ht')) return 2.40;
  if (m.includes('over 1.5')) return 1.75;
  if (m.includes('over 2.5')) return 2.00;
  if (m.includes('over 3.5')) return 2.80;
  if (m.includes('over 4.5')) return 4.00;
  if (m.includes('over 5.5')) return 6.00;
  if (m.includes('under 2.5')) return 1.85;
  if (m.includes('under 3.5')) return 1.40;
  if (m.includes('under 1.5')) return 2.50;
  if (m.includes('btts') || m.includes('ambas marcam')) return 1.80;
  if (m.includes('próximo gol') || m.includes('proximo gol') || m.includes('gols restantes')) return 1.70;
  return 1.85; // genérico conservador
}

export default function MycroftSinaisAprovados() {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<ApprovedSignal[]>([]);
  const [aggStats, setAggStats] = useState<AggregateStats>({ greens: 0, reds: 0, pnlUnits: 0, stakeUnits: 0, validSignals: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [period, setPeriod] = useState<PeriodFilter>('30d');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      // Buscar análises aprovadas no período selecionado
      const since = getPeriodSinceISO(period);

      // 1) Agregados REAIS (sem limite de 300) para os cards
      const baseFilter = (q: any) =>
        q.in('verdict', ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA']).gte('created_at', since);

      const [{ count: greensCount }, { count: redsCount }, { data: settledRows }] = await Promise.all([
        baseFilter(supabase.from('mycroft_analyses').select('id', { count: 'exact', head: true })).eq('result', 'green'),
        baseFilter(supabase.from('mycroft_analyses').select('id', { count: 'exact', head: true })).eq('result', 'red'),
        baseFilter(supabase.from('mycroft_analyses').select('odd, result, market')).in('result', ['green', 'red']),
      ]);

      // 1.1) Média histórica de odd por mercado (entre sinais que TÊM odd) — usada como fallback
      //      para sinais sem odd registrada do MESMO mercado.
      const marketOddSum = new Map<string, { sum: number; n: number }>();
      for (const r of settledRows ?? []) {
        const odd = Number((r as any).odd);
        const market = String((r as any).market || '').trim();
        if (!market || !Number.isFinite(odd) || odd <= 1) continue;
        const cur = marketOddSum.get(market) ?? { sum: 0, n: 0 };
        cur.sum += odd; cur.n += 1;
        marketOddSum.set(market, cur);
      }
      const marketOddAvg = (market: string | null | undefined): number | null => {
        if (!market) return null;
        const e = marketOddSum.get(market);
        if (!e || e.n === 0) return null;
        return e.sum / e.n;
      };

      // 1.2) ROI correto: stake = 1u por sinal válido, profit = (odd-1) GREEN / -1 RED.
      //      Sinais sem odd ganham fallback (média do próprio mercado → fallback genérico).
      let pnlUnits = 0;
      let stakeUnits = 0;
      let validSignals = 0;
      for (const r of settledRows ?? []) {
        const result = (r as any).result as 'green' | 'red';
        const market = (r as any).market as string | null;
        let odd = Number((r as any).odd);
        if (!Number.isFinite(odd) || odd <= 1) {
          odd = marketOddAvg(market) ?? fallbackOddByMarket(market) ?? 0;
        }
        if (!Number.isFinite(odd) || odd <= 1) continue; // VOID/REEMBOLSO/sem fallback → ignora
        stakeUnits += 1;
        validSignals += 1;
        if (result === 'green') pnlUnits += odd - 1;
        else if (result === 'red') pnlUnits -= 1;
      }

      if (mounted) {
        setAggStats({
          greens: greensCount ?? 0,
          reds: redsCount ?? 0,
          pnlUnits,
          stakeUnits,
          validSignals,
        });
      }

      // 2) Lista paginada (mantém limite p/ não estourar memória)
      const { data: analyses, error } = await supabase
        .from('mycroft_analyses')
        .select('id, match_id, market, verdict, odd, confidence, thesis, plan_name, result, final_score_home, final_score_away, settled_at, created_at')
        .in('verdict', ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'])
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) {
        console.error('[sinais-aprovados] erro:', error);
        if (mounted) setLoading(false);
        return;
      }

      const matchIds = Array.from(new Set((analyses ?? []).map((a) => a.match_id).filter(Boolean)));
      let matchMap = new Map<string, any>();
      if (matchIds.length > 0) {
        const { data: matches } = await supabase
          .from('live_matches')
          .select('match_id, home_team, away_team, championship, score_home, score_away, status')
          .in('match_id', matchIds);
        for (const m of matches ?? []) matchMap.set(m.match_id, m);
      }

      const enriched: ApprovedSignal[] = (analyses ?? []).map((a) => {
        const m = matchMap.get(a.match_id);
        return {
          ...a,
          home_team: m?.home_team ?? null,
          away_team: m?.away_team ?? null,
          championship: m?.championship ?? null,
          current_score_home: m?.score_home ?? null,
          current_score_away: m?.score_away ?? null,
          match_status: m?.status ?? null,
        };
      });

      if (mounted) {
        setSignals(enriched);
        setLoading(false);
      }
    }

    load();

    // Realtime: atualiza quando uma análise é liquidada
    const channel = supabase
      .channel('mycroft_signals_settle')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mycroft_analyses' }, () => load())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [period]);

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      if (filter === 'all') return true;
      if (filter === 'green') return s.result === 'green';
      if (filter === 'red') return s.result === 'red';
      if (filter === 'pending') return !s.result;
      return true;
    });
  }, [signals, filter]);

  const stats = useMemo(() => {
    const greens = aggStats.greens;
    const reds = aggStats.reds;
    const settled = greens + reds;
    const winRate = settled > 0 ? (greens / settled) * 100 : 0;
    // ROI = (lucro_total / aporte_total) * 100, considerando só sinais com odd válida (real ou fallback de mercado)
    const roi = aggStats.stakeUnits > 0 ? (aggStats.pnlUnits / aggStats.stakeUnits) * 100 : 0;
    return { greens, reds, winRate, roi };
  }, [aggStats]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/arena-trader-sports')}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <h1 className="font-orbitron text-base md:text-lg font-bold text-primary">
              Sinais Aprovados — Histórico
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="GREEN" value={stats.greens} color="text-success" />
          <StatCard icon={<XCircle className="w-4 h-4" />} label="RED" value={stats.reds} color="text-destructive" />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            color={stats.winRate >= 50 ? 'text-success' : 'text-destructive'}
            subtitle={`ROI ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`}
          />
        </div>

        {/* Filtros */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="green" className="data-[state=active]:text-success">GREEN</TabsTrigger>
            <TabsTrigger value="red" className="data-[state=active]:text-destructive">RED</TabsTrigger>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground font-orbitron text-sm">
            Carregando sinais...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <Filter className="w-8 h-8 mx-auto opacity-50" />
            <p className="text-sm">Nenhum sinal encontrado neste filtro.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((s) => (
              <SignalCard key={s.id} signal={s} onClick={() => navigate(`/arena-trader-sports/sinais-aprovados/${s.id}`)} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color, subtitle }: { icon: React.ReactNode; label: string; value: string | number; color: string; subtitle?: string }) {
  return (
    <div className="luxury-card p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-orbitron uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('font-orbitron text-xl font-bold', color)}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function SignalCard({ signal, onClick }: { signal: ApprovedSignal; onClick: () => void }) {
  const verdictMeta = VERDICT_LABELS[signal.verdict] ?? { label: signal.verdict, className: 'bg-muted text-foreground border-border' };
  const finished = isFinishedStatus(signal.match_status) || !!signal.settled_at;

  let resultBadge: { label: string; className: string; icon: React.ReactNode } | null = null;
  if (signal.result === 'green') {
    resultBadge = { label: 'GREEN', className: 'bg-success text-success-foreground border-success', icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
  } else if (signal.result === 'red') {
    resultBadge = { label: 'RED', className: 'bg-destructive text-destructive-foreground border-destructive', icon: <XCircle className="w-3.5 h-3.5" /> };
  } else if (finished) {
    resultBadge = { label: 'EXPIRADO', className: 'bg-muted text-muted-foreground border-border', icon: <Hourglass className="w-3.5 h-3.5" /> };
  } else {
    resultBadge = { label: 'PENDENTE', className: 'bg-warning/15 text-warning border-warning/40', icon: <Clock className="w-3.5 h-3.5" /> };
  }

  const finalScore =
    signal.final_score_home != null && signal.final_score_away != null
      ? `${signal.final_score_home} - ${signal.final_score_away}`
      : signal.current_score_home != null && signal.current_score_away != null
        ? `${signal.current_score_home} - ${signal.current_score_away}`
        : null;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="luxury-card p-4 text-left space-y-3 hover:border-primary/40 transition-all"
    >
      {/* Top: verdict + result */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-orbitron uppercase px-2 py-0.5 rounded-full border', verdictMeta.className)}>
          {verdictMeta.label}
        </span>
        <span className={cn('text-[10px] font-orbitron uppercase px-2 py-0.5 rounded-full border flex items-center gap-1', resultBadge.className)}>
          {resultBadge.icon}
          {resultBadge.label}
        </span>
      </div>

      {/* Match */}
      <div>
        {signal.championship && (
          <p className="text-[10px] font-orbitron uppercase tracking-wider text-primary truncate mb-1">
            {signal.championship}
          </p>
        )}
        <p className="text-sm font-semibold text-foreground truncate">
          {signal.home_team || '—'} <span className="text-muted-foreground">vs</span> {signal.away_team || '—'}
        </p>
        {finalScore && (
          <p className="text-2xl font-orbitron font-bold text-foreground mt-1">{finalScore}</p>
        )}
      </div>

      {/* Market + odd */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <div className="min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mercado</p>
          <p className="text-sm font-medium text-foreground truncate">{signal.market}</p>
        </div>
        {signal.odd != null && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Odd</p>
            <p className="font-orbitron text-base font-bold text-primary">{Number(signal.odd).toFixed(2)}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
        <span>{formatDate(signal.created_at)}</span>
        {signal.confidence != null && <span>Conf. {signal.confidence}%</span>}
        {signal.plan_name && <span className="text-primary font-orbitron">{signal.plan_name}</span>}
      </div>
    </motion.button>
  );
}
