import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle2, Clock, XCircle, Filter, Download, FileText, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { BetAuditDetailSheet, type AuditBetLite } from '@/components/punter/BetAuditDetailSheet';

type Source = 'horus' | 'manual';

interface BetRow extends AuditBetLite {
  source: Source;
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [bets, setBets] = useState<BetRow[]>([]);
  const [horusOffset, setHorusOffset] = useState(0);
  const [manualOffset, setManualOffset] = useState(0);
  const [horusHasMore, setHorusHasMore] = useState(true);
  const [manualHasMore, setManualHasMore] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'green' | 'red'>('all');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7d' | '30d' | 'all'>('all');
  const [reportLast, setReportLast] = useState<{ checked: number; settled: number; not_found: number; unsupported: number; scores_saved_only: number } | null>(null);
  const [selected, setSelected] = useState<BetRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPage = async (userId: string, hOff: number, mOff: number) => {
    const cols = 'id, match_id, match_name, market, odd, stake, status, result, profit_loss, score_home, score_away, commence_time, created_at';
    const [horusRes, manualRes] = await Promise.all([
      supabase.from('virtual_bets_punter')
        .select(cols + ', analysis_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(hOff, hOff + PAGE_SIZE - 1),
      supabase.from('virtual_bets_manual')
        .select(cols)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(mOff, mOff + PAGE_SIZE - 1),
    ]);
    const h = (horusRes.data || []).map((r: any) => ({ ...r, source: 'horus' as Source }));
    const m = (manualRes.data || []).map((r: any) => ({ ...r, source: 'manual' as Source, analysis_id: null }));
    return { h, m, horusHas: h.length === PAGE_SIZE, manualHas: m.length === PAGE_SIZE };
  };

  const loadInitial = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { h, m, horusHas, manualHas } = await fetchPage(user.id, 0, 0);
    const merged = [...h, ...m].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setBets(merged);
    setHorusOffset(h.length);
    setManualOffset(m.length);
    setHorusHasMore(horusHas);
    setManualHasMore(manualHas);
    setLoading(false);
  };

  const loadMore = async () => {
    if (loadingMore) return;
    if (!horusHasMore && !manualHasMore) return;
    setLoadingMore(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingMore(false); return; }
    const hOff = horusHasMore ? horusOffset : 9_999_999;
    const mOff = manualHasMore ? manualOffset : 9_999_999;
    const { h, m, horusHas, manualHas } = await fetchPage(user.id, hOff, mOff);
    setBets(prev => [...prev, ...h, ...m].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    if (horusHasMore) { setHorusOffset(o => o + h.length); setHorusHasMore(horusHas); }
    if (manualHasMore) { setManualOffset(o => o + m.length); setManualHasMore(manualHas); }
    setLoadingMore(false);
  };

  useEffect(() => { loadInitial(); }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0,0,0,0);
    const endToday = new Date(now); endToday.setHours(23,59,59,999);
    const startYesterday = new Date(startToday); startYesterday.setDate(startYesterday.getDate() - 1);
    const endYesterday = new Date(startYesterday); endYesterday.setHours(23,59,59,999);
    const start7d = new Date(startToday); start7d.setDate(start7d.getDate() - 6);
    const start30d = new Date(startToday); start30d.setDate(start30d.getDate() - 29);

    return bets.filter(b => {
      const r = (b.result || '').toLowerCase();
      if (filter === 'pending' && !(b.status === 'pending' && !r)) return false;
      if (filter === 'green' && !(r === 'green' || r === 'won' || r === 'win')) return false;
      if (filter === 'red' && !(r === 'red' || r === 'lost' || r === 'loss')) return false;
      if (dateRange !== 'all') {
        const ref = b.commence_time ? new Date(b.commence_time) : new Date(b.created_at);
        if (dateRange === 'today' && !(ref >= startToday && ref <= endToday)) return false;
        if (dateRange === 'yesterday' && !(ref >= startYesterday && ref <= endYesterday)) return false;
        if (dateRange === '7d' && !(ref >= start7d && ref <= endToday)) return false;
        if (dateRange === '30d' && !(ref >= start30d && ref <= endToday)) return false;
      }
      return true;
    });
  }, [bets, filter, dateRange]);

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
      toast({ title: 'Auditoria concluída', description: `Verificados: ${r.checked ?? 0} • Liquidados: ${r.settled ?? 0} • Sem suporte: ${r.unsupported ?? 0}` });
      await loadInitial();
    } catch (e: any) {
      toast({ title: 'Erro ao reprocessar', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setReprocessing(false);
    }
  };

  const exportCSV = () => {
    const header = ['Origem','Jogo','Mercado','Odd','Stake','Status','Resultado','Placar','P&L','Início','Criada em'];
    const rows = filtered.map(b => [
      b.source === 'horus' ? 'HÓRUS' : 'MANUAL',
      (b.match_name || b.match_id || '').replace(/"/g,'""'),
      b.market.replace(/"/g,'""'),
      Number(b.odd).toFixed(2),
      Number(b.stake).toFixed(2),
      b.status,
      (b.result || ''),
      b.score_home != null && b.score_away != null ? `${b.score_home}-${b.score_away}` : '',
      b.profit_loss != null ? Number(b.profit_loss).toFixed(2) : '',
      fmtDate(b.commence_time),
      fmtDate(b.created_at),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-punter-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado', description: `${filtered.length} entradas` });
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(14);
      doc.text('Auditoria Punter — Relatório de Entradas', 14, 14);
      doc.setFontSize(9);
      const periodLabel = ({today:'Hoje', yesterday:'Ontem', '7d':'Últimos 7d', '30d':'Últimos 30d', all:'Todos'} as any)[dateRange];
      const filterLabel = ({all:'Todas', pending:'Pendentes', green:'Greens', red:'Reds'} as any)[filter];
      doc.text(`Período: ${periodLabel} • Filtro: ${filterLabel} • Gerado: ${new Date().toLocaleString('pt-BR')}`, 14, 20);
      doc.text(`Total: ${filtered.length} • Greens: ${filtered.filter(b => ['green','won','win'].includes((b.result||'').toLowerCase())).length} • Reds: ${filtered.filter(b => ['red','lost','loss'].includes((b.result||'').toLowerCase())).length} • Pendentes: ${filtered.filter(b => b.status==='pending' && !b.result).length} • P&L: ${filtered.reduce((s,b)=>s+(Number(b.profit_loss)||0),0).toFixed(2)}`, 14, 25);

      autoTable(doc, {
        startY: 30,
        head: [['Origem','Jogo','Mercado','Odd','Stake','Status','Placar','P&L','Início']],
        body: filtered.map(b => [
          b.source === 'horus' ? 'HÓRUS' : 'MANUAL',
          (b.match_name || b.match_id || '').slice(0, 40),
          b.market.slice(0, 30),
          Number(b.odd).toFixed(2),
          Number(b.stake).toFixed(2),
          (b.result || b.status).toUpperCase(),
          b.score_home != null && b.score_away != null ? `${b.score_home}-${b.score_away}` : '—',
          b.profit_loss != null ? Number(b.profit_loss).toFixed(2) : '—',
          fmtDate(b.commence_time),
        ]),
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 30, 40], textColor: 255 },
      });

      doc.save(`auditoria-punter-${new Date().toISOString().slice(0,10)}.pdf`);
      toast({ title: 'PDF exportado', description: `${filtered.length} entradas` });
    } catch (e: any) {
      toast({ title: 'Erro ao exportar PDF', description: String(e?.message || e), variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const hasMore = horusHasMore || manualHasMore;

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
          </div>
        )}

        {/* Filtros de período */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-[10px] uppercase font-mono text-muted-foreground mr-1">Período:</span>
          {([
            ['today', 'Hoje'],
            ['yesterday', 'Ontem'],
            ['7d', 'Últimos 7d'],
            ['30d', 'Últimos 30d'],
            ['all', 'Todos'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setDateRange(key)}
              className={`px-3 py-1 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors ${
                dateRange === key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Filtros de resultado */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase font-mono text-muted-foreground mr-1 ml-6">Resultado:</span>
          {(['all','pending','green','red'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-mono uppercase tracking-wider border transition-colors ${
                filter === f ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : f === 'green' ? 'Greens' : 'Reds'}
            </button>
          ))}
        </div>

        {/* Resumo do período + ações de exportação */}
        <div className="bg-card/50 border border-border rounded-xl p-3 flex flex-wrap items-center gap-4 text-xs font-mono">
          <span>Exibindo: <strong>{filtered.length}</strong></span>
          <span className="text-success">Greens: <strong>{filtered.filter(b => ['green','won','win'].includes((b.result||'').toLowerCase())).length}</strong></span>
          <span className="text-destructive">Reds: <strong>{filtered.filter(b => ['red','lost','loss'].includes((b.result||'').toLowerCase())).length}</strong></span>
          <span className="text-warning">Pendentes: <strong>{filtered.filter(b => b.status === 'pending' && !b.result).length}</strong></span>
          <span>P&L: <strong className={filtered.reduce((s,b)=>s+(Number(b.profit_loss)||0),0) >= 0 ? 'text-success' : 'text-destructive'}>
            {filtered.reduce((s,b)=>s+(Number(b.profit_loss)||0),0).toFixed(2)}
          </strong></span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={!filtered.length} className="gap-1.5">
              <Download className="w-3.5 h-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportPDF} disabled={!filtered.length || exporting} className="gap-1.5">
              <FileText className="w-3.5 h-3.5" /> {exporting ? 'Gerando…' : 'PDF'}
            </Button>
          </div>
        </div>

        {/* Lista */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <p className="p-6 text-center text-muted-foreground">Carregando…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">Nenhuma entrada encontrada.</p>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map(b => (
                <button
                  key={`${b.source}-${b.id}`}
                  onClick={() => { setSelected(b); setSheetOpen(true); }}
                  className="w-full p-3 flex items-center gap-3 flex-wrap text-left hover:bg-muted/40 transition-colors"
                >
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
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Carregar mais */}
        {!loading && hasMore && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={loadMore} disabled={loadingMore} className="gap-2">
              <ChevronDown className={`w-4 h-4 ${loadingMore ? 'animate-bounce' : ''}`} />
              {loadingMore ? 'Carregando…' : `Carregar mais (${PAGE_SIZE} por origem)`}
            </Button>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground text-center">
          Total carregado: {bets.length} entradas. {!hasMore && 'Todas as entradas já foram carregadas.'} Clique em qualquer entrada para ver detalhes, eventos e ações sugeridas.
        </p>
      </main>

      <BetAuditDetailSheet
        bet={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={loadInitial}
      />
    </div>
  );
}
