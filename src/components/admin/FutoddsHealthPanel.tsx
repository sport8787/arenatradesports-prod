import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Activity, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EndpointSummary {
  endpoint: string;
  total: number;
  ok: number;
  err: number;
  error_rate: number;
  avg_latency_ms: number;
  max_latency_ms: number;
  min_latency_ms: number;
  leagues_covered: number;
  items_max: number;
  last_at: string | null;
}

interface HealthData {
  ok: boolean;
  window_minutes: number;
  samples: number;
  summary: EndpointSummary[];
  recent: any[];
}

const WINDOWS = [
  { label: '15min', value: 15 },
  { label: '1h', value: 60 },
  { label: '6h', value: 360 },
  { label: '24h', value: 1440 },
];

function latencyClass(ms: number): string {
  if (ms < 500) return 'text-success';
  if (ms < 1500) return 'text-warning';
  return 'text-destructive';
}

function errorClass(rate: number): string {
  if (rate === 0) return 'text-success';
  if (rate < 5) return 'text-warning';
  return 'text-destructive';
}

export default function FutoddsHealthPanel() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windowMin, setWindowMin] = useState(60);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke('futodds-health', {
        body: {},
        // pass window via query
      });
      // supabase.functions.invoke não suporta query nativa; usar fetch direto p/ query
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/futodds-health?minutes=${windowMin}`;
      const session = (await supabase.auth.getSession()).data.session;
      const r = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [windowMin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Futodds Health
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            {WINDOWS.map(w => (
              <button
                key={w.value}
                onClick={() => setWindowMin(w.value)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium transition-colors',
                  windowMin === w.value
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Latência, taxa de erro e cobertura de ligas dos endpoints Futodds nos últimos {windowMin} min.
          Atualiza a cada 30s. Auto-coletado por <code>_shared/futoddsCache</code> e <code>futodds-upcoming-cache</code>.
        </p>

        {error && (
          <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 p-3 rounded">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="text-xs text-muted-foreground">
              {data.samples} amostras • janela {data.window_minutes} min
            </div>

            {data.summary.length === 0 ? (
              <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-4 text-center">
                Sem amostras na janela selecionada.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="text-left py-2 px-2">Endpoint</th>
                      <th className="text-right py-2 px-2">Chamadas</th>
                      <th className="text-right py-2 px-2">Erro %</th>
                      <th className="text-right py-2 px-2">Lat. méd.</th>
                      <th className="text-right py-2 px-2">Lat. máx</th>
                      <th className="text-right py-2 px-2">Ligas</th>
                      <th className="text-right py-2 px-2">Itens</th>
                      <th className="text-right py-2 px-2">Última</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.summary.map(s => (
                      <tr key={s.endpoint} className="border-b border-border/50">
                        <td className="py-2 px-2 font-mono text-foreground">{s.endpoint}</td>
                        <td className="py-2 px-2 text-right">{s.total}</td>
                        <td className={cn('py-2 px-2 text-right font-bold', errorClass(s.error_rate))}>
                          {s.error_rate.toFixed(1)}%
                        </td>
                        <td className={cn('py-2 px-2 text-right font-bold', latencyClass(s.avg_latency_ms))}>
                          {s.avg_latency_ms} ms
                        </td>
                        <td className="py-2 px-2 text-right text-muted-foreground">{s.max_latency_ms} ms</td>
                        <td className="py-2 px-2 text-right">{s.leagues_covered || '—'}</td>
                        <td className="py-2 px-2 text-right">{s.items_max || '—'}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">
                          {s.last_at ? new Date(s.last_at).toLocaleTimeString('pt-BR') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.recent.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Últimas 50 chamadas
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="text-muted-foreground border-b border-border">
                      <tr>
                        <th className="text-left py-1 px-1">Hora</th>
                        <th className="text-left py-1 px-1">Endpoint</th>
                        <th className="text-right py-1 px-1">Status</th>
                        <th className="text-right py-1 px-1">ms</th>
                        <th className="text-right py-1 px-1">Itens</th>
                        <th className="text-left py-1 px-1">Erro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((r: any, i: number) => (
                        <tr key={i} className="border-b border-border/40">
                          <td className="py-1 px-1 text-muted-foreground">
                            {new Date(r.created_at).toLocaleTimeString('pt-BR')}
                          </td>
                          <td className="py-1 px-1 font-mono">{r.endpoint}</td>
                          <td className="py-1 px-1 text-right">
                            <Badge variant={r.ok ? 'default' : 'destructive'} className="text-[10px]">
                              {r.status_code ?? '-'}
                            </Badge>
                          </td>
                          <td className={cn('py-1 px-1 text-right', latencyClass(r.latency_ms ?? 0))}>
                            {r.latency_ms ?? '-'}
                          </td>
                          <td className="py-1 px-1 text-right">{r.items_count ?? '-'}</td>
                          <td className="py-1 px-1 text-destructive truncate max-w-[200px]">{r.error ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
