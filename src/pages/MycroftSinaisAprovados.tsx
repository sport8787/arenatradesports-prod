import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Hourglass, Filter, TrendingUp, Trophy } from 'lucide-react';
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
  approved_at_timestamp: string | null;
  created_at: string;
  home_team?: string | null;
  away_team?: string | null;
  championship?: string | null;
  current_score_home?: number | null;
  current_score_away?: number | null;
  match_status?: string | null;
}

interface MatchSnapshot {
  match_id: string;
  home_team: string | null;
  away_team: string | null;
  championship: string | null;
  score_home: number | null;
  score_away: number | null;
  status: string | null;
  period?: string | null;
  updated_at: string;
  mycroft_analysis_id?: string | null;
}

type ResultFilter = 'all' | 'green' | 'red' | 'pending';
type PeriodFilter = 'today' | '7d' | '14d' | '30d';

interface ComputedStats {
  greens: number;
  reds: number;
  pendings: number;
  pnlUnits: number;
  stakeUnits: number;
}

const APPROVED_VERDICTS = ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'] as const;
const PERIOD_DAYS: Record<PeriodFilter, number> = { today: 1, '7d': 7, '14d': 14, '30d': 30 };
const PERIOD_LABELS: Record<PeriodFilter, string> = { today: 'Hoje', '7d': '7 dias', '14d': '14 dias', '30d': '30 dias' };
const STORAGE_KEY = 'mycroft.sinaisAprovados.filters.v1';
const VALID_PERIODS: PeriodFilter[] = ['today', '7d', '14d', '30d'];
const VALID_RESULTS: ResultFilter[] = ['all', 'green', 'red', 'pending'];
const LIVE_MATCH_RETENTION_MS = 6 * 60 * 60 * 1000;
const FINISHED_STATUSES = ['finished', 'ft', 'aet', 'pen', 'fin', 'ended', 'cancelled', 'canceled', 'postponed', 'abandoned'];

const VERDICT_LABELS: Record<string, { label: string; className: string }> = {
  APROVADO: { label: '🎯 APROVADO', className: 'bg-success/15 text-success border-success/40' },
  APROVADO_SITUACIONAL: { label: '🎯 APROVADO • CONF. REDUZIDA', className: 'bg-success/10 text-success border-success/30' },
  LABAREDA: { label: '⚡ APROVADO LABAREDAS', className: 'bg-warning/15 text-warning border-warning/40' },
};

function getPeriodSinceISO(period: PeriodFilter): string {
  if (period === 'today') {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  return new Date(Date.now() - PERIOD_DAYS[period] * 24 * 60 * 60 * 1000).toISOString();
}

function isFinishedStatus(status?: string | null) {
  if (!status) return false;
  const s = status.toLowerCase();
  return ['finished', 'ft', 'aet', 'pen', 'fin', 'ended', 'cancelled', 'canceled', 'abandoned'].includes(s);
}

function isActiveLiveMatch(match: Pick<MatchSnapshot, 'status' | 'period' | 'updated_at' | 'mycroft_analysis_id'>) {
  const status = String(match.status || '').toLowerCase();
  if (FINISHED_STATUSES.includes(status)) return false;

  const period = String(match.period || '').toLowerCase();
  if (period.includes('finish') || period.includes('ended') || period.includes('after')) return false;

  const updatedAt = toTimestamp(match.updated_at);
  if (!updatedAt || Date.now() - updatedAt > LIVE_MATCH_RETENTION_MS) return false;

  return !!match.mycroft_analysis_id;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeResult(result?: string | null): 'green' | 'red' | null {
  if (!result) return null;
  const r = String(result).trim().toLowerCase();
  if (r === 'green' || r === 'half_green') return 'green';
  if (r === 'red' || r === 'half_red') return 'red';
  return null;
}

function isSettledResult(result?: string | null) {
  return normalizeResult(result) !== null;
}

function getApprovedAt(signal: Pick<ApprovedSignal, 'approved_at_timestamp' | 'created_at'>) {
  return signal.approved_at_timestamp || signal.created_at;
}

function getSignalEventDate(signal: Pick<ApprovedSignal, 'result' | 'settled_at' | 'approved_at_timestamp' | 'created_at'>) {
  return isSettledResult(signal.result) && signal.settled_at
    ? signal.settled_at
    : getApprovedAt(signal);
}

function getSignalKey(signal: Pick<ApprovedSignal, 'match_id' | 'market'>) {
  return `${signal.match_id}::${signal.market.trim().toLowerCase()}`;
}

function toTimestamp(value?: string | null) {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSignalInPeriod(signal: Pick<ApprovedSignal, 'result' | 'settled_at' | 'approved_at_timestamp' | 'created_at'>, since: string) {
  return toTimestamp(getSignalEventDate(signal)) >= toTimestamp(since);
}

function pickPreferredSignal(current: ApprovedSignal | undefined, candidate: ApprovedSignal) {
  if (!current) return candidate;

  const currentSettled = isSettledResult(current.result);
  const candidateSettled = isSettledResult(candidate.result);

  if (candidateSettled && !currentSettled) return candidate;
  if (currentSettled && !candidateSettled) return current;

  const currentEventTime = toTimestamp(getSignalEventDate(current));
  const candidateEventTime = toTimestamp(getSignalEventDate(candidate));

  if (candidateEventTime !== currentEventTime) {
    return candidateEventTime > currentEventTime ? candidate : current;
  }

  return toTimestamp(candidate.created_at) > toTimestamp(current.created_at) ? candidate : current;
}

function readPersisted(): { period: PeriodFilter; filter: ResultFilter } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      return {
        period: VALID_PERIODS.includes(j?.period) ? j.period : '30d',
        filter: VALID_RESULTS.includes(j?.filter) ? j.filter : 'all',
      };
    }
  } catch {}
  return { period: '30d', filter: 'all' };
}

function fallbackOddByMarket(market: string | null | undefined): number | null {
  if (!market) return null;
  const m = market.toLowerCase();
  if (m.includes('over 0.5 ht') || m.includes('back over 0.5 ht')) return 1.45;
  if (m.includes('over 0.5')) return 1.30;
  if (m.includes('over 1.5 ht')) return 2.40;
  if (m.includes('over 1.5')) return 1.75;
  if (m.includes('over 2.5')) return 2.0;
  if (m.includes('over 3.5')) return 2.8;
  if (m.includes('over 4.5')) return 4.0;
  if (m.includes('over 5.5')) return 6.0;
  if (m.includes('under 2.5')) return 1.85;
  if (m.includes('under 3.5')) return 1.4;
  if (m.includes('under 1.5')) return 2.5;
  if (m.includes('btts') || m.includes('ambas marcam')) return 1.8;
  if (m.includes('próximo gol') || m.includes('proximo gol') || m.includes('gols restantes')) return 1.7;
  return 1.85;
}

function computeStats(rows: ApprovedSignal[]): ComputedStats {
  const greens = rows.filter((row) => normalizeResult(row.result) === 'green').length;
  const reds = rows.filter((row) => normalizeResult(row.result) === 'red').length;
  const pendings = rows.length - greens - reds;

  const marketOddSum = new Map<string, { sum: number; n: number }>();
  for (const row of rows) {
    const odd = Number(row.odd);
    const market = row.market?.trim();
    if (!market || !isSettledResult(row.result) || !Number.isFinite(odd) || odd <= 1) continue;
    const current = marketOddSum.get(market) ?? { sum: 0, n: 0 };
    current.sum += odd;
    current.n += 1;
    marketOddSum.set(market, current);
  }

  const marketOddAvg = (market: string | null | undefined): number | null => {
    if (!market) return null;
    const entry = marketOddSum.get(market.trim());
    if (!entry || entry.n === 0) return null;
    return entry.sum / entry.n;
  };

  let pnlUnits = 0;
  let stakeUnits = 0;

  for (const row of rows) {
    if (!isSettledResult(row.result)) continue;
    let odd = Number(row.odd);
    if (!Number.isFinite(odd) || odd <= 1) {
      odd = marketOddAvg(row.market) ?? fallbackOddByMarket(row.market) ?? 0;
    }
    if (!Number.isFinite(odd) || odd <= 1) continue;
    stakeUnits += 1;
    pnlUnits += normalizeResult(row.result) === 'green' ? odd - 1 : -1;
  }

  return { greens, reds, pendings, pnlUnits, stakeUnits };
}

export default function MycroftSinaisAprovados() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [signals, setSignals] = useState<ApprovedSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const requestIdRef = useRef(0);

  const persisted = readPersisted();
  const initialPeriod = (VALID_PERIODS as string[]).includes(searchParams.get('period') ?? '')
    ? (searchParams.get('period') as PeriodFilter)
    : persisted.period;
  const initialFilter = (VALID_RESULTS as string[]).includes(searchParams.get('filter') ?? '')
    ? (searchParams.get('filter') as ResultFilter)
    : persisted.filter;

  const [filter, setFilter] = useState<ResultFilter>(initialFilter);
  const [period, setPeriod] = useState<PeriodFilter>(initialPeriod);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('period', period);
    next.set('filter', filter);
    setSearchParams(next, { replace: true });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ period, filter }));
    } catch {}
  }, [period, filter]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      const since = getPeriodSinceISO(period);

      try {
        const pageSize = 500;
        const rawAnalyses: ApprovedSignal[] = [];
        let from = 0;

        while (true) {
          const { data: page, error } = await supabase
            .from('mycroft_analyses')
            .select('id, match_id, market, verdict, odd, confidence, thesis, plan_name, result, final_score_home, final_score_away, settled_at, approved_at_timestamp, created_at')
            .in('verdict', [...APPROVED_VERDICTS])
            .or(`settled_at.gte.${since},approved_at_timestamp.gte.${since},and(approved_at_timestamp.is.null,created_at.gte.${since})`)
            .order('created_at', { ascending: false })
            .range(from, from + pageSize - 1);

          if (error) {
            console.error('[sinais-aprovados] erro:', error);
            if (mounted) setLoading(false);
            return;
          }

          if (!page?.length) break;
          rawAnalyses.push(...(page as ApprovedSignal[]));
          if (page.length < pageSize) break;
          from += pageSize;
        }

        const dedupedMap = new Map<string, ApprovedSignal>();
        for (const analysis of rawAnalyses) {
          if (!isSignalInPeriod(analysis, since)) continue;
          const key = getSignalKey(analysis);
          dedupedMap.set(key, pickPreferredSignal(dedupedMap.get(key), analysis));
        }

        const baseSignals = Array.from(dedupedMap.values()).sort(
          (a, b) => toTimestamp(getSignalEventDate(b)) - toTimestamp(getSignalEventDate(a)),
        );

        const matchIds = Array.from(new Set(baseSignals.map((a) => a.match_id).filter(Boolean)));
        const matchMap = new Map<string, MatchSnapshot>();
        const activePendingByMatchId = new Map<string, string>();

        if (matchIds.length > 0) {
          const { data: matches } = await supabase
            .from('live_matches')
            .select('match_id, home_team, away_team, championship, score_home, score_away, status, period, updated_at, mycroft_analysis_id')
            .in('match_id', matchIds);

          for (const match of matches ?? []) {
            const previous = matchMap.get(match.match_id);
            const current = match as MatchSnapshot;
            if (!previous || toTimestamp(current.updated_at) >= toTimestamp(previous.updated_at)) {
              matchMap.set(match.match_id, current);
            }
          }

          for (const match of matchMap.values()) {
            if (!isActiveLiveMatch(match) || !match.mycroft_analysis_id) continue;
            activePendingByMatchId.set(match.match_id, match.mycroft_analysis_id);
          }
        }

        const normalizedSignals = baseSignals.filter((analysis) => {
          if (isSettledResult(analysis.result)) return true;
          return activePendingByMatchId.get(analysis.match_id) === analysis.id;
        });

        const enriched: ApprovedSignal[] = normalizedSignals.map((analysis) => {
          const match = matchMap.get(analysis.match_id);
          return {
            ...analysis,
            home_team: match?.home_team ?? null,
            away_team: match?.away_team ?? null,
            championship: match?.championship ?? null,
            current_score_home: match?.score_home ?? null,
            current_score_away: match?.score_away ?? null,
            match_status: match?.status ?? null,
          };
        });

        if (mounted && requestId === requestIdRef.current) {
          setSignals(enriched);
          setLoading(false);
        }
      } catch (error) {
        console.error('[sinais-aprovados] falha inesperada:', error);
        if (mounted && requestId === requestIdRef.current) setLoading(false);
      }
    }

    load();

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
    return signals.filter((signal) => {
      if (filter === 'all') return true;
      if (filter === 'green') return signal.result === 'green';
      if (filter === 'red') return signal.result === 'red';
      if (filter === 'pending') return !isSettledResult(signal.result);
      return true;
    });
  }, [signals, filter]);

  const periodSummary = useMemo(() => {
    const computed = computeStats(signals);
    const settled = computed.greens + computed.reds;
    const total = signals.length;
    const greenPct = settled > 0 ? (computed.greens / settled) * 100 : 0;
    const redPct = settled > 0 ? (computed.reds / settled) * 100 : 0;
    const roi = computed.stakeUnits > 0 ? (computed.pnlUnits / computed.stakeUnits) * 100 : 0;
    return {
      greens: computed.greens,
      reds: computed.reds,
      pendings: computed.pendings,
      total,
      settled,
      greenPct,
      redPct,
      roi,
    };
  }, [signals]);

  const stats = useMemo(() => {
    const computed = computeStats(filtered);
    const settled = computed.greens + computed.reds;
    const winRate = settled > 0 ? (computed.greens / settled) * 100 : 0;
    const roi = filter === 'all'
      ? (computed.stakeUnits > 0 ? (computed.pnlUnits / computed.stakeUnits) * 100 : 0)
      : null;
    return { greens: computed.greens, reds: computed.reds, winRate, roi };
  }, [filtered, filter]);

  return (
    <div className="min-h-screen bg-background">
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
              Entradas Aprovadas — Histórico
            </h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="w-4 h-4" />
            <span className="text-[11px] font-orbitron uppercase tracking-wider">Período</span>
          </div>
          <div className="flex items-center gap-1 bg-secondary/30 rounded-lg p-1">
            {(Object.keys(PERIOD_DAYS) as PeriodFilter[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3 py-1.5 text-xs font-orbitron rounded-md transition-all',
                  period === p
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="luxury-card p-3 sm:p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-orbitron uppercase tracking-wider text-muted-foreground">
                Resumo · {PERIOD_LABELS[period]}
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {periodSummary.total} entradas · {periodSummary.settled} liquidados
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <div className="rounded-md border border-success/30 bg-success/10 px-2.5 py-1.5">
              <p className="text-[10px] font-orbitron uppercase text-success/80">GREEN</p>
              <p className="text-base sm:text-lg font-orbitron font-bold text-success leading-tight">
                {periodSummary.greens}
                <span className="text-[10px] sm:text-xs font-mono ml-1.5 opacity-80">
                  {periodSummary.greenPct.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5">
              <p className="text-[10px] font-orbitron uppercase text-destructive/80">RED</p>
              <p className="text-base sm:text-lg font-orbitron font-bold text-destructive leading-tight">
                {periodSummary.reds}
                <span className="text-[10px] sm:text-xs font-mono ml-1.5 opacity-80">
                  {periodSummary.redPct.toFixed(1)}%
                </span>
              </p>
            </div>
            <div className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-1.5">
              <p className="text-[10px] font-orbitron uppercase text-warning/80">PENDENTES</p>
              <p className="text-base sm:text-lg font-orbitron font-bold text-warning leading-tight">
                {periodSummary.pendings}
              </p>
            </div>
            <div
              className={cn(
                'rounded-md border px-2.5 py-1.5',
                periodSummary.roi >= 0 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5',
              )}
            >
              <p className="text-[10px] font-orbitron uppercase text-muted-foreground">ROI</p>
              <p
                className={cn(
                  'text-base sm:text-lg font-orbitron font-bold leading-tight',
                  periodSummary.roi >= 0 ? 'text-success' : 'text-destructive',
                )}
              >
                {periodSummary.roi >= 0 ? '+' : ''}
                {periodSummary.roi.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground mb-2">
            Recorte selecionado · {PERIOD_LABELS[period]} ·{' '}
            {filter === 'all' ? 'Todos' : filter === 'green' ? 'GREEN' : filter === 'red' ? 'RED' : 'Pendentes'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatCard icon={<CheckCircle2 className="w-4 h-4" />} label="GREEN" value={stats.greens} color="text-success" />
            <StatCard icon={<XCircle className="w-4 h-4" />} label="RED" value={stats.reds} color="text-destructive" />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Win Rate"
              value={`${stats.winRate.toFixed(1)}%`}
              color={stats.winRate >= 50 ? 'text-success' : 'text-destructive'}
              subtitle={
                stats.roi != null
                  ? `ROI ${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}%`
                  : `Filtro: ${filter === 'green' ? 'apenas greens' : filter === 'red' ? 'apenas reds' : 'pendentes'}`
              }
            />
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
          <TabsList className="grid grid-cols-4 w-full max-w-xl">
            <TabsTrigger value="all">
              Todos <span className="ml-1 opacity-70 text-[10px]">({periodSummary.total})</span>
            </TabsTrigger>
            <TabsTrigger value="green" className="data-[state=active]:text-success">
              GREEN <span className="ml-1 opacity-70 text-[10px]">({periodSummary.greens})</span>
            </TabsTrigger>
            <TabsTrigger value="red" className="data-[state=active]:text-destructive">
              RED <span className="ml-1 opacity-70 text-[10px]">({periodSummary.reds})</span>
            </TabsTrigger>
            <TabsTrigger value="pending">
              Pendentes <span className="ml-1 opacity-70 text-[10px]">({periodSummary.pendings})</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground font-orbitron text-sm">
            Carregando entradas...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <Filter className="w-8 h-8 mx-auto opacity-50" />
            <p className="text-sm">Nenhum entrada encontrado para {PERIOD_LABELS[period]} · {filter === 'all' ? 'Todos' : filter}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((signal) => (
              <SignalCard key={signal.id} signal={signal} onClick={() => navigate(`/arena-trader-sports/sinais-aprovados/${signal.id}`)} />
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
  const eventDate = getSignalEventDate(signal);
  const eventLabel = isSettledResult(signal.result) ? 'Liquidado' : 'Aprovado';

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
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10px] font-orbitron uppercase px-2 py-0.5 rounded-full border', verdictMeta.className)}>
          {verdictMeta.label}
        </span>
        <span className={cn('text-[10px] font-orbitron uppercase px-2 py-0.5 rounded-full border flex items-center gap-1', resultBadge.className)}>
          {resultBadge.icon}
          {resultBadge.label}
        </span>
      </div>

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

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
        <span>{eventLabel}: {formatDate(eventDate)}</span>
        {signal.confidence != null && <span>Conf. {signal.confidence}%</span>}
        {signal.plan_name && <span className="text-primary font-orbitron">{signal.plan_name}</span>}
      </div>
    </motion.button>
  );
}
