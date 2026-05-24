import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { RefreshCw, Scale } from 'lucide-react';

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
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

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
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
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
                    {r!.fonte?.toLowerCase().includes('deter')
                      ? '🧮 Determinístico'
                      : '🤖 IA (Gemini)'}
                  </TableCell>
                  <TableCell className="text-right">{r!.aprovados}</TableCell>
                  <TableCell className="text-right text-emerald-500 font-semibold">{r!.green}</TableCell>
                  <TableCell className="text-right text-rose-500 font-semibold">{r!.red}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{r!.pendentes}</TableCell>
                  <TableCell className="text-right">{fmt(r!.hit_rate_pct, 1)}%</TableCell>
                  <TableCell className="text-right">{fmt(r!.odd_media, 2)}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      (r!.pl_total ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {(r!.pl_total ?? 0) >= 0 ? '+' : ''}
                    {fmt(r!.pl_total, 2)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-bold ${
                      (r!.roi_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}
                  >
                    {(r!.roi_pct ?? 0) >= 0 ? '+' : ''}
                    {fmt(r!.roi_pct, 1)}%
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    Sem dados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
          ⚠️ Amostras pequenas (&lt;30 liquidados/lado) ainda não são estatisticamente conclusivas. Use como
          tendência, não como veredito final.
        </p>
      </Card>
    </div>
  );
}
