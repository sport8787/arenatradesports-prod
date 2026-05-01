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
    // Considera jogo terminado ~2h30 após o kickoff
    return !isNaN(t) && t + 2.5 * 60 * 60 * 1000 < now;
  };
  const isGreen = (r: Row) => r.result === 'green' || r.result === 'GREEN';
  const isRed = (r: Row) => r.result === 'red' || r.result === 'RED';
  const isVoid = (r: Row) => r.result === 'void' || r.result === 'VOID';
  const isResolved = (r: Row) => isGreen(r) || isRed(r) || isVoid(r);
  // Pendente = sinal sem resultado ainda (jogo já terminado mas não foi liquidado)
  const isPending = (r: Row) => !isResolved(r) && isFinished(r);
  // Futuro = sinal de jogo que ainda não terminou
  const isFuture = (r: Row) => !isResolved(r) && !isFinished(r);

  const filtered = rows.filter(r => {
    if (tab === 'todos') return true;
    if (tab === 'pendentes') return isPending(r);
    if (tab === 'futuros') return isFuture(r);
    if (tab === 'green') return isGreen(r);
    if (tab === 'red') return isRed(r);
    if (tab === 'void') return isVoid(r);
    return true;
  });

  const counts = {
    todos: rows.length,
    pendentes: rows.filter(isPending).length,
    green: rows.filter(isGreen).length,
    red: rows.filter(isRed).length,
    void: rows.filter(isVoid).length,
    futuros: rows.filter(isFuture).length,
  };

  // Win rate exclui VOID (não conta nem como vitória nem como derrota)
  const decided = counts.green + counts.red;
  const winRate = decided > 0 ? (counts.green / decided) * 100 : 0;

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

        <div className="rounded-lg border border-border bg-card/50 p-4">
          <h2 className="text-lg font-bold text-foreground">Sinais Punter (últimos 14 dias)</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Lista <strong>todos os sinais gerados</strong> pelo Mycroft Punter (1X2, Over/Under, BTTS, AH, escanteios),
            Plano Favorito e Eventos Raros — independente de stake/aposta. Cada sinal é classificado como
            <span className="text-emerald-300"> GREEN</span>, <span className="text-rose-300">RED</span>,
            <span className="text-slate-300"> VOID</span> ou
            <span className="text-amber-300"> Pendente</span> conforme o resultado real do jogo.
            Clique em <strong>Verificar agora</strong> para liquidar via API-Football + The Odds API.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-mono">
            <span className="text-emerald-400">✅ {counts.green} GREEN</span>
            <span className="text-rose-400">❌ {counts.red} RED</span>
            <span className="text-slate-300">⚪ {counts.void} VOID</span>
            <span className="text-amber-300">⏳ {counts.pendentes} pendentes</span>
            <span className="ml-auto text-foreground">
              Win Rate: <strong>{winRate.toFixed(1)}%</strong>
              <span className="text-muted-foreground"> ({counts.green}/{decided} — VOID excluído)</span>
            </span>
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
