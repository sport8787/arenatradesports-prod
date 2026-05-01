import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Hammer, CheckCircle2, XCircle, Clock, Trophy, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import { translateMarket } from '@/utils/marketTranslator';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  source: 'punter_signal' | 'plano_favorito' | 'eventos_raros';
  match: string;
  league: string | null;
  market: string;
  odd: number | null;
  status: string | null;
  result: string | null; // 'green' | 'red' | 'void' | null
  profit_loss: number | null;
  commence_time: string;
  final_score?: string | null;
  isPlanoFavorito?: boolean;
  void_reason?: string | null;
}

type Tab = 'pendentes' | 'futuros' | 'green' | 'red' | 'void' | 'todos';
type PeriodFilter = 'ontem' | '7d' | '30d' | '14d_all';

export default function PunterLiquidacoesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<Tab>('pendentes');
  const [period, setPeriod] = useState<PeriodFilter>('14d_all');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Sinais Punter unificados
      const { data: sigs } = await supabase
        .from('punter_sinais')
        .select('id, match_id, home_team, away_team, league, market, odd, status, resultado, profit_loss, commence_time, final_score_home, final_score_away, analyzed_by, thesis, void_reason')
        .gte('commence_time', since)
        .order('commence_time', { ascending: false })
        .limit(500);

      const { data: favoritos } = await supabase
        .from('sinais_favorito_prelive')
        .select('id, home_team, away_team, league_name, match_date, favorito, fav_odd, resultado_vitoria, resultado_over15, resultado_over25')
        .gte('match_date', since)
        .order('match_date', { ascending: false })
        .limit(200);

      // Eventos Raros
      const { data: raros } = await supabase
        .from('eventos_raros_sinais')
        .select('id, candidato_id, match_id, placar_alvo, odd_entrada, resultado, profit_loss, status, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);

      let candidatos: Record<string, any> = {};
      if (raros && raros.length) {
        const ids = Array.from(new Set(raros.map((r: any) => r.candidato_id).filter(Boolean)));
        if (ids.length) {
          const { data: cands } = await supabase
            .from('eventos_raros_candidatos')
            .select('id, home_team, away_team, league_name, placar_alvo, match_date')
            .in('id', ids);
          for (const c of cands || []) candidatos[c.id] = c;
        }
      }

      const sigRows: Row[] = (sigs || []).map((s: any) => {
        const isPF = (s?.analyzed_by || '').includes('plano-favorito') || /plano\s*favorito/i.test(s?.thesis || '');
        return {
          id: s.id,
          source: 'punter_signal',
          match: s.home_team && s.away_team ? `${s.home_team} vs ${s.away_team}` : (s.match_id || '—'),
          league: s.league || null,
          market: s.market,
          odd: Number(s.odd) || null,
          status: s.status,
          result: s.resultado,
          profit_loss: s.profit_loss,
          commence_time: s.commence_time,
          final_score: (s.final_score_home != null && s.final_score_away != null) ? `${s.final_score_home}-${s.final_score_away}` : null,
          isPlanoFavorito: isPF,
          void_reason: s.void_reason || null,
        };
      });

      const favoritosRows: Row[] = (favoritos || []).flatMap((f: any) => {
        const match = f.home_team && f.away_team ? `${f.home_team} vs ${f.away_team}` : '—';
        const base = {
          id: f.id,
          source: 'plano_favorito' as const,
          match,
          league: f.league_name || 'Plano Favorito',
          odd: Number(f.fav_odd) || null,
          status: null,
          profit_loss: null,
          commence_time: f.match_date,
          isPlanoFavorito: true,
        };

        return [
          { ...base, id: `${f.id}-vitoria`, market: `Vitória do Favorito (${f.favorito || 'Favorito'})`, result: f.resultado_vitoria || null },
          { ...base, id: `${f.id}-over15`, market: 'Over 1.5 FT', result: f.resultado_over15 || null },
          { ...base, id: `${f.id}-over25`, market: 'Over 2.5 FT', result: f.resultado_over25 || null },
        ];
      });

      const rarosRows: Row[] = (raros || []).map((r: any) => {
        const c = candidatos[r.candidato_id] || {};
        const result = r.resultado ? String(r.resultado).toLowerCase() : null;
        return {
          id: r.id,
          source: 'eventos_raros',
          match: c.home_team && c.away_team ? `${c.home_team} vs ${c.away_team}` : (r.match_id || '—'),
          league: c.league_name || 'Eventos Raros',
          market: c.placar_alvo || r.placar_alvo || 'LAY',
          odd: Number(r.odd_entrada) || null,
          status: r.status,
          result,
          profit_loss: r.profit_loss,
          commence_time: c.match_date || r.created_at,
        };
      });

      const all = [...sigRows, ...favoritosRows, ...rarosRows].sort(
        (a, b) => new Date(b.commence_time).getTime() - new Date(a.commence_time).getTime()
      );
      setRows(all);
    } catch (e: any) {
      toast.error('Erro ao carregar sinais', { description: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const runSettlement = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('punter-settle-results-v3', { body: {} });
      if (error) throw error;
      toast.success('Verificação concluída', {
        description: `Checados: ${data.checked} | Liquidados: ${data.settled} | Não encontrados: ${data.not_found} | Mercados não suportados: ${data.unsupported}`,
      });
      await fetchAll();
    } catch (e: any) {
      toast.error('Falha ao verificar liquidações', { description: e.message });
    } finally {
      setRunning(false);
    }
  };

  const now = Date.now();
  const isFinished = (r: Row) => {
    const t = new Date(r.commence_time).getTime();
    return !isNaN(t) && t + 2.5 * 60 * 60 * 1000 < now;
  };
  const isGreen = (r: Row) => r.result === 'green' || r.result === 'GREEN';
  const isRed = (r: Row) => r.result === 'red' || r.result === 'RED';
  const isVoid = (r: Row) => r.result === 'void' || r.result === 'VOID';
  const isResolved = (r: Row) => isGreen(r) || isRed(r) || isVoid(r);
  // Pendente "real" = jogo terminou há menos de 36h e ainda não foi liquidado
  // (depois disso consideramos órfão e ocultamos da UI para não poluir)
  const isPending = (r: Row) => {
    if (isResolved(r)) return false;
    const t = new Date(r.commence_time).getTime();
    if (isNaN(t)) return false;
    const finished = t + 2.5 * 60 * 60 * 1000 < now;
    const tooOld = t + 36 * 60 * 60 * 1000 < now;
    return finished && !tooOld;
  };
  const isFuture = (r: Row) => !isResolved(r) && !isFinished(r);

  // Filtro por período (commence_time)
  const { periodCutoff, periodEnd, periodLabel } = (() => {
    const d = new Date();
    if (period === 'ontem') {
      const yesterday = new Date(d);
      yesterday.setDate(d.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { periodCutoff: yesterday.getTime(), periodEnd: today.getTime(), periodLabel: 'Ontem' };
    }
    if (period === '7d') return { periodCutoff: d.getTime() - 7 * 86400000, periodEnd: d.getTime() + 86400000, periodLabel: 'Últimos 7 dias' };
    if (period === '30d') return { periodCutoff: d.getTime() - 30 * 86400000, periodEnd: d.getTime() + 86400000, periodLabel: 'Últimos 30 dias' };
    return { periodCutoff: d.getTime() - 14 * 86400000, periodEnd: d.getTime() + 86400000, periodLabel: 'Últimos 14 dias' };
  })();

  const inPeriod = (r: Row) => {
    const t = new Date(r.commence_time).getTime();
    return !isNaN(t) && t >= periodCutoff && t <= periodEnd;
  };

  const periodRows = rows.filter(inPeriod);

  const filtered = periodRows.filter(r => {
    if (tab === 'todos') return true;
    if (tab === 'pendentes') return isPending(r);
    if (tab === 'futuros') return isFuture(r);
    if (tab === 'green') return isGreen(r);
    if (tab === 'red') return isRed(r);
    if (tab === 'void') return isVoid(r);
    return true;
  });

  const counts = {
    todos: periodRows.length,
    pendentes: periodRows.filter(isPending).length,
    green: periodRows.filter(isGreen).length,
    red: periodRows.filter(isRed).length,
    void: periodRows.filter(isVoid).length,
    futuros: periodRows.filter(isFuture).length,
  };

  // Métricas honestas: só consideram sinais com odd válida (> 1)
  // Plano Favorito sem odd e qualquer linha sem odd ficam fora dos cálculos.
  const STAKE_UNIT = 1;
  const computable = periodRows.filter(
    (r) => (isGreen(r) || isRed(r)) && r.odd != null && r.odd > 1
  );
  const computableGreen = computable.filter(isGreen).length;
  const computableRed = computable.filter(isRed).length;
  const decided = computableGreen + computableRed;
  const winRate = decided > 0 ? (computableGreen / decided) * 100 : 0;

  const profitData = computable.reduce(
    (acc, r) => {
      if (isGreen(r)) {
        acc.profit += (r.odd! - 1) * STAKE_UNIT;
      } else if (isRed(r)) {
        acc.profit -= STAKE_UNIT;
      }
      acc.staked += STAKE_UNIT;
      return acc;
    },
    { profit: 0, staked: 0 }
  );
  const roi = profitData.staked > 0 ? (profitData.profit / profitData.staked) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para Arena Punter"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight flex-1">
            VERIFICAR APOSTAS LIQUIDADAS
          </h1>
          <Button size="sm" onClick={runSettlement} disabled={running} className="gap-2">
            {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Hammer className="w-4 h-4" />}
            {running ? 'Verificando...' : 'Verificar agora'}
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-5xl space-y-5">
        <PunterBreadcrumb items={[{ label: 'Liquidações' }]} />

        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Sinais Punter — {periodLabel}</h2>
              <p className="font-mono text-xs text-muted-foreground mt-1 max-w-2xl">
                Lista <strong>todos os sinais gerados</strong> pelo Mycroft Punter (1X2, Over/Under, BTTS, AH, escanteios),
                Plano Favorito e Eventos Raros — independente de stake/aposta. Cada sinal é classificado como
                <span className="text-emerald-300"> GREEN</span>, <span className="text-rose-300"> RED</span>,
                <span className="text-slate-300"> VOID</span> ou
                <span className="text-amber-300"> Pendente</span> conforme o resultado real do jogo.
              </p>
            </div>
            <div className="flex gap-1 rounded-md border border-border bg-background/50 p-1">
              {([
                ['ontem', 'Ontem'],
                ['7d', '7 dias'],
                ['30d', '30 dias'],
                ['14d_all', '14 dias'],
              ] as [PeriodFilter, string][]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-mono rounded transition-colors',
                    period === key
                      ? 'bg-primary text-primary-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-card'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Painel de lucro hipotético */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Lucro hipotético</div>
              <div className={cn(
                'font-mono text-xl font-bold',
                profitData.profit > 0 ? 'text-emerald-400' : profitData.profit < 0 ? 'text-rose-400' : 'text-foreground'
              )}>
                {profitData.profit > 0 ? '+' : ''}{profitData.profit.toFixed(2)}u
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">1u = 1 unidade de stake</div>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">ROI</div>
              <div className={cn(
                'font-mono text-xl font-bold',
                roi > 0 ? 'text-emerald-400' : roi < 0 ? 'text-rose-400' : 'text-foreground'
              )}>
                {roi > 0 ? '+' : ''}{roi.toFixed(1)}%
              </div>
              <div className="text-[10px] font-mono text-muted-foreground">{profitData.staked.toFixed(0)}u apostadas</div>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Win Rate</div>
              <div className="font-mono text-xl font-bold text-foreground">{winRate.toFixed(1)}%</div>
              <div className="text-[10px] font-mono text-muted-foreground">{computableGreen}/{decided} c/ odd</div>
            </div>
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="text-[10px] font-mono uppercase text-muted-foreground">Sinais liquidados</div>
              <div className="font-mono text-xl font-bold text-foreground">{counts.green + counts.red + counts.void}</div>
              <div className="text-[10px] font-mono text-muted-foreground">de {counts.todos} no período</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono pt-1">
            <span className="text-emerald-400">✅ {counts.green} GREEN</span>
            <span className="text-rose-400">❌ {counts.red} RED</span>
            <span className="text-slate-300">⚪ {counts.void} VOID</span>
            <span className="text-amber-300">⏳ {counts.pendentes} pendentes</span>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="pendentes" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Pendentes ({counts.pendentes})
            </TabsTrigger>
            <TabsTrigger value="futuros" className="gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Futuros ({counts.futuros})
            </TabsTrigger>
            <TabsTrigger value="green" className="gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> Greens ({counts.green})
            </TabsTrigger>
            <TabsTrigger value="red" className="gap-1.5">
              <XCircle className="w-3.5 h-3.5" /> Reds ({counts.red})
            </TabsTrigger>
            <TabsTrigger value="void" className="gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Void ({counts.void})
            </TabsTrigger>
            <TabsTrigger value="todos">Todos ({counts.todos})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="mt-3">
            <ScrollArea className="h-[60vh] rounded-md border border-border bg-card/30">
              {loading ? (
                <div className="p-6 text-center font-mono text-xs text-muted-foreground">Carregando…</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center font-mono text-xs text-muted-foreground">Nenhum sinal nesta categoria.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {filtered.map((r) => (
                    <li key={`${r.source}-${r.id}`} className="p-3 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-card/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          <Badge variant="outline" className="text-[9px] uppercase font-mono">
                            {r.source === 'eventos_raros' ? 'Evento Raro' : r.source === 'plano_favorito' ? 'Plano Favorito' : 'Punter'}
                          </Badge>
                          {r.isPlanoFavorito && (
                            <Badge className="text-[9px] uppercase font-mono bg-amber-500/20 text-amber-300 border-amber-400/40 gap-1">
                              <Trophy className="w-3 h-3" /> Plano Favorito
                            </Badge>
                          )}
                          {r.league && (
                            <span className="text-[10px] font-mono text-muted-foreground truncate">{r.league}</span>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-foreground truncate">{r.match}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{translateMarket(r.market)}</span>
                          {r.odd && <> · @{r.odd.toFixed(2)}</>}
                          {r.final_score && <> · placar {r.final_score}</>}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                          {new Date(r.commence_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 sm:flex-col sm:items-end">
                        {isGreen(r) && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> GREEN
                          </Badge>
                        )}
                        {isRed(r) && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-400/40 gap-1">
                            <XCircle className="w-3.5 h-3.5" /> RED
                          </Badge>
                        )}
                        {isVoid(r) && (
                          <Badge
                            className="bg-slate-500/20 text-slate-300 border-slate-400/40 gap-1"
                            title={r.void_reason || 'Sinal anulado: resultado não pôde ser determinado'}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" /> VOID
                          </Badge>
                        )}
                        {isPending(r) && (
                          <Badge variant="outline" className="gap-1 border-amber-400/40 text-amber-300">
                            <Clock className="w-3.5 h-3.5" /> Pendente liquidação
                          </Badge>
                        )}
                        {isFuture(r) && (
                          <Badge variant="outline" className="gap-1 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" /> Aguardando jogo
                          </Badge>
                        )}
                        {r.profit_loss != null && (
                          <span className={cn(
                            'font-mono text-xs font-bold',
                            r.profit_loss > 0 ? 'text-emerald-400' : r.profit_loss < 0 ? 'text-rose-400' : 'text-muted-foreground'
                          )}>
                            {r.profit_loss > 0 ? '+' : ''}{Number(r.profit_loss).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
