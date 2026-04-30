import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap } from 'lucide-react';

export default function LiveProviderCompare() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('live-provider-compare', { body: {} });
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
          <Zap className="h-5 w-5 text-primary" />
          A/B: Sportmonks vs API-Football (admin)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Compara em paralelo as duas APIs de jogos ao vivo. Não afeta produção — só leitura.
          Use para validar o ID mapping antes de promover Sportmonks a primário (env <code>LIVE_PROVIDER_PRIMARY=sportmonks</code>).
        </p>
        <Button onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Rodar comparação ao vivo
        </Button>

        {error && (
          <div className="text-sm text-destructive border border-destructive/30 bg-destructive/10 p-3 rounded">
            Erro: {error}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground">Sportmonks</div>
                <div className="text-lg font-semibold">
                  {result.sportmonks?.ok ? `${result.sportmonks.count} jogos` : '—'}
                </div>
                <div className="text-xs">{result.sportmonks?.ms}ms {result.sportmonks?.error ? <Badge variant="destructive">{result.sportmonks.error}</Badge> : null}</div>
              </div>
              <div className="border rounded p-3">
                <div className="text-xs text-muted-foreground">API-Football</div>
                <div className="text-lg font-semibold">
                  {result.api_football?.ok ? `${result.api_football.count} jogos` : '—'}
                </div>
                <div className="text-xs">{result.api_football?.ms}ms {result.api_football?.error ? <Badge variant="destructive">{result.api_football.error}</Badge> : null}</div>
              </div>
            </div>

            <div className="text-sm">
              <strong>Match cruzado:</strong> {result.matched_count} jogos casados • Placar concorda: {result.score_agreement}
              <br />
              Só Sportmonks: {result.only_sportmonks} • Só API-Football: {result.only_api_football}
            </div>

            {result.sample?.length > 0 && (
              <div className="border rounded overflow-hidden">
                <div className="px-3 py-2 bg-muted text-xs font-medium">Amostra (até 20 jogos casados)</div>
                <div className="divide-y text-xs">
                  {result.sample.map((m: any, i: number) => (
                    <div key={i} className="px-3 py-2 flex justify-between gap-2">
                      <span className="truncate">{m.home} vs {m.away}</span>
                      <span className="font-mono">SM {m.sm_goals} ({m.sm_min}') | AF {m.af_goals} ({m.af_min}') {m.agree ? '✅' : '⚠️'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
