import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';

interface CopaSignal {
  id: string;
  created_at: string;
  home_team: string | null;
  away_team: string | null;
  league: string | null;
  market: string | null;
  odd: number | null;
  confidence: number | null;
  verdict: string | null;
  resultado: string | null;
  profit_loss: number | null;
  phase: string | null;
  ah_line: number | null;
  ve_pct: number | null;
  block: string | null;
}

const PHASE_LABEL: Record<string, string> = {
  grupos_j1: 'Grupos · J1',
  grupos_j2: 'Grupos · J2',
  grupos_j3: 'Grupos · J3',
  oitavas: 'Oitavas',
  quartas: 'Quartas',
  semi: 'Semifinal',
  '3lugar': '3º lugar',
  final: 'Final',
};

export default function PunterCopa() {
  const navigate = useNavigate();
  const [signals, setSignals] = useState<CopaSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'settled'>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('punter_copa_signals')
        .select('id, created_at, home_team, away_team, league, market, odd, confidence, verdict, resultado, profit_loss, phase, ah_line, ve_pct, block')
        .order('created_at', { ascending: false })
        .limit(200);
      setSignals((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = signals.filter((s) => {
    if (tab === 'pending') return !s.resultado;
    if (tab === 'settled') return !!s.resultado;
    return true;
  });

  const greens = signals.filter((s) => s.resultado === 'GREEN').length;
  const reds = signals.filter((s) => s.resultado === 'RED').length;
  const totalSettled = greens + reds;
  const winRate = totalSettled ? Math.round((greens / totalSettled) * 100) : null;
  const roi = signals
    .filter((s) => s.profit_loss != null)
    .reduce((acc, s) => acc + (s.profit_loss || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter/menu')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Trophy className="w-5 h-5 text-primary" />
          <h1 className="font-mono text-sm font-semibold tracking-tight flex-1">
            COPA DO MUNDO 2026 · SINAIS PUNTER
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-5xl space-y-4">
        <PunterBreadcrumb items={[{ label: 'Copa 2026' }]} />

        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="pt-4">
            <div className="text-2xl font-bold text-primary">{signals.length}</div>
            <div className="text-xs text-muted-foreground">Sinais Copa</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className="text-2xl font-bold">{winRate != null ? `${winRate}%` : '—'}</div>
            <div className="text-xs text-muted-foreground">Win rate ({greens}G · {reds}R)</div>
          </CardContent></Card>
          <Card><CardContent className="pt-4">
            <div className={`text-2xl font-bold ${roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {roi >= 0 ? '+' : ''}{roi.toFixed(2)}u
            </div>
            <div className="text-xs text-muted-foreground">P/L acumulado</div>
          </CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="all">Todos ({signals.length})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({signals.filter((s) => !s.resultado).length})</TabsTrigger>
            <TabsTrigger value="settled">Liquidados ({totalSettled})</TabsTrigger>
          </TabsList>

          <TabsContent value={tab} className="space-y-2 mt-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
              </div>
            ) : filtered.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-sm text-muted-foreground">
                Nenhum sinal Copa nesta aba ainda.
              </CardContent></Card>
            ) : (
              filtered.map((s) => (
                <Card key={s.id} className="border-primary/30">
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary text-primary-foreground gap-1">
                        <Trophy className="w-3 h-3" /> COPA 2026
                      </Badge>
                      {s.phase && (
                        <Badge variant="outline">{PHASE_LABEL[s.phase] || s.phase}</Badge>
                      )}
                      {s.block && <Badge variant="secondary">Bloco {s.block}</Badge>}
                      {s.resultado && (
                        <Badge className={s.resultado === 'GREEN' ? 'bg-green-600' : 'bg-red-600'}>
                          {s.resultado}
                        </Badge>
                      )}
                    </div>
                    <div className="font-semibold">{s.home_team} vs {s.away_team}</div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-mono">{s.market}</span>
                      {s.ah_line != null && <> · AH {s.ah_line > 0 ? `+${s.ah_line}` : s.ah_line}</>}
                      {s.odd != null && <> · @ {Number(s.odd).toFixed(2)}</>}
                      {s.confidence != null && <> · Conf {s.confidence}%</>}
                      {s.ve_pct != null && <> · VE {Number(s.ve_pct).toFixed(1)}%</>}
                    </div>
                    {s.profit_loss != null && (
                      <div className={`text-sm font-semibold ${s.profit_loss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        P/L: {s.profit_loss >= 0 ? '+' : ''}{Number(s.profit_loss).toFixed(2)}u
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
