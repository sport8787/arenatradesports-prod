import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Activity, History, Trophy, Clock, Target, AlertTriangle, TrendingUp, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useLiveMatches } from '@/hooks/useLiveMatches';
import { cn } from '@/lib/utils';
import GoldButton from '@/components/game/GoldButton';

interface SnapshotEvent {
  at: string;
  scoreHome: number;
  scoreAway: number;
  minute: number;
  verdict?: string;
  confidence?: number;
  stats?: any;
}

const verdictColors: Record<string, string> = {
  APROVADO: 'bg-success/20 text-success border-success/40',
  APROVADO_SITUACIONAL: 'bg-success/20 text-success border-success/40',
  opportunity: 'bg-success/20 text-success border-success/40',
  LABAREDA: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
  CUIDADO: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  AGUARDAR: 'bg-muted/40 text-muted-foreground border-border',
  analyzing: 'bg-muted/40 text-muted-foreground border-border',
  JOGO_MORTO: 'bg-destructive/20 text-destructive border-destructive/40',
  VETADO: 'bg-destructive/20 text-destructive border-destructive/40',
  no_value: 'bg-destructive/20 text-destructive border-destructive/40',
};

function StatRow({ label, home, away, suffix = '' }: { label: string; home?: number | null; away?: number | null; suffix?: string }) {
  const h = home ?? 0;
  const a = away ?? 0;
  const total = h + a || 1;
  const pctH = (h / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-orbitron uppercase tracking-wider">
        <span className="text-foreground font-bold">{home ?? '-'}{suffix}</span>
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-bold">{away ?? '-'}{suffix}</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden flex">
        <div className="bg-primary h-full transition-all" style={{ width: `${pctH}%` }} />
        <div className="bg-secondary h-full transition-all" style={{ width: `${100 - pctH}%` }} />
      </div>
    </div>
  );
}

export default function LiveMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { matches, loading } = useLiveMatches();
  const [history, setHistory] = useState<SnapshotEvent[]>([]);

  const match = useMemo(() => matches.find(m => m.id === id), [matches, id]);
  const stats = (match?.stats as any) || {};
  const analysis = match?.mycroft_analysis;

  // Build session history of updates (in-memory)
  useEffect(() => {
    if (!match) return;
    setHistory(prev => {
      const last = prev[prev.length - 1];
      const next: SnapshotEvent = {
        at: new Date().toISOString(),
        scoreHome: match.score_home ?? 0,
        scoreAway: match.score_away ?? 0,
        minute: match.minute ?? 0,
        verdict: analysis?.verdict,
        confidence: analysis?.confidence,
        stats,
      };
      // Only add if something meaningful changed
      if (
        !last ||
        last.scoreHome !== next.scoreHome ||
        last.scoreAway !== next.scoreAway ||
        last.minute !== next.minute ||
        last.verdict !== next.verdict ||
        last.confidence !== next.confidence
      ) {
        return [...prev.slice(-49), next];
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.updated_at, analysis?.verdict, analysis?.confidence]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
        <p className="text-muted-foreground">Jogo não encontrado ou já finalizado.</p>
        <GoldButton onClick={() => navigate('/arena-trader-sports')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </GoldButton>
      </div>
    );
  }

  const verdictClass = verdictColors[analysis?.verdict || ''] || verdictColors.AGUARDAR;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/arena-trader-sports')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-orbitron uppercase tracking-wider"
          >
            <ArrowLeft className="w-4 h-4" /> Retornar
          </button>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-primary" />
            <span className="text-xs font-orbitron uppercase tracking-wider text-primary truncate max-w-[200px] sm:max-w-none">
              {match.championship}
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Scoreboard */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-6 sm:p-8"
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive" />
            </span>
            <span className="text-[10px] font-orbitron uppercase tracking-[0.2em] text-destructive">
              AO VIVO
            </span>
          </div>

          <div className="grid grid-cols-3 items-center gap-4">
            {/* Home */}
            <div className="text-center space-y-2">
              <div className="text-4xl sm:text-6xl">{match.home_logo || '⚽'}</div>
              <p className="font-orbitron text-sm sm:text-base font-bold text-foreground truncate">
                {match.home_team}
              </p>
            </div>

            {/* Score */}
            <div className="text-center space-y-2">
              <div className="font-orbitron text-5xl sm:text-7xl font-black text-foreground tabular-nums">
                {match.score_home ?? 0}
                <span className="text-muted-foreground mx-2">:</span>
                {match.score_away ?? 0}
              </div>
              <div className="flex items-center justify-center gap-2 text-xs font-orbitron uppercase tracking-wider text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{match.minute ?? 0}'</span>
                {match.period && <span>• {match.period}</span>}
              </div>
            </div>

            {/* Away */}
            <div className="text-center space-y-2">
              <div className="text-4xl sm:text-6xl">{match.away_logo || '⚽'}</div>
              <p className="font-orbitron text-sm sm:text-base font-bold text-foreground truncate">
                {match.away_team}
              </p>
            </div>
          </div>

          {analysis && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Badge className={cn('font-orbitron uppercase tracking-wider border', verdictClass)}>
                {analysis.verdict}
              </Badge>
              {analysis.market && (
                <Badge variant="outline" className="font-orbitron text-xs">
                  {analysis.market}
                </Badge>
              )}
              {analysis.odd != null && (
                <Badge variant="outline" className="font-orbitron text-xs">
                  Odd {Number(analysis.odd).toFixed(2)}
                </Badge>
              )}
              {analysis.confidence != null && (
                <Badge variant="outline" className="font-orbitron text-xs">
                  Confiança {Math.round(Number(analysis.confidence) * (analysis.confidence > 1 ? 1 : 100))}%
                </Badge>
              )}
            </div>
          )}
        </motion.section>

        {/* Tabs */}
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto">
            <TabsTrigger value="analysis" className="font-orbitron text-xs uppercase tracking-wider">
              <Brain className="w-3.5 h-3.5 mr-1" /> Mycroft
            </TabsTrigger>
            <TabsTrigger value="stats" className="font-orbitron text-xs uppercase tracking-wider">
              <Activity className="w-3.5 h-3.5 mr-1" /> Estatísticas
            </TabsTrigger>
            <TabsTrigger value="history" className="font-orbitron text-xs uppercase tracking-wider">
              <History className="w-3.5 h-3.5 mr-1" /> Histórico
            </TabsTrigger>
          </TabsList>

          {/* Análise Mycroft */}
          <TabsContent value="analysis" className="mt-4 space-y-4">
            {!analysis ? (
              <div className="luxury-card p-8 text-center space-y-2">
                <Brain className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Mycroft ainda não analisou esta partida.
                </p>
                <p className="text-xs text-muted-foreground">
                  Status: <span className="font-orbitron uppercase">{match.mycroft_status || 'aguardando'}</span>
                </p>
              </div>
            ) : (
              <>
                {/* Tese */}
                <div className="luxury-card p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                      Tese
                    </h3>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                    {analysis.thesis || 'Sem tese disponível.'}
                  </p>
                </div>

                {/* Fundamentação */}
                {analysis.fundamentation && (
                  <div className="luxury-card p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                        Fundamentação
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(analysis.fundamentation).map(([k, v]) => (
                        <div key={k} className="bg-muted/20 rounded-lg p-3 border border-border/40">
                          <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground mb-1">
                            {k.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-foreground break-words">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gestão de Risco */}
                {analysis.risk_management && (
                  <div className="luxury-card p-5 space-y-3">
                    <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                      Gestão de Risco
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.entries(analysis.risk_management).map(([k, v]) => (
                        <div key={k} className="bg-muted/20 rounded-lg p-3 border border-border/40">
                          <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground mb-1">
                            {k.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-foreground break-words">
                            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alertas */}
                {analysis.alerts && analysis.alerts.length > 0 && (
                  <div className="luxury-card p-5 space-y-3 border-yellow-500/40">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <h3 className="font-orbitron text-sm uppercase tracking-wider text-yellow-400">
                        Alertas
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {analysis.alerts.map((alert, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-yellow-400 mt-0.5">⚠</span>
                          <span>{alert}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Estatísticas */}
          <TabsContent value="stats" className="mt-4">
            <div className="luxury-card p-5 space-y-5">
              {Object.keys(stats).length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <Activity className="w-10 h-10 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Estatísticas indisponíveis no momento.</p>
                </div>
              ) : (
                <>
                  <StatRow label="Posse de Bola" home={stats.possession_home} away={stats.possession_away} suffix="%" />
                  <StatRow label="Ataques Perigosos" home={stats.dangerous_attacks_home ?? stats.attacks_home} away={stats.dangerous_attacks_away ?? stats.attacks_away} />
                  <StatRow label="Chutes" home={stats.shots_home} away={stats.shots_away} />
                  <StatRow label="Chutes no Gol" home={stats.shots_on_target_home} away={stats.shots_on_target_away} />
                  <StatRow label="Escanteios" home={stats.corners_home} away={stats.corners_away} />
                  <StatRow label="Cartões" home={stats.cards_home} away={stats.cards_away} />
                  {(stats.xG_home != null || stats.xG_away != null) && (
                    <StatRow label="xG (Gols Esperados)" home={stats.xG_home} away={stats.xG_away} />
                  )}
                </>
              )}
              <p className="text-[10px] font-orbitron uppercase tracking-wider text-muted-foreground text-center pt-3 border-t border-border/40">
                Atualização automática em tempo real
              </p>
            </div>
          </TabsContent>

          {/* Histórico */}
          <TabsContent value="history" className="mt-4">
            <div className="luxury-card p-5 space-y-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
                  Histórico de Atualizações
                </h3>
              </div>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Aguardando atualizações...
                </p>
              ) : (
                <ol className="space-y-2 max-h-[480px] overflow-y-auto">
                  {[...history].reverse().map((ev, i) => (
                    <li
                      key={ev.at + i}
                      className="flex items-start gap-3 bg-muted/20 rounded-lg p-3 border border-border/40"
                    >
                      <div className="text-[10px] font-orbitron text-muted-foreground tabular-nums shrink-0 w-16">
                        {new Date(ev.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-orbitron text-foreground tabular-nums">
                            {ev.scoreHome} : {ev.scoreAway}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-muted-foreground">{ev.minute}'</span>
                          {ev.verdict && (
                            <Badge variant="outline" className="text-[9px] font-orbitron uppercase">
                              {ev.verdict}
                            </Badge>
                          )}
                          {ev.confidence != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(Number(ev.confidence) * (ev.confidence > 1 ? 1 : 100))}%
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-[10px] text-muted-foreground text-center pt-2">
                O histórico cobre apenas a sessão atual (não persistido).
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
