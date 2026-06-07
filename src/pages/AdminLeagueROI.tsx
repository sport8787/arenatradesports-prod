import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Row {
  championship: string;
  tier: string | null;
  enabled: boolean | null;
  before_total: number;
  before_green: number;
  before_red: number;
  before_hit_rate: number;
  before_roi: number;
  after_total: number;
  after_green: number;
  after_red: number;
  after_hit_rate: number;
  after_roi: number;
}

const DEFAULT_PIVOT = '2026-05-09';

export default function AdminLeagueROI() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [pivot, setPivot] = useState(DEFAULT_PIVOT);
  const [windowDays, setWindowDays] = useState(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState<'all' | 'A' | 'B' | 'C' | 'unknown'>('all');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('league_roi_before_after' as any, {
      p_pivot: new Date(pivot + 'T00:00:00Z').toISOString(),
      p_window_days: windowDays,
    });
    if (error) console.error(error);
    setRows((data as Row[]) || []);
    setLoading(false);
  };

  useEffect(() => { if (isAdmin) load(); /* eslint-disable-next-line */ }, [isAdmin]);

  const filtered = useMemo(() => {
    if (tierFilter === 'all') return rows;
    if (tierFilter === 'unknown') return rows.filter(r => !r.tier);
    return rows.filter(r => r.tier === tierFilter);
  }, [rows, tierFilter]);

  const totals = useMemo(() => {
    const acc = { bT: 0, bG: 0, bPL: 0, aT: 0, aG: 0, aPL: 0 };
    for (const r of filtered) {
      acc.bT += r.before_total; acc.bG += r.before_green;
      acc.bPL += Number(r.before_roi) * r.before_total;
      acc.aT += r.after_total; acc.aG += r.after_green;
      acc.aPL += Number(r.after_roi) * r.after_total;
    }
    return {
      bHit: acc.bT ? (acc.bG / acc.bT) * 100 : 0,
      bRoi: acc.bT ? (acc.bPL / acc.bT) * 100 : 0,
      aHit: acc.aT ? (acc.aG / acc.aT) * 100 : 0,
      aRoi: acc.aT ? (acc.aPL / acc.aT) * 100 : 0,
      bT: acc.bT, aT: acc.aT,
    };
  }, [filtered]);

  if (authLoading || adminLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth?redirect=/admin/league-roi" replace />;
  if (!isAdmin) return <Navigate to="/punter" replace />;

  const fmtPct = (n: number) => `${(Number(n) * 100).toFixed(1)}%`;
  const fmtRoi = (n: number) => {
    const v = Number(n) * 100;
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
  };
  const roiColor = (n: number) => Number(n) > 0 ? 'text-green-500' : Number(n) < 0 ? 'text-red-500' : 'text-muted-foreground';

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">📊 ROI por Liga — Antes vs Depois</h1>
            <p className="text-sm text-muted-foreground">Compara performance dos entradas APROVADO/LABAREDA antes e depois da data de corte. Use para validar o impacto da redução para Tier A.</p>
          </div>
          <Button asChild size="sm" variant="outline"><a href="/admin">← Admin</a></Button>
        </div>

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Data de corte</label>
            <Input type="date" value={pivot} onChange={(e) => setPivot(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Janela (dias antes/depois)</label>
            <Input type="number" min={1} max={120} value={windowDays} onChange={(e) => setWindowDays(parseInt(e.target.value) || 30)} className="w-28" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Tier</label>
            <select className="bg-background border rounded px-2 py-1 text-sm h-9" value={tierFilter} onChange={(e) => setTierFilter(e.target.value as any)}>
              <option value="all">Todos</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="unknown">Sem tier</option>
            </select>
          </div>
          <Button onClick={load} disabled={loading}>{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Atualizar'}</Button>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">ANTES — Hit Rate</div>
            <div className="text-2xl font-bold">{totals.bHit.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{totals.bT} entradas</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">ANTES — ROI</div>
            <div className={`text-2xl font-bold ${totals.bRoi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totals.bRoi >= 0 ? '+' : ''}{totals.bRoi.toFixed(2)}%
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">DEPOIS — Hit Rate</div>
            <div className="text-2xl font-bold">{totals.aHit.toFixed(1)}%</div>
            <div className="text-xs text-muted-foreground">{totals.aT} entradas</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">DEPOIS — ROI</div>
            <div className={`text-2xl font-bold ${totals.aRoi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totals.aRoi >= 0 ? '+' : ''}{totals.aRoi.toFixed(2)}%
            </div>
          </Card>
        </div>

        <Card className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Liga</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-center">Ativa</TableHead>
                <TableHead className="text-center" colSpan={3}>ANTES</TableHead>
                <TableHead className="text-center" colSpan={3}>DEPOIS</TableHead>
                <TableHead className="text-right">Δ ROI</TableHead>
              </TableRow>
              <TableRow>
                <TableHead></TableHead>
                <TableHead></TableHead>
                <TableHead></TableHead>
                <TableHead className="text-center">N</TableHead>
                <TableHead className="text-center">Hit</TableHead>
                <TableHead className="text-center">ROI</TableHead>
                <TableHead className="text-center">N</TableHead>
                <TableHead className="text-center">Hit</TableHead>
                <TableHead className="text-center">ROI</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const delta = (Number(r.after_roi) - Number(r.before_roi)) * 100;
                return (
                  <TableRow key={r.championship}>
                    <TableCell className="font-medium">{r.championship}</TableCell>
                    <TableCell>{r.tier || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{r.enabled === true ? '✅' : r.enabled === false ? '⛔' : '—'}</TableCell>
                    <TableCell className="text-center">{r.before_total}</TableCell>
                    <TableCell className="text-center">{r.before_total > 0 ? fmtPct(r.before_hit_rate) : '—'}</TableCell>
                    <TableCell className={`text-center ${roiColor(r.before_roi)}`}>{r.before_total > 0 ? fmtRoi(r.before_roi) : '—'}</TableCell>
                    <TableCell className="text-center">{r.after_total}</TableCell>
                    <TableCell className="text-center">{r.after_total > 0 ? fmtPct(r.after_hit_rate) : '—'}</TableCell>
                    <TableCell className={`text-center ${roiColor(r.after_roi)}`}>{r.after_total > 0 ? fmtRoi(r.after_roi) : '—'}</TableCell>
                    <TableCell className={`text-right font-semibold ${delta > 0 ? 'text-green-500' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {r.before_total > 0 && r.after_total > 0 ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}pp` : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && !loading && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sem dados na janela selecionada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
