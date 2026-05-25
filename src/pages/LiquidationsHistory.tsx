import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, CheckCircle2, XCircle, Trophy, CalendarIcon, Filter,
  ChevronLeft, ChevronRight, Info, Clock, Download, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface SettledBet {
  id: string;
  match_name: string;
  market: string;
  odd: number;
  stake: number;
  status: string;
  profit_loss: number | null;
  score_home: number | null;
  score_away: number | null;
  settled_at: string | null;
  cashout_value: number | null;
  cashed_out_at: string | null;
}

type ResultFilter = 'all' | 'gren' | 'red' | 'cashout';

const PAGE_SIZE = 20;

function explainOutcome(bet: SettledBet): string {
  const score = bet.score_home != null && bet.score_away != null
    ? `Placar final ${bet.score_home}×${bet.score_away}.`
    : 'Liquidação registrada sem placar disponível.';

  if (bet.status === 'cashout') {
    return `${score} Você (ou o auto) executou o CASH OUT antes do fim, garantindo R$ ${(bet.cashout_value ?? bet.stake).toFixed(2)} e encerrando a posição na hora.`;
  }
  if (bet.status === 'won') {
    const pnl = bet.profit_loss ?? (bet.stake * bet.odd - bet.stake);
    return `${score} O mercado "${bet.market}" foi ATINGIDO ao final do jogo, então a entrada foi marcada como GREN com lucro de R$ ${pnl.toFixed(2)}.`;
  }
  return `${score} O mercado "${bet.market}" NÃO foi atingido ao final, então a entrada foi marcada como RED com perda de R$ ${bet.stake.toFixed(2)}.`;
}

export default function LiquidationsHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [bets, setBets] = useState<SettledBet[]>([]);
  const [loading, setLoading] = useState(true);

  // PDF export dialog state
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const defaultName = (user?.user_metadata?.full_name as string) || user?.email || '';
  const [pdfOwnerName, setPdfOwnerName] = useState<string>(() => {
    return localStorage.getItem('liquidations_pdf_owner_name') || '';
  });
  const [pdfTimestamp, setPdfTimestamp] = useState<string>('');
  useEffect(() => {
    if (!pdfOwnerName && defaultName) setPdfOwnerName(defaultName);
  }, [defaultName]);

  // Hydrate state from URL
  const filter = (searchParams.get('result') as ResultFilter) || 'all';
  const dateFromStr = searchParams.get('from');
  const dateToStr = searchParams.get('to');
  const dateFrom = dateFromStr ? new Date(dateFromStr) : undefined;
  const dateTo = dateToStr ? new Date(dateToStr) : undefined;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    });
    setSearchParams(next, { replace: true });
  };

  const setFilter = (v: ResultFilter) => updateParams({ result: v === 'all' ? null : v, page: null });
  const setDateFrom = (d: Date | undefined) => updateParams({ from: d ? d.toISOString().slice(0, 10) : null, page: null });
  const setDateTo = (d: Date | undefined) => updateParams({ to: d ? d.toISOString().slice(0, 10) : null, page: null });
  const setPage = (updater: number | ((p: number) => number)) => {
    const next = typeof updater === 'function' ? updater(page) : updater;
    updateParams({ page: next === 1 ? null : String(next) });
  };

  useEffect(() => {
    if (!user) return;

    async function fetchAll() {
      setLoading(true);
      const { data } = await supabase
        .from('virtual_bets')
        .select('id, match_name, market, odd, stake, status, profit_loss, score_home, score_away, settled_at, cashout_value, cashed_out_at')
        .eq('user_id', user!.id)
        .in('status', ['won', 'lost', 'cashout'])
        .order('settled_at', { ascending: false });

      setBets((data as any[] as SettledBet[]) || []);
      setLoading(false);
    }
    fetchAll();

    const channel = supabase
      .channel(`liquidations_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'virtual_bets', filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      // result filter
      if (filter === 'gren' && b.status !== 'won') return false;
      if (filter === 'red' && b.status !== 'lost') return false;
      if (filter === 'cashout' && b.status !== 'cashout') return false;

      // date filter (uses settled_at or cashed_out_at)
      const ts = b.settled_at || b.cashed_out_at;
      if (!ts) return false;
      const t = new Date(ts).getTime();
      if (dateFrom && t < dateFrom.setHours(0, 0, 0, 0)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (t > end.getTime()) return false;
      }
      return true;
    });
  }, [bets, filter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Page is now URL-driven; setters above already reset to page 1 when filters change.

  // Stats summary
  const stats = useMemo(() => {
    const gren = filtered.filter(b => b.status === 'won').length;
    const red = filtered.filter(b => b.status === 'lost').length;
    const co = filtered.filter(b => b.status === 'cashout').length;
    const pnl = filtered.reduce((sum, b) => sum + (Number(b.profit_loss) || 0), 0);
    return { gren, red, co, pnl };
  }, [filtered]);

  function exportCSV() {
    if (filtered.length === 0) {
      toast.error('Nenhuma liquidação para exportar.');
      return;
    }
    const statusLabel = (s: string) => s === 'won' ? 'GREN' : s === 'lost' ? 'RED' : 'CASH OUT';
    const escape = (v: any) => {
      const s = v == null ? '' : String(v);
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['Data', 'Partida', 'Mercado', 'Odd', 'Status', 'Placar', 'Stake (R$)', 'P&L (R$)'];
    const rows = filtered.map(b => {
      const ts = b.settled_at || b.cashed_out_at;
      const date = ts ? format(new Date(ts), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '';
      const score = b.score_home != null && b.score_away != null ? `${b.score_home}x${b.score_away}` : '';
      const pnl = b.profit_loss ?? (b.status === 'won' ? b.stake * b.odd - b.stake : b.status === 'lost' ? -b.stake : 0);
      return [date, b.match_name, b.market, Number(b.odd).toFixed(2), statusLabel(b.status), score, Number(b.stake).toFixed(2), Number(pnl).toFixed(2)];
    });
    const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(escape).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `liquidacoes_${format(new Date(), 'yyyy-MM-dd_HHmm')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} liquidações exportadas.`);
  }

  async function exportPDF(opts?: { ownerName?: string; timestamp?: Date }) {
    if (filtered.length === 0) {
      toast.error('Nenhuma liquidação para exportar.');
      return;
    }
    const ownerName = (opts?.ownerName ?? pdfOwnerName ?? defaultName ?? '').trim();
    const ts = opts?.timestamp ?? new Date();

    const [{ default: jsPDF }, autoTableMod] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const autoTable = (autoTableMod as any).default || (autoTableMod as any);

    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Histórico de Liquidações', 40, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110);

    if (ownerName) {
      doc.text(`Titular: ${ownerName}`, 40, 66);
      doc.text(`Carimbo: ${format(ts, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, 40, 80);
    } else {
      doc.text(`Carimbo: ${format(ts, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`, 40, 66);
    }

    const filterParts: string[] = [];
    filterParts.push(`Resultado: ${filter === 'all' ? 'Todos' : filter === 'gren' ? 'GREN' : filter === 'red' ? 'RED' : 'Cash Out'}`);
    if (dateFrom) filterParts.push(`De: ${format(dateFrom, 'dd/MM/yyyy', { locale: ptBR })}`);
    if (dateTo) filterParts.push(`Até: ${format(dateTo, 'dd/MM/yyyy', { locale: ptBR })}`);
    doc.text(filterParts.join('   |   '), 40, ownerName ? 94 : 80);

    const resumoY = ownerName ? 124 : 110;
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Resumo', 40, resumoY);

    const summary = [
      ['Total', String(filtered.length)],
      ['GREN', String(stats.gren)],
      ['RED', String(stats.red)],
      ['CASH OUT', String(stats.co)],
      ['P&L Total', `${stats.pnl >= 0 ? '+' : ''}R$ ${stats.pnl.toFixed(2)}`],
    ];
    autoTable(doc, {
      startY: resumoY + 8,
      head: [['Métrica', 'Valor']],
      body: summary,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [30, 30, 40], textColor: 255 },
      columnStyles: { 0: { cellWidth: 120, fontStyle: 'bold' }, 1: { cellWidth: 120 } },
      margin: { left: 40 },
    });

    // ─── Distribution chart (GREN / RED / CASH OUT + P&L total) ───
    const chartTop = (doc as any).lastAutoTable.finalY + 24;
    const chartLeft = 300; // sits to the right of the summary table
    const chartW = pageW - chartLeft - 40;
    const chartH = 130;
    const baselineY = chartTop + chartH - 28; // leave room for x-labels
    const titleY = chartTop - 6;

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text('Distribuição de Resultados', chartLeft, titleY);

    // Chart frame
    doc.setDrawColor(220);
    doc.setLineWidth(0.5);
    doc.line(chartLeft, baselineY, chartLeft + chartW, baselineY); // x-axis
    doc.line(chartLeft, chartTop + 4, chartLeft, baselineY); // y-axis

    const bars: { label: string; value: number; color: [number, number, number] }[] = [
      { label: 'GREN', value: stats.gren, color: [16, 122, 87] },
      { label: 'RED', value: stats.red, color: [185, 28, 28] },
      { label: 'CASH OUT', value: stats.co, color: [30, 64, 175] },
    ];
    const maxVal = Math.max(1, ...bars.map(b => b.value));
    const maxBarH = baselineY - chartTop - 10;
    const slotW = chartW / bars.length;
    const barW = slotW * 0.55;

    bars.forEach((b, i) => {
      const x = chartLeft + i * slotW + (slotW - barW) / 2;
      const h = (b.value / maxVal) * maxBarH;
      const y = baselineY - h;
      doc.setFillColor(b.color[0], b.color[1], b.color[2]);
      doc.rect(x, y, barW, h, 'F');

      // value above bar
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(b.color[0], b.color[1], b.color[2]);
      doc.text(String(b.value), x + barW / 2, y - 3, { align: 'center' });

      // label below
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80);
      doc.text(b.label, x + barW / 2, baselineY + 12, { align: 'center' });

      // percentage
      const total = bars.reduce((s, x) => s + x.value, 0) || 1;
      const pct = ((b.value / total) * 100).toFixed(0) + '%';
      doc.setTextColor(140);
      doc.setFontSize(7);
      doc.text(pct, x + barW / 2, baselineY + 22, { align: 'center' });
    });

    // P&L total banner under the chart
    const pnlY = chartTop + chartH + 8;
    const pnlColor: [number, number, number] = stats.pnl >= 0 ? [16, 122, 87] : [185, 28, 28];
    doc.setFillColor(pnlColor[0], pnlColor[1], pnlColor[2]);
    doc.setDrawColor(pnlColor[0], pnlColor[1], pnlColor[2]);
    doc.roundedRect(chartLeft, pnlY, chartW, 28, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255);
    doc.text('P&L TOTAL DO PERÍODO', chartLeft + 10, pnlY + 12);
    doc.setFontSize(13);
    doc.text(
      `${stats.pnl >= 0 ? '+' : ''}R$ ${stats.pnl.toFixed(2)}`,
      chartLeft + chartW - 10,
      pnlY + 19,
      { align: 'right' }
    );

    // Reset text color before continuing
    doc.setTextColor(20);

    const statusLabel = (s: string) => s === 'won' ? 'GREN' : s === 'lost' ? 'RED' : 'CASH OUT';
    const rows = filtered.map(b => {
      const ts = b.settled_at || b.cashed_out_at;
      const date = ts ? format(new Date(ts), 'dd/MM/yy HH:mm', { locale: ptBR }) : '-';
      const score = b.score_home != null && b.score_away != null ? `${b.score_home}x${b.score_away}` : '-';
      const pnl = b.profit_loss ?? (b.status === 'won' ? b.stake * b.odd - b.stake : b.status === 'lost' ? -b.stake : 0);
      return [
        date, b.match_name, b.market, Number(b.odd).toFixed(2),
        statusLabel(b.status), score,
        `R$ ${Number(b.stake).toFixed(2)}`,
        `${pnl >= 0 ? '+' : ''}R$ ${Number(pnl).toFixed(2)}`,
      ];
    });

    autoTable(doc, {
      startY: Math.max((doc as any).lastAutoTable.finalY + 20, pnlY + 28 + 20),
      head: [['Data', 'Partida', 'Mercado', 'Odd', 'Status', 'Placar', 'Stake', 'P&L']],
      body: rows,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
      headStyles: { fillColor: [30, 30, 40], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 65 }, 1: { cellWidth: 130 }, 2: { cellWidth: 90 },
        3: { cellWidth: 35, halign: 'right' },
        4: { cellWidth: 55, halign: 'center', fontStyle: 'bold' },
        5: { cellWidth: 40, halign: 'center' },
        6: { cellWidth: 55, halign: 'right' },
        7: { cellWidth: 60, halign: 'right' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
          const v = data.cell.raw;
          if (v === 'GREN') data.cell.styles.textColor = [16, 122, 87];
          else if (v === 'RED') data.cell.styles.textColor = [185, 28, 28];
          else if (v === 'CASH OUT') data.cell.styles.textColor = [30, 64, 175];
        }
        if (data.section === 'body' && data.column.index === 7) {
          const v = String(data.cell.raw);
          if (v.startsWith('+')) data.cell.styles.textColor = [16, 122, 87];
          else if (v.startsWith('-')) data.cell.styles.textColor = [185, 28, 28];
        }
      },
      margin: { left: 40, right: 40 },
    });

    const pageCount = doc.getNumberOfPages();
    const footerLeft = ownerName
      ? `Documento emitido por ${ownerName} • ${format(ts, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}`
      : `Carimbo: ${format(ts, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}`;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(140);
      const pageH = doc.internal.pageSize.getHeight();
      doc.text(footerLeft, 40, pageH - 20);
      doc.text(`Página ${i} de ${pageCount}`, pageW - 40, pageH - 20, { align: 'right' });
    }

    const ownerSlug = ownerName ? '_' + ownerName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) : '';
    doc.save(`liquidacoes${ownerSlug}_${format(ts, 'yyyy-MM-dd_HHmm')}.pdf`);
    toast.success(`PDF gerado com ${filtered.length} liquidações.`);
  }

  function openPdfDialog() {
    if (filtered.length === 0) {
      toast.error('Nenhuma liquidação para exportar.');
      return;
    }
    if (!pdfOwnerName && defaultName) setPdfOwnerName(defaultName);
    const now = new Date();
    const tzOffsetMin = now.getTimezoneOffset();
    const localIso = new Date(now.getTime() - tzOffsetMin * 60000).toISOString().slice(0, 16);
    setPdfTimestamp(localIso);
    setPdfDialogOpen(true);
  }

  function confirmPdfExport() {
    const trimmedName = pdfOwnerName.trim();
    if (trimmedName) localStorage.setItem('liquidations_pdf_owner_name', trimmedName);
    else localStorage.removeItem('liquidations_pdf_owner_name');
    const ts = pdfTimestamp ? new Date(pdfTimestamp) : new Date();
    setPdfDialogOpen(false);
    exportPDF({ ownerName: trimmedName, timestamp: isNaN(ts.getTime()) ? new Date() : ts });
  }
  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b border-border bg-card/40 backdrop-blur-sm sticky top-0 z-20">
          <div className="container mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/arena-trader-sports')}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <h1 className="font-orbitron text-base font-bold text-foreground uppercase tracking-wide">
              Histórico de Liquidações
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={exportCSV}
                disabled={filtered.length === 0}
                className="text-xs"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={openPdfDialog}
                disabled={filtered.length === 0}
                className="text-xs"
              >
                <FileText className="w-3.5 h-3.5 mr-1" />
                PDF
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 py-5 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-success/30 bg-success/5 rounded-xl p-3">
              <p className="text-[10px] font-orbitron uppercase text-muted-foreground">GREN</p>
              <p className="text-2xl font-black font-orbitron text-success">{stats.gren}</p>
            </div>
            <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-3">
              <p className="text-[10px] font-orbitron uppercase text-muted-foreground">RED</p>
              <p className="text-2xl font-black font-orbitron text-destructive">{stats.red}</p>
            </div>
            <div className="border border-primary/30 bg-primary/5 rounded-xl p-3">
              <p className="text-[10px] font-orbitron uppercase text-muted-foreground">Cash Out</p>
              <p className="text-2xl font-black font-orbitron text-primary">{stats.co}</p>
            </div>
            <div className={cn(
              'border rounded-xl p-3',
              stats.pnl >= 0 ? 'border-success/30 bg-success/5' : 'border-destructive/30 bg-destructive/5'
            )}>
              <p className="text-[10px] font-orbitron uppercase text-muted-foreground">Resultado</p>
              <p className={cn('text-2xl font-black font-orbitron', stats.pnl >= 0 ? 'text-success' : 'text-destructive')}>
                {stats.pnl >= 0 ? '+' : ''}R$ {stats.pnl.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as ResultFilter)}>
              <TabsList>
                <TabsTrigger value="all"><Filter className="w-3 h-3 mr-1" /> Todos</TabsTrigger>
                <TabsTrigger value="gren" className="data-[state=active]:bg-success data-[state=active]:text-success-foreground">GREN</TabsTrigger>
                <TabsTrigger value="red" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground">RED</TabsTrigger>
                <TabsTrigger value="cashout" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Cash Out</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('text-xs', !dateFrom && 'text-muted-foreground')}>
                    <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                    {dateFrom ? format(dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn('text-xs', !dateTo && 'text-muted-foreground')}>
                    <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                    {dateTo ? format(dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn('p-3 pointer-events-auto')} />
                </PopoverContent>
              </Popover>

              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="text-center py-16 text-muted-foreground text-sm">Carregando...</div>
          ) : pageItems.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border rounded-xl">
              <p className="text-muted-foreground text-sm">Nenhuma liquidação encontrada para os filtros selecionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {pageItems.map((bet) => {
                  const isWon = bet.status === 'won';
                  const isCashout = bet.status === 'cashout';
                  const pnl = bet.profit_loss ?? (isWon ? bet.stake * bet.odd - bet.stake : -bet.stake);
                  const isProfit = pnl >= 0;
                  const label = isCashout ? 'CASH OUT' : isWon ? 'GREN' : 'RED';
                  const labelColor = isCashout ? 'bg-primary text-primary-foreground' : isWon ? 'bg-success text-success-foreground' : 'bg-destructive text-destructive-foreground';
                  const borderColor = isCashout ? 'border-primary/40 bg-primary/5' : isWon ? 'border-success/40 bg-success/5' : 'border-destructive/40 bg-destructive/5';
                  const hasScore = bet.score_home != null && bet.score_away != null;
                  const ts = bet.settled_at || bet.cashed_out_at;

                  return (
                    <motion.div
                      key={bet.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn('border rounded-xl p-4 space-y-3', borderColor)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-orbitron text-xs font-bold text-foreground truncate">{bet.match_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{bet.market} @ {Number(bet.odd).toFixed(2)}</p>
                        </div>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-md font-orbitron text-[11px] font-black uppercase tracking-wider shadow-sm cursor-help',
                              labelColor
                            )}>
                              {isWon ? <CheckCircle2 className="w-3 h-3" /> : isCashout ? <Trophy className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                              {label}
                              <Info className="w-3 h-3 opacity-70 ml-0.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
                            {explainOutcome(bet)}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {hasScore && (
                        <div className="flex items-center justify-center gap-3 bg-background/60 rounded-lg py-2">
                          <span className="text-[10px] uppercase text-muted-foreground font-orbitron">Placar Final</span>
                          <span className="font-orbitron text-2xl font-black text-foreground tabular-nums">
                            {bet.score_home} <span className="text-muted-foreground mx-1">×</span> {bet.score_away}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-[10px] uppercase text-muted-foreground font-orbitron">Resultado</p>
                          <p className={cn('text-lg font-black font-orbitron', isProfit ? 'text-success' : 'text-destructive')}>
                            {isProfit ? '+' : ''}R$ {Math.abs(pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] uppercase text-muted-foreground font-orbitron">Stake</p>
                          <p className="text-sm text-muted-foreground font-orbitron">
                            R$ {Number(bet.stake).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {ts && (
                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {format(new Date(ts), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                <ChevronLeft className="w-4 h-4" /> Anterior
              </Button>
              <span className="text-xs font-orbitron text-muted-foreground px-2">
                Página {currentPage} de {totalPages} · {filtered.length} resultados
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Próxima <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        <Dialog open={pdfDialogOpen} onOpenChange={setPdfDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-orbitron">Exportar PDF</DialogTitle>
              <DialogDescription>
                Personalize o titular e o carimbo de data/hora que aparecerão no documento. As preferências ficam salvas para próximas exportações.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="pdf-owner" className="text-xs uppercase tracking-wide">
                  Titular / Identificador
                </Label>
                <Input
                  id="pdf-owner"
                  value={pdfOwnerName}
                  onChange={(e) => setPdfOwnerName(e.target.value)}
                  placeholder={defaultName || 'Seu nome ou apelido'}
                  maxLength={80}
                />
                <p className="text-[10px] text-muted-foreground">
                  Aparece no cabeçalho e em todas as páginas do PDF.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pdf-timestamp" className="text-xs uppercase tracking-wide">
                  Carimbo de data/hora
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="pdf-timestamp"
                    type="datetime-local"
                    value={pdfTimestamp}
                    onChange={(e) => setPdfTimestamp(e.target.value)}
                    step={1}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs shrink-0"
                    onClick={() => {
                      const now = new Date();
                      const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
                        .toISOString().slice(0, 16);
                      setPdfTimestamp(localIso);
                    }}
                  >
                    Agora
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Use "Agora" para o instante atual ou ajuste manualmente.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setPdfDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmPdfExport}>
                <FileText className="w-4 h-4 mr-1" />
                Gerar PDF
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
