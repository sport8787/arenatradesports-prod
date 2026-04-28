import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle2, Clock, XCircle, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';

type Source = 'horus' | 'manual';

interface BetRow {
  id: string;
  source: Source;
  match_id: string | null;
  match_name: string | null;
  market: string;
  odd: number;
  stake: number;
  status: string;
  result: string | null;
  profit_loss: number | null;
  score_home: number | null;
  score_away: number | null;
  commence_time: string | null;
  created_at: string;
}

const PAGE_SIZE = 200;

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch { return '—'; }
}

function statusBadge(b: BetRow) {
  const r = (b.result || '').toLowerCase();
  const score = b.score_home != null && b.score_away != null ? ` ${b.score_home}-${b.score_away}` : '';
  if (r === 'green' || r === 'won' || r === 'win') return <span className="px-2 py-0.5 rounded bg-success/15 text-success text-[11px] font-mono font-semibold">GREEN{score}</span>;
  if (r === 'red' || r === 'lost' || r === 'loss') return <span className="px-2 py-0.5 rounded bg-destructive/15 text-destructive text-[11px] font-mono font-semibold">RED{score}</span>;
  if (r === 'void' || r === 'cancelled') return <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground text-[11px] font-mono font-semibold">VOID</span>;
  return <span className="px-2 py-0.5 rounded bg-warning/15 text-warning text-[11px] font-mono font-semibold">PEND{score}</span>;
}

export default function PunterAuditoria() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'green' | 'red' | 'yesterday'>('all');
  const [reportLast, setReportLast] = useState<{ checked: number; settled: number; not_found: number; unsupported: number; scores_saved_only: number } | null>(null);

  const loadBets = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [horusRes, manualRes] = await Promise.all([
      supabase.from('virtual_bets_punter')
        .select('id, match_id, match_name, market, odd, stake, status, result, profit_loss, score_home, score_away, commence_time, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE),
      supabase.from('virtual_bets_manual')
        .select('id, match_id, match_name, market, odd, stake, status, result, profit_loss, score_home, score_away, commence_time, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE),
    ]);

    const merged: BetRow[] = [
      ...((horusRes.data || []).map((r: any) => ({ ...r, source: 'horus' as Source }))),
      ...((manualRes.data || []).map((r: any) => ({ ...r, source: 'manual' as Source }))),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setBets(merged);
    setLoading(false);
  };

  useEffect(() => { loadBets(); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const startYesterday = new Date(now); startYesterday.setDate(now.getDate() - 1); startYesterday.setHours(0,0,0,0);
    const endYesterday = new Date(startYesterday); endYesterday.setHours(23,59,59,999);
    return bets.filter(b => {
      const r = (b.result || '').toLowerCase();
      if (filter === 'pending') return b.status === 'pending' && !r;
      if (filter === 'green') return r === 'green' || r === 'won' || r === 'win';
      if (filter === 'red') return r === 'red' || r === 'lost' || r === 'loss';
      if (filter === 'yesterday') {
        const ref = b.commence_time ? new Date(b.commence_time) : new Date(b.created_at);
        return ref >= startYesterday && ref <= endYesterday;
      }
      return true;
    });
  }, [bets, filter]);

  const summary = useMemo(() => {
    const total = bets.length;
    const pending = bets.filter(b => b.status === 'pending' && !b.result).length;
    const greens = bets.filter(b => ['green','won','win'].includes((b.result||'').toLowerCase())).length;
    const reds = bets.filter(b => ['red','lost','loss'].includes((b.result||'').toLowerCase())).length;
    const pnl = bets.reduce((s, b) => s + (Number(b.profit_loss) || 0), 0);
    return { total, pending, greens, reds, pnl };
  }, [bets]);

  const handleReprocess = async () => {
    setReprocessing(true);
    setReportLast(null);
    try {
      toast({ title: 'Reprocessando…', description: 'Auditando liquidações pendentes (jogos de ontem e anteriores).' });
      const { data, error } = await supabase.functions.invoke('punter-settle-results', { body: {} });
      if (error) throw error;
      const r = data || {};
      setReportLast({
        checked: r.checked ?? 0,
        settled: r.settled ?? 0,
        not_found: r.not_found ?? 0,
        unsupported: r.unsupported ?? 0,
        scores_saved_only: r.scores_saved_only ?? 0,
      });
      toast({
        title: 'Auditoria concluída',
        description: `Verificados: ${r.checked ?? 0} • Liquidados: ${r.settled ?? 0} • Sem suporte: ${r.unsupported ?? 0}`,
      });
      await loadBets();
    } catch (e: any) {
      toast({ title: 'Erro ao reprocessar', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setReprocessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button onClick={() => navigate('/punter/menu')} className="text-muted-foreground hover:text-foreground" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold flex-1">AUDITORIA — APOSTAS PUNTER</h1>
          <Button onClick={handleReprocess} disabled={reprocessing} size="sm" className="gap-1.5">
            <RefreshCw className={`w-4 h-4 ${reprocessing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{reprocessing ? 'Reprocessando…' : 'Reprocessar liquidação'}</span>
            <span className="sm:hidden">Reproc.</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-6xl space-y-5">
        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] uppercase font-mono text-muted-foreground">Total</p>
            <p className="text-xl font-orbitron font-bold">{summary.total}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3"/>Pendentes</p>
            <p className="text-xl font-orbitron font-bold text-warning">{summary.pending}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>Greens</p>
            <p className="text-xl font-orbitron font-bold text-success">{summary.greens}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-1"><XCircle className="w-3 h-3"/>Reds</p>
            <p className="text-xl font-orbitron font-bold text-destructive">{summary.reds}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] uppercase font-mono text-muted-foreground">P&L</p>
            <p className={`text-xl font-orbitron font-bold ${summary.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
              {summary.pnl >= 0 ? '+' : ''}{summary.pnl.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Relatório do reprocessamento */}
        {reportLast && (
          <div className="bg-card border border-border rounded-xl p-4 space-y-1.5">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Último reprocessamento</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
              <p>Verificados: <strong>{reportLast.checked}</strong></p>
              <p>Liquidados: <strong className="text-success">{reportLast.settled}</strong></p>
              <p>Não encontrados: <strong>{reportLast.not_found}</strong></p>
              <p>Mercado sem suporte: <strong className="text-warning">{reportLast.unsupported}</strong></p>
              <p>Placar salvo: <strong>{reportLast.scores_saved_only}</strong></p>
            </div>
            {reportLast.unsupported > 0 && (
              <p className="text-xs text-muted-foreground">
                Mercados sem suporte automático mostram o placar final na lista — liquide manualmente em <button className="text-primary underline" onClick={() => navigate('/apostas')}>/apostas</button>.
              </p>
            )}
          </div>
        )}

        {/* Filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(['all','yesterday','pending','green','red'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'yesterday' ? 'Ontem' : f === 'pending' ? 'Pendentes' : f === 'green' ? 'Greens' : 'Reds'}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Nenhuma aposta encontrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(b => (
                <div key={`${b.source}-${b.id}`} className="p-3 flex items-center gap-3 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${b.source === 'horus' ? 'bg-primary/15 text-primary' : 'bg-warning/15 text-warning'}`}>
                    {b.source === 'horus' ? 'HÓRUS' : 'MANUAL'}
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-medium truncate">{b.match_name || b.match_id || '—'}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.market} • odd {Number(b.odd).toFixed(2)} • stake {Number(b.stake).toFixed(2)}</p>
                  </div>
                  <div className="text-xs text-muted-foreground hidden sm:block">{fmtDate(b.commence_time || b.created_at)}</div>
                  {statusBadge(b)}
                  {b.profit_loss != null && b.result && (
                    <span className={`text-xs font-mono font-semibold ${Number(b.profit_loss) >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {Number(b.profit_loss) >= 0 ? '+' : ''}{Number(b.profit_loss).toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Mostrando até {PAGE_SIZE} apostas por origem. O reprocessamento varre análises Punter ainda não liquidadas (jogos terminados há 2h+).
        </p>
      </main>
    </div>
  );
}
