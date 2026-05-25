import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface CLVRow {
  id: string;
  match_id: string;
  market: string;
  home_team: string | null;
  away_team: string | null;
  commence_time: string | null;
  open_mid_odd: number | null;
  close_mid_odd: number | null;
  clv_pp: number | null;
  open_edge_pp: number | null;
  bookmaker_odd: number | null;
  demoted_by_exchange: boolean | null;
  open_captured_at: string | null;
  close_captured_at: string | null;
}

interface BucketRow {
  league: string;
  market_family: string;
  odd_bucket: string;
  sample_size: number;
  hit_rate: number | null;
  roi_pct: number | null;
  brier_score: number | null;
  avg_clv_pp: number | null;
  updated_at: string;
}

interface QuarantineRow {
  league: string;
  market_family: string;
  odd_bucket: string;
  reason: string;
  expires_at: string;
}

function fmtPp(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}pp`;
}

function fmtPct(v: number | null | undefined) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  return `${(Number(v) * 100).toFixed(1)}%`;
}

export default function AdminCLVMonitor() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [clvRows, setClvRows] = useState<CLVRow[]>([]);
  const [buckets, setBuckets] = useState<BucketRow[]>([]);
  const [quarantine, setQuarantine] = useState<QuarantineRow[]>([]);
  const [summary, setSummary] = useState<{ avgClv: number; positive: number; negative: number; total: number } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: clv }, { data: bk }, { data: qr }] = await Promise.all([
        supabase
          .from('punter_clv_log' as any)
          .select('*')
          .not('clv_pp', 'is', null)
          .order('close_captured_at', { ascending: false })
          .limit(100),
        supabase
          .from('punter_bucket_calibration' as any)
          .select('*')
          .gte('sample_size', 5)
          .order('roi_pct', { ascending: true })
          .limit(50),
        supabase
          .from('punter_quarantine' as any)
          .select('*')
          .gt('expires_at', new Date().toISOString())
          .order('expires_at', { ascending: false })
          .limit(50),
      ]);

      const rows = (clv ?? []) as unknown as CLVRow[];
      setClvRows(rows);
      setBuckets((bk ?? []) as unknown as BucketRow[]);
      setQuarantine((qr ?? []) as unknown as QuarantineRow[]);

      if (rows.length > 0) {
        const valid = rows.filter((r) => r.clv_pp != null);
        const avg = valid.reduce((a, b) => a + Number(b.clv_pp), 0) / Math.max(1, valid.length);
        setSummary({
          avgClv: avg,
          positive: valid.filter((r) => Number(r.clv_pp) > 0).length,
          negative: valid.filter((r) => Number(r.clv_pp) < 0).length,
          total: valid.length,
        });
      } else {
        setSummary({ avgClv: 0, positive: 0, negative: 0, total: 0 });
      }
    } catch (e: any) {
      toast.error('Falha ao carregar CLV: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function triggerCapture() {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke('punter-clv-capture');
      if (error) throw error;
      toast.success(`Capturado: ${data?.captured ?? 0} | Skipped: ${data?.skipped ?? 0}`);
      await load();
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function recomputeBuckets() {
    setRefreshing(true);
    try {
      const { error: e1 } = await supabase.rpc('recompute_punter_buckets' as any);
      if (e1) throw e1;
      const { error: e2 } = await supabase.rpc('refresh_punter_quarantine' as any);
      if (e2) throw e2;
      toast.success('Buckets + quarentena recalculados');
      await load();
    } catch (e: any) {
      toast.error('Falha: ' + e.message);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (user && isAdmin) load();
  }, [user, isAdmin]);

  if (authLoading || adminLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/lobby" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/hub')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight flex-1">
            CLV MONITOR — PUNTER QUALITY
          </h1>
          <Button size="sm" variant="outline" onClick={triggerCapture} disabled={refreshing}>
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Capturar agora
          </Button>
          <Button size="sm" variant="outline" onClick={recomputeBuckets} disabled={refreshing}>
            Recalcular buckets
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-7xl space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">CLV Médio</CardTitle></CardHeader>
            <CardContent>
              <div className={`text-2xl font-mono font-bold ${(summary?.avgClv ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {fmtPp(summary?.avgClv ?? 0)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Entradas avaliados</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-mono font-bold">{summary?.total ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">CLV Positivo</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-mono font-bold text-emerald-500">{summary?.positive ?? 0}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">CLV Negativo</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-mono font-bold text-rose-500">{summary?.negative ?? 0}</div></CardContent>
          </Card>
        </div>

        {/* Quarantine */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Buckets em Quarentena ({quarantine.length})</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : quarantine.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum bucket em quarentena. 🟢</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground border-b">
                    <tr><th className="text-left py-2">Liga</th><th className="text-left">Mercado</th><th className="text-left">Bucket</th><th className="text-left">Motivo</th><th className="text-right">Expira</th></tr>
                  </thead>
                  <tbody>
                    {quarantine.map((q, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2">{q.league}</td>
                        <td><Badge variant="outline">{q.market_family}</Badge></td>
                        <td>{q.odd_bucket}</td>
                        <td className="text-rose-500">{q.reason}</td>
                        <td className="text-right text-muted-foreground">{new Date(q.expires_at).toLocaleDateString('pt-BR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Buckets piores */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Buckets — piores ROI (sample ≥ 5)</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : buckets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda. Execute "Recalcular buckets" após termos entradas com resultado GREEN/RED.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2">Liga</th><th className="text-left">Mercado</th><th className="text-left">Odd</th>
                      <th className="text-right">N</th><th className="text-right">Hit</th><th className="text-right">ROI</th>
                      <th className="text-right">Brier</th><th className="text-right">CLV méd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b, i) => (
                      <tr key={i} className="border-b border-border/30">
                        <td className="py-2">{b.league}</td>
                        <td><Badge variant="outline">{b.market_family}</Badge></td>
                        <td>{b.odd_bucket}</td>
                        <td className="text-right">{b.sample_size}</td>
                        <td className="text-right">{fmtPct(b.hit_rate)}</td>
                        <td className={`text-right ${Number(b.roi_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {b.roi_pct == null ? '—' : `${(Number(b.roi_pct) * 100).toFixed(1)}%`}
                        </td>
                        <td className="text-right">{b.brier_score == null ? '—' : Number(b.brier_score).toFixed(3)}</td>
                        <td className={`text-right ${Number(b.avg_clv_pp ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{fmtPp(b.avg_clv_pp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CLV recente */}
        <Card>
          <CardHeader><CardTitle className="text-sm">CLV Recente (100 últimos com closing)</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : clvRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aguardando primeiros closings (cron */5 min, captura 15min antes do kickoff).</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-2">Jogo</th><th className="text-left">Mercado</th>
                      <th className="text-right">Odd Book</th><th className="text-right">Open</th><th className="text-right">Close</th>
                      <th className="text-right">CLV</th><th className="text-right">Edge entrada</th><th className="text-right">Captura</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clvRows.map((r) => (
                      <tr key={r.id} className="border-b border-border/30">
                        <td className="py-2">{r.home_team} × {r.away_team}</td>
                        <td><Badge variant="outline">{r.market}</Badge></td>
                        <td className="text-right">{r.bookmaker_odd?.toFixed(2) ?? '—'}</td>
                        <td className="text-right">{r.open_mid_odd?.toFixed(3) ?? '—'}</td>
                        <td className="text-right">{r.close_mid_odd?.toFixed(3) ?? '—'}</td>
                        <td className={`text-right font-bold ${Number(r.clv_pp ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {fmtPp(r.clv_pp)}
                        </td>
                        <td className="text-right">{fmtPp(r.open_edge_pp)}</td>
                        <td className="text-right text-muted-foreground">
                          {r.close_captured_at ? new Date(r.close_captured_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
