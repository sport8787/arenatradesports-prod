import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, FlaskConical, Play } from 'lucide-react';
import { toast } from 'sonner';
import ShadowAfCronToggle from '@/components/arena-trader/ShadowAfCronToggle';

interface ShadowSignal {
  id: string;
  match_id: string;
  verdict: string;
  market: string | null;
  plan_name: string | null;
  thesis: string | null;
  odd: number | null;
  confidence: number | null;
  approved_at_minute: number | null;
  approved_at_score_home: number | null;
  approved_at_score_away: number | null;
  created_at: string;
}

interface MatchInfo {
  match_id: string;
  home_team: string;
  away_team: string;
  championship: string;
  minute: number | null;
  score_home: number | null;
  score_away: number | null;
}

interface PrimarySignal {
  match_id: string;
  market: string | null;
  verdict: string;
}

const APPROVED = ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'];

export default function ShadowAfApprovedTab() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [signals, setSignals] = useState<ShadowSignal[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchInfo>>({});
  const [primary, setPrimary] = useState<Record<string, PrimarySignal[]>>({});

  const load = async () => {
    setLoading(true);
    try {
      // Últimas 6h, apenas verdicts aprovados
      const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: shadow, error } = await supabase
        .from('mycroft_analyses_shadow_af' as any)
        .select('*')
        .in('verdict', APPROVED)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const list = (shadow || []) as unknown as ShadowSignal[];
      setSignals(list);

      const ids = Array.from(new Set(list.map((s) => s.match_id)));
      if (ids.length > 0) {
        const [{ data: lm }, { data: prim }] = await Promise.all([
          supabase.from('live_matches').select('match_id, home_team, away_team, championship, minute, score_home, score_away').in('match_id', ids),
          supabase.from('mycroft_analyses').select('match_id, market, verdict').in('match_id', ids).in('verdict', APPROVED),
        ]);
        const map: Record<string, MatchInfo> = {};
        (lm || []).forEach((m: any) => { map[m.match_id] = m; });
        setMatches(map);

        const pmap: Record<string, PrimarySignal[]> = {};
        (prim || []).forEach((p: any) => {
          pmap[p.match_id] = pmap[p.match_id] || [];
          pmap[p.match_id].push(p);
        });
        setPrimary(pmap);
      } else {
        setMatches({});
        setPrimary({});
      }
    } catch (e: any) {
      toast.error('Erro ao carregar sinais shadow: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runShadow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-live-shadow-af', { body: {} });
      if (error) throw error;
      toast.success(`Shadow AF: ${data?.processed ?? 0} jogos analisados, ${data?.approved ?? 0} aprovações`);
      await load();
    } catch (e: any) {
      toast.error('Falha ao rodar shadow: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('shadow-af')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mycroft_analyses_shadow_af' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Marca cada sinal: "ÚNICO AF" se a Sportmonks não aprovou nada do mesmo mercado
  const enriched = signals.map((s) => {
    const primList = primary[s.match_id] || [];
    const primMarkets = primList.map((p) => (p.market || '').toLowerCase().trim());
    const matchedInPrimary = primMarkets.includes((s.market || '').toLowerCase().trim());
    const sameMatchAnyPrimary = primList.length > 0;
    return { ...s, matchedInPrimary, sameMatchAnyPrimary };
  });

  const onlyInAf = enriched.filter((s) => !s.matchedInPrimary).length;

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-amber-500" />
            Sinais Aprovados — API-Football <Badge variant="outline" className="ml-2">SHADOW · ADMIN</Badge>
          </span>
          <div className="flex gap-2 items-center">
            <ShadowAfCronToggle />
            <Button size="sm" variant="outline" onClick={runShadow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              Rodar agora
            </Button>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Análise paralela usando <strong>API-Football</strong> como fonte de estatísticas (provider antigo).
          Compare com a aba <em>Sinais Aprovados</em> (Sportmonks, primária). Se um sinal aparece aqui mas
          não na aba primária, significa que a Sportmonks <strong>vetou</strong> uma aprovação que a AF teria dado — e vice-versa.
          Últimas 6h.
        </p>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="border rounded p-2">
            <div className="text-xs text-muted-foreground">Total AF</div>
            <div className="text-lg font-bold">{signals.length}</div>
          </div>
          <div className="border rounded p-2 bg-amber-500/10">
            <div className="text-xs text-muted-foreground">Só na AF (Sportmonks vetou)</div>
            <div className="text-lg font-bold text-amber-600">{onlyInAf}</div>
          </div>
          <div className="border rounded p-2">
            <div className="text-xs text-muted-foreground">Confirmados nas duas</div>
            <div className="text-lg font-bold text-success">{signals.length - onlyInAf}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhum sinal shadow nas últimas 6h. Clique em <strong>Rodar agora</strong> para disparar análise paralela.
          </div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {enriched.map((s) => {
              const m = matches[s.match_id];
              return (
                <div
                  key={s.id}
                  className={`border rounded p-3 text-sm ${
                    !s.matchedInPrimary ? 'border-amber-500/60 bg-amber-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="font-medium">
                      {m ? `${m.home_team} ${m.score_home ?? 0}-${m.score_away ?? 0} ${m.away_team}` : s.match_id}
                      {m?.minute != null && <span className="text-xs text-muted-foreground ml-2">({m.minute}')</span>}
                    </div>
                    <div className="flex gap-1">
                      <Badge variant={s.verdict === 'APROVADO' ? 'default' : 'secondary'}>{s.verdict}</Badge>
                      {!s.matchedInPrimary && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          {s.sameMatchAnyPrimary ? 'mercado divergente' : 'só AF'}
                        </Badge>
                      )}
                      {s.matchedInPrimary && (
                        <Badge variant="outline" className="border-success text-success">confirmado</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-xs mt-1 text-muted-foreground">
                    <strong>{s.market}</strong> @ {s.odd ?? '-'} · conf {s.confidence ?? 0}%
                    {s.plan_name ? ` · ${s.plan_name}` : ''}
                    {m?.championship ? ` · ${m.championship}` : ''}
                  </div>
                  {s.thesis && (
                    <div className="text-xs mt-1 text-foreground/80 line-clamp-2">{s.thesis}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
