import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, RefreshCw, FlaskConical, Play, BarChart3, Eye } from 'lucide-react';
import { toast } from 'sonner';
import ShadowAfCronToggle from '@/components/arena-trader/ShadowAfCronToggle';
import MatchCardWithEntries from '@/components/dashboard/MatchCardWithEntries';
import type { Match } from '@/components/dashboard/MatchCard';

const getChampionshipColor = (name: string): Match['championshipColor'] => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('copa')) return 'yellow';
  if (lower.includes('champions') || lower.includes('liga')) return 'blue';
  if (lower.includes('brasileir')) return 'green';
  return 'red';
};

function shadowSignalToMatch(s: ShadowSignal, m?: MatchInfo, lmExtra?: any): Match {
  const stats = lmExtra?.stats || s.stats_snapshot?.stats || {};
  return {
    id: s.id,
    championship: m?.championship || '—',
    championshipColor: getChampionshipColor(m?.championship || ''),
    home: m?.home_team || 'Casa',
    away: m?.away_team || 'Fora',
    homeLogo: lmExtra?.home_logo || '⚽',
    awayLogo: lmExtra?.away_logo || '⚽',
    scoreHome: s.final_score_home ?? m?.score_home ?? 0,
    scoreAway: s.final_score_away ?? m?.score_away ?? 0,
    minute: m?.minute ?? s.approved_at_minute ?? 0,
    period: '',
    status: (s.result ? 'finished' : 'live') as Match['status'],
    mycroftStatus: (s.verdict as Match['mycroftStatus']) || 'APROVADO',
    matchId: s.match_id,
    stats: {
      possession_home: stats.possession_home,
      possession_away: stats.possession_away,
      attacks_home: stats.attacks_home ?? stats.dangerous_attacks_home,
      attacks_away: stats.attacks_away ?? stats.dangerous_attacks_away,
      shots_home: stats.shots_on_target_home ?? stats.shots_home,
      shots_away: stats.shots_on_target_away ?? stats.shots_away,
      corners_home: stats.corners_home,
      corners_away: stats.corners_away,
      xG_home: stats.xG_home,
      xG_away: stats.xG_away,
    },
    planName: s.plan_name,
    market: s.market,
    signalResult: (s.result === 'green' || s.result === 'red') ? s.result : null,
    finalScoreHome: s.final_score_home ?? null,
    finalScoreAway: s.final_score_away ?? null,
    confidence: s.confidence ?? null,
    alerts: null,
  };
}

interface ShadowSignal {
  id: string;
  match_id: string;
  verdict: string;
  market: string | null;
  plan_name: string | null;
  thesis: string | null;
  odd: number | null;
  confidence: number | null;
  approved_at_minute: number | null;
  approved_at_score_home: number | null;
  approved_at_score_away: number | null;
  created_at: string;
  result?: string | null;
  final_score_home?: number | null;
  final_score_away?: number | null;
  stats_snapshot?: any;
}

interface MatchInfo {
  match_id: string;
  home_team: string;
  away_team: string;
  championship: string;
  minute: number | null;
  score_home: number | null;
  score_away: number | null;
}

interface PrimarySignal {
  match_id: string;
  market: string | null;
  verdict: string;
  result?: string | null;
  stats_snapshot?: any;
  id?: string;
}

interface MetricsRow {
  provider: string;
  total_approvados: number;
  liquidados: number;
  greens: number;
  reds: number;
  win_rate: number | null;
  pendentes: number;
}

interface DivergenceRow {
  divergencia: string;
  total: number;
}

const APPROVED = ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'];
const SHADOW_AF_ACTIVATED_AT = '2026-04-30T15:00:00Z'; // referência da ativação

type Period = 'since' | '7d' | '30d';

function periodToSince(p: Period): string {
  if (p === 'since') return SHADOW_AF_ACTIVATED_AT;
  const days = p === '7d' ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function StatsDiffModal({ open, onClose, sm, af, signal }: any) {
  const sStats = sm?.stats_snapshot?.stats || {};
  const aStats = af?.stats_snapshot?.stats || {};
  const keys = Array.from(new Set([...Object.keys(sStats), ...Object.keys(aStats)])).sort();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Diff de stats — {signal?.market}</DialogTitle>
        </DialogHeader>
        {!sm && !af ? (
          <p className="text-sm text-muted-foreground">Snapshot indisponível para este sinal.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground border-b">
              <tr>
                <th className="py-1 pr-2">Métrica</th>
                <th className="py-1 px-2">Sportmonks</th>
                <th className="py-1 px-2">API-Football</th>
                <th className="py-1 pl-2">Δ</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const s = (sStats as any)[k];
                const a = (aStats as any)[k];
                const sN = typeof s === 'number' ? s : Number(s);
                const aN = typeof a === 'number' ? a : Number(a);
                const diff = !isNaN(sN) && !isNaN(aN) ? (sN - aN).toFixed(2) : '-';
                const diverge = !isNaN(sN) && !isNaN(aN) && Math.abs(sN - aN) > 0.01;
                return (
                  <tr key={k} className={diverge ? 'bg-amber-500/5' : ''}>
                    <td className="py-1 pr-2 font-mono">{k}</td>
                    <td className="py-1 px-2">{s ?? '-'}</td>
                    <td className="py-1 px-2">{a ?? '-'}</td>
                    <td className="py-1 pl-2 text-muted-foreground">{diff}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function ShadowAfApprovedTab() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [period, setPeriod] = useState<Period>('since');
  const [signals, setSignals] = useState<ShadowSignal[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchInfo>>({});
  const [primary, setPrimary] = useState<Record<string, PrimarySignal[]>>({});
  const [metrics, setMetrics] = useState<MetricsRow[]>([]);
  const [divergences, setDivergences] = useState<DivergenceRow[]>([]);
  const [diffSignal, setDiffSignal] = useState<ShadowSignal | null>(null);

  const loadAggregates = async (p: Period) => {
    const since = periodToSince(p);
    const [{ data: m }, { data: d }] = await Promise.all([
      supabase.rpc('compare_providers_metrics' as any, { p_since: since }),
      supabase.rpc('compare_providers_divergences' as any, { p_since: since }),
    ]);
    setMetrics((m || []) as MetricsRow[]);
    setDivergences((d || []) as DivergenceRow[]);
  };

  const load = async () => {
    setLoading(true);
    try {
      const since = periodToSince(period);
      const { data: shadow, error } = await supabase
        .from('mycroft_analyses_shadow_af' as any)
        .select('*')
        .in('verdict', APPROVED)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const list = (shadow || []) as unknown as ShadowSignal[];
      setSignals(list);

      const ids = Array.from(new Set(list.map((s) => s.match_id)));
      if (ids.length > 0) {
        const [{ data: lm }, { data: prim }] = await Promise.all([
          supabase.from('live_matches').select('match_id, home_team, away_team, championship, minute, score_home, score_away').in('match_id', ids),
          supabase.from('mycroft_analyses').select('id, match_id, market, verdict, result, stats_snapshot').in('match_id', ids).in('verdict', APPROVED),
        ]);
        const map: Record<string, MatchInfo> = {};
        (lm || []).forEach((m: any) => { map[m.match_id] = m; });
        setMatches(map);

        const pmap: Record<string, PrimarySignal[]> = {};
        (prim || []).forEach((p: any) => {
          pmap[p.match_id] = pmap[p.match_id] || [];
          pmap[p.match_id].push(p);
        });
        setPrimary(pmap);
      } else {
        setMatches({});
        setPrimary({});
      }

      await loadAggregates(period);
    } catch (e: any) {
      toast.error('Erro ao carregar sinais shadow: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runShadow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-live-shadow-af', { body: {} });
      if (error) throw error;
      toast.success(`Shadow AF: ${data?.processed ?? 0} jogos analisados, ${data?.approved ?? 0} aprovações`);
      await load();
    } catch (e: any) {
      toast.error('Falha ao rodar shadow: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('shadow-af')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mycroft_analyses_shadow_af' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mycroft_analyses_shadow_af' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const enriched = signals.map((s) => {
    const primList = primary[s.match_id] || [];
    const sameKey = (s.market || '').toLowerCase().trim();
    const primMatch = primList.find((p) => (p.market || '').toLowerCase().trim() === sameKey);
    return {
      ...s,
      matchedInPrimary: !!primMatch,
      sameMatchAnyPrimary: primList.length > 0,
      primarySignal: primMatch,
    };
  });

  const onlyInAf = enriched.filter((s) => !s.matchedInPrimary).length;

  const mSm = metrics.find((x) => x.provider === 'sportmonks');
  const mAf = metrics.find((x) => x.provider === 'api-football');
  const div = (k: string) => divergences.find((d) => d.divergencia === k)?.total ?? 0;

  const periodLabel = useMemo(() => {
    if (period === 'since') return 'Desde ativação (30/04/2026)';
    if (period === '7d') return 'Últimos 7 dias';
    return 'Últimos 30 dias';
  }, [period]);

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
          <span className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-500" />
            Sinais Aprovados — API-Football <Badge variant="outline" className="ml-2">SHADOW · ADMIN</Badge>
          </span>
          <div className="flex gap-2 items-center flex-wrap">
            <ShadowAfCronToggle />
            <div className="flex border rounded overflow-hidden text-xs">
              {(['since','7d','30d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 ${period === p ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                >
                  {p === 'since' ? 'Ativação' : p}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={runShadow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Rodar agora
            </Button>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* (A) Painel agregado */}
        <div className="border rounded p-3 bg-background/50">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Métricas — {periodLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[mSm, mAf].map((row, i) => {
              const label = i === 0 ? 'Sportmonks (primária)' : 'API-Football (shadow)';
              const r = row as MetricsRow | undefined;
              return (
                <div key={i} className="border rounded p-2 text-xs space-y-1">
                  <div className="font-medium">{label}</div>
                  <div>Aprovados: <strong>{r?.total_approvados ?? 0}</strong></div>
                  <div>Liquidados: {r?.liquidados ?? 0} ({r?.pendentes ?? 0} pendentes)</div>
                  <div>
                    GREEN <span className="text-success font-bold">{r?.greens ?? 0}</span>
                    {' · '}
                    RED <span className="text-destructive font-bold">{r?.reds ?? 0}</span>
                  </div>
                  <div>Win-rate: <strong>{r?.win_rate != null ? `${r.win_rate}%` : '—'}</strong></div>
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="border rounded p-1.5">
              <div className="text-muted-foreground">Confirmados</div>
              <div className="font-bold text-success">{div('confirmados_ambas')}</div>
            </div>
            <div className="border rounded p-1.5">
              <div className="text-muted-foreground">Só Sportmonks</div>
              <div className="font-bold text-blue-500">{div('so_sportmonks')}</div>
            </div>
            <div className="border rounded p-1.5">
              <div className="text-muted-foreground">Só AF</div>
              <div className="font-bold text-amber-500">{div('so_api_football')}</div>
            </div>
            <div className="border rounded p-1.5">
              <div className="text-muted-foreground">Mercado divergente</div>
              <div className="font-bold">{div('mesma_partida_mercado_diferente')}</div>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Análise paralela usando <strong>API-Football</strong>. Liquidação automática ao fim do jogo (Over/Under/BTTS).
          Clique em <Eye className="h-3 w-3 inline" /> para ver o diff de stats brutas entre os dois provedores.
        </p>

        <div className="grid grid-cols-3 gap-3 text-center text-xs">
          <div className="border rounded p-2">
            <div className="text-muted-foreground">Total AF (lista)</div>
            <div className="text-lg font-bold">{signals.length}</div>
          </div>
          <div className="border rounded p-2 bg-amber-500/10">
            <div className="text-muted-foreground">Só na AF</div>
            <div className="text-lg font-bold text-amber-600">{onlyInAf}</div>
          </div>
          <div className="border rounded p-2">
            <div className="text-muted-foreground">Confirmados</div>
            <div className="text-lg font-bold text-success">{signals.length - onlyInAf}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhum sinal shadow no período. Clique em <strong>Rodar agora</strong> para disparar análise paralela.
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {enriched.map((s) => {
              const m = matches[s.match_id];
              const resBadge = s.result === 'green' ? <Badge className="bg-success">GREEN</Badge>
                : s.result === 'red' ? <Badge variant="destructive">RED</Badge>
                : <Badge variant="secondary">pendente</Badge>;
              const primRes = s.primarySignal?.result;
              const primResBadge = !s.primarySignal ? null
                : primRes === 'green' ? <Badge className="bg-success/70 ml-1">SM:GREEN</Badge>
                : primRes === 'red' ? <Badge variant="destructive" className="ml-1">SM:RED</Badge>
                : <Badge variant="outline" className="ml-1">SM:pend</Badge>;
              return (
                <div
                  key={s.id}
                  className={`border rounded p-3 text-sm ${
                    !s.matchedInPrimary ? 'border-amber-500/60 bg-amber-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">
                      {m ? `${m.home_team} ${s.final_score_home ?? m.score_home ?? 0}-${s.final_score_away ?? m.score_away ?? 0} ${m.away_team}` : s.match_id}
                      {m?.minute != null && <span className="text-xs text-muted-foreground ml-2">({m.minute}')</span>}
                    </div>
                    <div className="flex gap-1 items-center flex-wrap">
                      <Badge variant={s.verdict === 'APROVADO' ? 'default' : 'secondary'}>{s.verdict}</Badge>
                      {resBadge}
                      {primResBadge}
                      {!s.matchedInPrimary && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          {s.sameMatchAnyPrimary ? 'mercado divergente' : 'só AF'}
                        </Badge>
                      )}
                      {s.matchedInPrimary && (
                        <Badge variant="outline" className="border-success text-success">confirmado</Badge>
                      )}
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDiffSignal(s)} title="Ver diff de stats">
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    <strong>{s.market}</strong> @ {s.odd ?? '-'} · conf {s.confidence ?? 0}%
                    {s.plan_name ? ` · ${s.plan_name}` : ''}
                    {m?.championship ? ` · ${m.championship}` : ''}
                  </div>
                  {s.thesis && (
                    <div className="text-xs mt-1 text-foreground/80 line-clamp-2">{s.thesis}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <StatsDiffModal
          open={!!diffSignal}
          onClose={() => setDiffSignal(null)}
          signal={diffSignal}
          af={diffSignal}
          sm={diffSignal ? (primary[diffSignal.match_id] || []).find((p) => (p.market || '').toLowerCase().trim() === (diffSignal.market || '').toLowerCase().trim()) : null}
        />
      </CardContent>
    </Card>
  );
}
