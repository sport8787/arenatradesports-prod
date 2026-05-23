import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Brain, Play } from 'lucide-react';
import { toast } from 'sonner';
import ShadowAiCronToggle from '@/components/arena-trader/ShadowAiCronToggle';
import MatchCardWithEntries from '@/components/dashboard/MatchCardWithEntries';
import type { Match } from '@/components/dashboard/MatchCard';

const getChampionshipColor = (name: string): Match['championshipColor'] => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('copa')) return 'yellow';
  if (lower.includes('champions') || lower.includes('liga')) return 'blue';
  if (lower.includes('brasileir')) return 'green';
  return 'red';
};

interface ShadowAiSignal {
  id: string;
  match_id: string;
  verdict: string;
  market: string | null;
  thesis: string | null;
  odd: number | null;
  confidence: number | null;
  approved_at_minute: number | null;
  approved_at_score_home: number | null;
  approved_at_score_away: number | null;
  created_at: string;
  result?: string | null;
  final_score_home?: number | null;
  final_score_away?: number | null;
  stats_snapshot?: any;
  latency_ms?: number | null;
  model?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  championship?: string | null;
}

interface MatchInfo {
  match_id: string;
  home_team: string;
  away_team: string;
  championship: string;
  minute: number | null;
  score_home: number | null;
  score_away: number | null;
  status: string | null;
}

const APPROVED = ['APROVADO', 'APROVADO_SITUACIONAL', 'LABAREDA'];
type Period = '7d' | '30d';

function shadowAiSignalToMatch(s: ShadowAiSignal, m?: MatchInfo, lmExtra?: any): Match {
  const stats = lmExtra?.stats || s.stats_snapshot?.stats || {};
  const snap = s.stats_snapshot || {};
  const home = m?.home_team || s.home_team || snap.home_team || 'Casa';
  const away = m?.away_team || s.away_team || snap.away_team || 'Fora';
  const championship = m?.championship || s.championship || snap.championship || '—';
  return {
    id: s.id,
    championship,
    championshipColor: getChampionshipColor(championship),
    home,
    away,
    homeLogo: lmExtra?.home_logo || '⚽',
    awayLogo: lmExtra?.away_logo || '⚽',
    scoreHome: s.final_score_home ?? m?.score_home ?? 0,
    scoreAway: s.final_score_away ?? m?.score_away ?? 0,
    minute: m?.minute ?? s.approved_at_minute ?? 0,
    period: '',
    status: (s.result ? 'finished' : 'live') as Match['status'],
    mycroftStatus: (s.verdict as Match['mycroftStatus']) || 'APROVADO',
    matchId: s.match_id,
    stats: {
      possession_home: stats.possession_home,
      possession_away: stats.possession_away,
      attacks_home: stats.attacks_home ?? stats.dangerous_attacks_home,
      attacks_away: stats.attacks_away ?? stats.dangerous_attacks_away,
      shots_home: stats.shots_on_target_home ?? stats.shots_home,
      shots_away: stats.shots_on_target_away ?? stats.shots_away,
      corners_home: stats.corners_home,
      corners_away: stats.corners_away,
      xG_home: stats.xG_home,
      xG_away: stats.xG_away,
    },
    planName: null,
    market: s.market,
    signalResult: (s.result === 'green' || s.result === 'red') ? s.result : null,
    finalScoreHome: s.final_score_home ?? null,
    finalScoreAway: s.final_score_away ?? null,
    confidence: s.confidence ?? null,
    alerts: null,
    approvalOdd: s.odd ?? null,
    oddsLive: lmExtra?.odds_live ?? null,
  };
}

export default function ShadowAiApprovedTab() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [period, setPeriod] = useState<Period>('7d');
  const [signals, setSignals] = useState<ShadowAiSignal[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchInfo>>({});
  const [lmExtras, setLmExtras] = useState<Record<string, any>>({});
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setCurrentUserId(data?.session?.user?.id));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const days = period === '7d' ? 7 : 30;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data: shadow, error } = await supabase
        .from('mycroft_analyses_shadow_ai' as any)
        .select('*')
        .in('verdict', APPROVED)
        .gt('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const list = (shadow || []) as unknown as ShadowAiSignal[];
      setSignals(list);

      const ids = Array.from(new Set(list.map((s) => s.match_id)));
      if (ids.length > 0) {
        const { data: lm } = await supabase
          .from('live_matches')
          .select('match_id, home_team, away_team, championship, minute, score_home, score_away, home_logo, away_logo, stats, odds_live')
          .in('match_id', ids);
        const map: Record<string, MatchInfo> = {};
        const extras: Record<string, any> = {};
        (lm || []).forEach((m: any) => {
          map[m.match_id] = m;
          extras[m.match_id] = { home_logo: m.home_logo, away_logo: m.away_logo, stats: m.stats, odds_live: m.odds_live };
        });
        setMatches(map);
        setLmExtras(extras);
      } else {
        setMatches({});
        setLmExtras({});
      }
    } catch (e: any) {
      toast.error('Erro ao carregar Shadow AI: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const runShadow = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-live-shadow-ai', { body: {} });
      if (error) throw error;
      toast.success(`Shadow AI: ${data?.processed ?? 0} jogos analisados, ${data?.approved ?? 0} aprovações`);
      await load();
    } catch (e: any) {
      toast.error('Falha ao rodar Shadow AI: ' + e.message);
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('shadow-ai')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mycroft_analyses_shadow_ai' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mycroft_analyses_shadow_ai' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  const liquidated = signals.filter((s) => s.result === 'green' || s.result === 'red');
  const greens = liquidated.filter((s) => s.result === 'green').length;
  const reds = liquidated.filter((s) => s.result === 'red').length;
  const winRate = liquidated.length > 0 ? Math.round((greens / liquidated.length) * 100) : null;

  return (
    <Card className="border-violet-500/40 bg-violet-500/5">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-base flex-wrap">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" />
            Sinais Aprovados — Gemini IA <Badge variant="outline" className="ml-2">SHADOW AI · ADMIN</Badge>
          </span>
          <div className="flex gap-2 items-center flex-wrap">
            <ShadowAiCronToggle />
            <div className="flex border rounded overflow-hidden text-xs">
              {(['7d','30d'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-2 py-1 ${period === p ? 'bg-primary text-primary-foreground' : 'bg-background'}`}
                >
                  {p}
                </button>
              ))}
            </div>
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
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Análise paralela pura de IA (Gemini via Lovable AI). Dedup por jogo+mercado — <strong>não empilha sinais</strong>.
          Liquidação automática ao fim do jogo (Over/Under/BTTS/Próximo Gol).
        </p>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="border rounded p-2">
            <div className="text-muted-foreground">Aprovados</div>
            <div className="text-lg font-bold">{signals.length}</div>
          </div>
          <div className="border rounded p-2">
            <div className="text-muted-foreground">Liquidados</div>
            <div className="text-lg font-bold">{liquidated.length}</div>
          </div>
          <div className="border rounded p-2">
            <div className="text-muted-foreground">GREEN / RED</div>
            <div className="text-lg font-bold">
              <span className="text-success">{greens}</span> · <span className="text-destructive">{reds}</span>
            </div>
          </div>
          <div className="border rounded p-2 bg-violet-500/10">
            <div className="text-muted-foreground">Win-rate</div>
            <div className="text-lg font-bold text-violet-600">{winRate != null ? `${winRate}%` : '—'}</div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : signals.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Nenhum sinal Shadow AI no período. Clique em <strong>Rodar agora</strong> para disparar análise paralela com Gemini.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {signals.map((s, i) => {
              const m = matches[s.match_id];
              const match = shadowAiSignalToMatch(s, m, lmExtras[s.match_id]);
              return (
                <div key={s.id} className="relative">
                  <div className="absolute top-2 right-2 z-10 flex flex-wrap gap-1 justify-end max-w-[60%]">
                    {s.result === 'green' && <Badge className="bg-success text-[10px]">GREEN</Badge>}
                    {s.result === 'red' && <Badge variant="destructive" className="text-[10px]">RED</Badge>}
                    {!s.result && <Badge variant="secondary" className="text-[10px]">pendente</Badge>}
                    <Badge variant="outline" className="border-violet-500 text-violet-600 text-[10px]">IA</Badge>
                  </div>
                  <MatchCardWithEntries
                    match={match}
                    index={i}
                    userId={currentUserId}
                    bankrollBalance={500}
                    onAnalysisClick={(matchId) => navigate(`/arena-trader-sports/jogo/${matchId}`)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
