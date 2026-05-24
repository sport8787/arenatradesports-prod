import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Scale, ArrowUp, ArrowDown, Minus, Download } from 'lucide-react';

type ViewMode = 'table' | 'sideBySide';

function DeltaPill({ value, suffix = '', invert = false }: { value: number | null; suffix?: string; invert?: boolean }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const positive = invert ? value < 0 : value > 0;
  const neutral = value === 0;
  const cls = neutral
    ? 'bg-muted text-muted-foreground'
    : positive
      ? 'bg-emerald-500/15 text-emerald-500'
      : 'bg-rose-500/15 text-rose-500';
  const Icon = neutral ? Minus : value > 0 ? ArrowUp : ArrowDown;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      <Icon className="w-3 h-3" />
      {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
    </span>
  );
}

interface Row {
  fonte: string;
  aprovados: number;
  green: number;
  red: number;
  pendentes: number;
  odd_media: number | null;
  pl_total: number | null;
  stake_total: number | null;
  hit_rate_pct: number | null;
  roi_pct: number | null;
}

type Period = 'today' | 'yesterday' | '7d' | '14d' | '30d';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  '7d': '7 dias',
  '14d': '14 dias',
  '30d': '30 dias',
};

function getBrasiliaNow(): Date {
  const now = new Date();
  const brasiliaOffset = now.getTimezoneOffset() + 180; // UTC → UTC-3
  return new Date(now.getTime() - brasiliaOffset * 60 * 1000);
}

function getDateRangeText(period: Period): string {
  const now = getBrasiliaNow();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  let start = new Date(now);
  switch (period) {
    case 'today':
      return `${fmt(now)} (hoje)`;
    case 'yesterday':
      start.setDate(start.getDate() - 1);
      return `${fmt(start)} (ontem)`;
    case '7d':
      start.setDate(start.getDate() - 6);
      return `${fmt(start)} – ${fmt(now)}`;
    case '14d':
      start.setDate(start.getDate() - 13);
      return `${fmt(start)} – ${fmt(now)}`;
    case '30d':
      start.setDate(start.getDate() - 29);
      return `${fmt(start)} – ${fmt(now)}`;
    default:
      return '';
  }
}

// Mesma chave usada em /arena-trader-sports/sinais-liquidados — mantém o recorte sincronizado.
const STORAGE_KEY = 'live_sinais_filters_v1';

const fmt = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? '—' : Number(n).toFixed(d);

function normalizePeriod(value: string | null | undefined): Period {
  if (value === 'today' || value === 'yesterday' || value === '7d' || value === '14d' || value === '30d') return value;
  return '30d';
}

function readPersistedPeriod(): Period {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizePeriod(parsed?.period);
    }
  } catch {}
  return '30d';
}

export default function ComparativoDetVsIaTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(
    normalizePeriod(searchParams.get('period') || readPersistedPeriod()),
  );
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem('cmp_det_ia_mode');
      return v === 'sideBySide' ? 'sideBySide' : 'table';
    } catch { return 'table'; }
  });

  useEffect(() => {
    try { localStorage.setItem('cmp_det_ia_mode', mode); } catch {}
  }, [mode]);

  // Sincroniza period com URL + localStorage (mesma convenção da página de Sinais Liquidados).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (next.get('period') !== period) {
      next.set('period', period);
      setSearchParams(next, { replace: true });
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, period }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('compare_det_vs_ia' as any, { _period: period });
    if (!error && data) {
      setRows(data as unknown as Row[]);
      setUpdatedAt(new Date());
    }
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const det = rows.find(r => r.fonte?.toLowerCase().includes('deter'));
  const ia = rows.find(r => r.fonte?.toLowerCase().includes('ia'));

  // Deltas IA − Det (IA é a referência da estratégia). Positivo = IA superior.
  const deltaRoi = det && ia && det.roi_pct !== null && ia.roi_pct !== null
    ? Number(ia.roi_pct) - Number(det.roi_pct) : null;
  const deltaHit = det && ia && det.hit_rate_pct !== null && ia.hit_rate_pct !== null
    ? Number(ia.hit_rate_pct) - Number(det.hit_rate_pct) : null;
  const deltaPl = det && ia && det.pl_total !== null && ia.pl_total !== null
    ? Number(ia.pl_total) - Number(det.pl_total) : null;
  const deltaOdd = det && ia && det.odd_media !== null && ia.odd_media !== null
    ? Number(ia.odd_media) - Number(det.odd_media) : null;

  const handleExportCsv = useCallback(async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc('compare_det_vs_ia_export' as any, { _period: period });
      if (error || !data || !Array.isArray(data)) {
        alert('Erro ao buscar dados para exportação.');
        return;
      }
      const rows = data as Array<{
        fonte: string; data_evento: string; league: string; home_team: string;
        away_team: string; market: string; odd: number | null; result: string | null;
        profit_loss: number | null; verdict: string | null;
      }>;

      const escape = (v: string | number | null | undefined) => {
        const s = v == null ? '' : String(v).replace(/"/g, '""');
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
      };

      const headers = ['Fonte','Data','Liga','Casa','Fora','Mercado','Odd','Resultado','P/L (u)','Veredicto'];
      const csv = [
        headers.join(','),
        ...rows.map(r => [
          escape(r.fonte),
          escape(r.data_evento ? new Date(r.data_evento).toLocaleString('pt-BR') : ''),
          escape(r.league),
          escape(r.home_team),
          escape(r.away_team),
          escape(r.market),
          escape(r.odd),
          escape(r.result),
          escape(r.profit_loss),
          escape(r.verdict),
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `auditoria_det_vs_ia_${period}_${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }, [period]);

  return (
    <div className="space-y-4">
      <Card className="p-4 border-violet-500/30">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Scale className="w-4 h-4 text-violet-500" />
            <div>
              <h3 className="font-semibold">
                Determinístico × IA — Trader Sports
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Período: <span className="font-medium text-foreground">{getDateRangeText(period)}</span>
                {updatedAt && (
                  <span className="ml-2">
                    · Última atualização:{' '}
                    <span className="font-medium text-foreground">
                      {updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant={mode === 'table' ? 'default' : 'outline'} onClick={() => setMode('table')}>
              Tabela
            </Button>
            <Button size="sm" variant={mode === 'sideBySide' ? 'default' : 'outline'} onClick={() => setMode('sideBySide')}>
              Lado a Lado
            </Button>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportCsv} disabled={exporting}>
              <Download className={`w-3 h-3 mr-1 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exportando…' : 'Exportar CSV'}
            </Button>
          </div>
        </div>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="mb-3">
          <TabsList className="grid grid-cols-5 w-full max-w-md">
            <TabsTrigger value="today">Hoje</TabsTrigger>
            <TabsTrigger value="yesterday">Ontem</TabsTrigger>
            <TabsTrigger value="7d">7 dias</TabsTrigger>
            <TabsTrigger value="14d">14 dias</TabsTrigger>
            <TabsTrigger value="30d">30 dias</TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-xs text-muted-foreground mb-3">
          Fonte: RPC <code className="text-[10px] bg-secondary px-1 rounded">compare_det_vs_ia(_period)</code> —
          mesmo recorte (Brasília) usado em <strong>Sinais Liquidados</strong>. Determinístico ={' '}
          <code className="text-[10px]">live_sinais</code> filtrado pelos mesmos mercados normalizados da IA
          (apples-to-apples — universo da IA é a referência) · IA ={' '}
          <code className="text-[10px]">mycroft_analyses_shadow_ai</code>.
        </p>

        {mode === 'table' ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fonte</TableHead>
                  <TableHead className="text-right">Aprov.</TableHead>
                  <TableHead className="text-right text-emerald-500">🟢</TableHead>
                  <TableHead className="text-right text-rose-500">🔴</TableHead>
                  <TableHead className="text-right">Pend.</TableHead>
                  <TableHead className="text-right">Hit %</TableHead>
                  <TableHead className="text-right">Odd média</TableHead>
                  <TableHead className="text-right">P/L (u)</TableHead>
                  <TableHead className="text-right">ROI %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[det, ia].filter(Boolean).map((r) => (
                  <TableRow key={r!.fonte}>
                    <TableCell className="font-medium">
                      {r!.fonte?.toLowerCase().includes('deter') ? '🧮 Determinístico' : '🤖 IA (Gemini)'}
                    </TableCell>
                    <TableCell className="text-right">{r!.aprovados}</TableCell>
                    <TableCell className="text-right text-emerald-500 font-semibold">{r!.green}</TableCell>
                    <TableCell className="text-right text-rose-500 font-semibold">{r!.red}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r!.pendentes}</TableCell>
                    <TableCell className="text-right">{fmt(r!.hit_rate_pct, 1)}%</TableCell>
                    <TableCell className="text-right">{fmt(r!.odd_media, 2)}</TableCell>
                    <TableCell className={`text-right font-semibold ${(r!.pl_total ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {(r!.pl_total ?? 0) >= 0 ? '+' : ''}{fmt(r!.pl_total, 2)}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${(r!.roi_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {(r!.roi_pct ?? 0) >= 0 ? '+' : ''}{fmt(r!.roi_pct, 1)}%
                    </TableCell>
                  </TableRow>
                ))}
                {/* Linha de diferença IA − Det com destaque percentual */}
                {det && ia && (
                  <TableRow className="bg-violet-500/5 border-t-2 border-violet-500/30">
                    <TableCell className="font-bold text-violet-500">Δ IA − Det</TableCell>
                    <TableCell className="text-right text-muted-foreground">{ia.aprovados - det.aprovados}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{ia.green - det.green}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{ia.red - det.red}</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right"><DeltaPill value={deltaHit} suffix="pp" /></TableCell>
                    <TableCell className="text-right"><DeltaPill value={deltaOdd} /></TableCell>
                    <TableCell className="text-right"><DeltaPill value={deltaPl} suffix="u" /></TableCell>
                    <TableCell className="text-right"><DeltaPill value={deltaRoi} suffix="%" /></TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-6">Sem dados.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          // Modo Lado a Lado — mesma janela (Hoje/30d), destaque no Δ%
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-stretch">
            {det ? (
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <div className="text-xs text-muted-foreground mb-1">🧮 Determinístico</div>
                <div className={`text-3xl font-bold tabular-nums ${(det.roi_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {(det.roi_pct ?? 0) >= 0 ? '+' : ''}{fmt(det.roi_pct, 1)}%
                </div>
                <div className="text-[11px] text-muted-foreground">ROI · {PERIOD_LABELS[period]}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div><span className="text-muted-foreground">Hit:</span> <span className="font-semibold">{fmt(det.hit_rate_pct, 1)}%</span></div>
                  <div><span className="text-muted-foreground">Odd:</span> <span className="font-semibold">{fmt(det.odd_media, 2)}</span></div>
                  <div><span className="text-muted-foreground">🟢:</span> <span className="text-emerald-500 font-semibold">{det.green}</span></div>
                  <div><span className="text-muted-foreground">🔴:</span> <span className="text-rose-500 font-semibold">{det.red}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Aprov.:</span> <span className="font-semibold">{det.aprovados}</span> · <span className="text-muted-foreground">P/L:</span> <span className={`font-semibold ${(det.pl_total ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{(det.pl_total ?? 0) >= 0 ? '+' : ''}{fmt(det.pl_total, 2)}u</span></div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground text-center">Sem dados Determinístico.</div>
            )}

            <div className="flex md:flex-col items-center justify-center gap-2 md:px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Δ IA − Det</div>
              <DeltaPill value={deltaRoi} suffix="%" />
              <div className="text-[10px] text-muted-foreground">ROI</div>
              <DeltaPill value={deltaHit} suffix="pp" />
              <div className="text-[10px] text-muted-foreground">Hit</div>
              <DeltaPill value={deltaPl} suffix="u" />
              <div className="text-[10px] text-muted-foreground">P/L</div>
            </div>

            {ia ? (
              <div className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-4">
                <div className="text-xs text-muted-foreground mb-1">🤖 IA (Gemini)</div>
                <div className={`text-3xl font-bold tabular-nums ${(ia.roi_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {(ia.roi_pct ?? 0) >= 0 ? '+' : ''}{fmt(ia.roi_pct, 1)}%
                </div>
                <div className="text-[11px] text-muted-foreground">ROI · {PERIOD_LABELS[period]}</div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div><span className="text-muted-foreground">Hit:</span> <span className="font-semibold">{fmt(ia.hit_rate_pct, 1)}%</span></div>
                  <div><span className="text-muted-foreground">Odd:</span> <span className="font-semibold">{fmt(ia.odd_media, 2)}</span></div>
                  <div><span className="text-muted-foreground">🟢:</span> <span className="text-emerald-500 font-semibold">{ia.green}</span></div>
                  <div><span className="text-muted-foreground">🔴:</span> <span className="text-rose-500 font-semibold">{ia.red}</span></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Aprov.:</span> <span className="font-semibold">{ia.aprovados}</span> · <span className="text-muted-foreground">P/L:</span> <span className={`font-semibold ${(ia.pl_total ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{(ia.pl_total ?? 0) >= 0 ? '+' : ''}{fmt(ia.pl_total, 2)}u</span></div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground text-center">Sem dados IA.</div>
            )}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          ⚠️ Amostras pequenas (&lt;30 liquidados/lado) ainda não são estatisticamente conclusivas. Use como
          tendência, não como veredito final.
        </p>
      </Card>
    </div>
  );
}
