import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database } from 'lucide-react';

export default function FutoddsProbe() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('futodds-probe', { body: {} });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          Futodds API — Discovery (Fase 0)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Chama os 7 endpoints da Futodds e mostra status, latência, headers de rate-limit e amostra de schema.
          Use para decidir se a API substitui Sportmonks / The Odds API / API-Football antes da Fase 1.
        </p>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Rodar probe
        </Button>

        {error && (
          <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 p-3 rounded">
            Erro: {error}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="text-xs">
              <strong>Base detectada:</strong> {result.base ?? '—'}
              {' '}<Badge variant={result.ok ? 'default' : 'destructive'}>{result.ok ? 'OK' : 'falhou'}</Badge>
            </div>

            {result.baseProbe && (
              <div className="border rounded p-3 text-xs">
                <div className="font-medium mb-1">Tentativas de base:</div>
                {result.baseProbe.map((b: any, i: number) => (
                  <div key={i} className="font-mono">
                    {b.base} → {b.status} ({b.ms}ms) {b.error ?? ''}
                  </div>
                ))}
              </div>
            )}

            {result.hint && (
              <div className="text-sm border border-yellow-500/30 bg-yellow-500/10 p-3 rounded">
                💡 {result.hint}
              </div>
            )}

            {result.probes && (
              <div className="space-y-2">
                {Object.entries(result.probes).map(([path, p]: any) => (
                  <div key={path} className="border rounded p-3">
                    <div className="flex justify-between items-center text-xs mb-1">
                      <span className="font-mono font-medium">{path}</span>
                      <span>
                        <Badge variant={p.status === 200 ? 'default' : 'destructive'}>{p.status}</Badge>
                        {' '}<span className="text-muted-foreground">{p.ms}ms</span>
                        {p.total_count != null ? <span className="ml-2 text-muted-foreground">{p.total_count} itens</span> : null}
                      </span>
                    </div>
                    {p.schema_keys?.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <strong>chaves:</strong> {p.schema_keys.join(', ')}
                      </div>
                    )}
                    {p.sample && (
                      <pre className="text-[10px] mt-1 bg-muted p-2 rounded overflow-auto max-h-40">
                        {typeof p.sample === 'string' ? p.sample : JSON.stringify(p.sample, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {result.notes && (
              <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                {result.notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
