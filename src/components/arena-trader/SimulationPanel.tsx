import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, FlaskConical, Play, CheckCircle, XCircle, Clock, Trophy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import GoldButton from '@/components/game/GoldButton';
import { cn } from '@/lib/utils';

interface SimMatch {
  id: string;
  partida_id: number;
  championship: string;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  score_home: number;
  score_away: number;
  match_date: string | null;
  status: string;
}

interface SimAnalysis {
  verdict: string;
  market: string | null;
  odd: number | null;
  confidence: number;
  thesis: string;
  fundamentation: any;
  risk_management: any;
  alerts: any;
}

interface AnalyzedMatch extends SimMatch {
  analysis?: SimAnalysis;
  real_result?: { score_home: number; score_away: number };
  analyzing?: boolean;
}

export default function SimulationPanel() {
  const [matches, setMatches] = useState<AnalyzedMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalyzedMatch | null>(null);

  const fetchSimulationMatches = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-simulation-matches');
      if (error) throw error;
      setMatches(data.matches || []);
      toast.success(`${data.total_matches} jogos encontrados para simulação`);
    } catch (e) {
      console.error('Simulation fetch error:', e);
      toast.error('Erro ao buscar jogos para simulação');
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeMatch = useCallback(async (match: AnalyzedMatch) => {
    setMatches(prev => prev.map(m => m.id === match.id ? { ...m, analyzing: true } : m));
    try {
      const { data, error } = await supabase.functions.invoke('fetch-simulation-matches', {
        body: { analyze: true, match_id: match.id },
      });
      if (error) throw error;

      setMatches(prev => prev.map(m => m.id === match.id ? {
        ...m,
        analysis: data.analysis,
        real_result: data.real_result,
        analyzing: false,
      } : m));

      const emoji = data.analysis.verdict === 'APROVADO' ? '✅' : data.analysis.verdict === 'VETADO' ? '❌' : '⏳';
      toast.success(`${emoji} ${data.analysis.verdict} - ${match.home_team} vs ${match.away_team}`);
    } catch (e) {
      console.error('Analysis error:', e);
      toast.error('Erro na análise');
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, analyzing: false } : m));
    }
  }, []);

  const analyzeAll = useCallback(async () => {
    const unanalyzed = matches.filter(m => !m.analysis && !m.analyzing);
    if (unanalyzed.length === 0) {
      toast.info('Todos os jogos já foram analisados');
      return;
    }

    toast.info(`Analisando ${unanalyzed.length} jogos...`);
    for (const match of unanalyzed) {
      await analyzeMatch(match);
      // Small delay between analyses
      await new Promise(r => setTimeout(r, 1500));
    }
    toast.success('Todas as análises concluídas!');
  }, [matches, analyzeMatch]);

  const analyzedCount = matches.filter(m => m.analysis).length;
  const approvedCount = matches.filter(m => m.analysis?.verdict === 'APROVADO').length;
  const vetoedCount = matches.filter(m => m.analysis?.verdict === 'VETADO').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-orbitron text-lg font-bold text-foreground">Modo Simulado</h2>
            <p className="text-xs text-muted-foreground">Teste o Mycroft com jogos finalizados (API Futebol DEV)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <GoldButton size="sm" onClick={fetchSimulationMatches} disabled={loading}>
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
            {loading ? 'Buscando...' : 'Buscar Jogos'}
          </GoldButton>
          {matches.length > 0 && (
            <GoldButton size="sm" variant="outline" onClick={analyzeAll}>
              <Play className="w-4 h-4 mr-1" />
              Analisar Todos
            </GoldButton>
          )}
        </div>
      </div>

      {/* Stats bar */}
      {analyzedCount > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-secondary/30 border border-border text-sm">
          <span className="text-muted-foreground">Analisados: <strong className="text-foreground">{analyzedCount}/{matches.length}</strong></span>
          <span className="text-success">✅ Aprovados: <strong>{approvedCount}</strong></span>
          <span className="text-destructive">❌ Vetados: <strong>{vetoedCount}</strong></span>
          {analyzedCount > 0 && (
            <span className="text-primary">Taxa: <strong>{((approvedCount / analyzedCount) * 100).toFixed(0)}%</strong></span>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground font-orbitron">Buscando jogos finalizados...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && matches.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-16 text-center space-y-4"
        >
          <span className="text-6xl">🧪</span>
          <h3 className="font-orbitron text-lg text-foreground">Modo Simulado</h3>
          <p className="text-muted-foreground text-sm max-w-md">
            Busque jogos finalizados para testar as análises do Mycroft.
            O sistema simulará como se o jogo estivesse ao vivo no minuto 30.
          </p>
          <GoldButton onClick={fetchSimulationMatches}>
            <FlaskConical className="w-4 h-4 mr-1" />
            Buscar Jogos para Simulação
          </GoldButton>
        </motion.div>
      )}

      {/* Match cards */}
      {!loading && matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {matches.map((match, i) => (
              <motion.div
                key={match.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  "rounded-xl border bg-card p-4 space-y-3 transition-all",
                  match.analysis?.verdict === 'APROVADO' && "border-success/40 bg-success/5",
                  match.analysis?.verdict === 'VETADO' && "border-destructive/30",
                  !match.analysis && "border-border hover:border-primary/40"
                )}
              >
                {/* Championship */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-secondary/50">
                    {match.championship}
                  </span>
                  {match.match_date && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(match.match_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Teams & Score */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{match.home_team}</span>
                      {match.home_logo && match.home_logo.startsWith('http') ? (
                        <img src={match.home_logo} alt="" className="w-6 h-6 object-contain" />
                      ) : (
                        <span className="text-lg">⚽</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 px-3 py-1 rounded-lg bg-secondary/50">
                    <span className="font-orbitron font-bold text-foreground text-lg">{match.score_home}</span>
                    <span className="text-muted-foreground">x</span>
                    <span className="font-orbitron font-bold text-foreground text-lg">{match.score_away}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {match.away_logo && match.away_logo.startsWith('http') ? (
                        <img src={match.away_logo} alt="" className="w-6 h-6 object-contain" />
                      ) : (
                        <span className="text-lg">⚽</span>
                      )}
                      <span className="text-sm font-medium text-foreground truncate">{match.away_team}</span>
                    </div>
                  </div>
                </div>

                {/* Analysis result or action button */}
                {match.analysis ? (
                  <div
                    className="space-y-2 cursor-pointer"
                    onClick={() => setSelectedAnalysis(selectedAnalysis?.id === match.id ? null : match)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {match.analysis.verdict === 'APROVADO' ? (
                          <CheckCircle className="w-4 h-4 text-success" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive" />
                        )}
                        <span className={cn(
                          "text-sm font-bold font-orbitron",
                          match.analysis.verdict === 'APROVADO' ? 'text-success' : 'text-destructive'
                        )}>
                          {match.analysis.verdict}
                        </span>
                        {match.analysis.market && (
                          <span className="text-xs text-muted-foreground">• {match.analysis.market}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{match.analysis.confidence}%</span>
                    </div>

                    {/* Expanded analysis */}
                    <AnimatePresence>
                      {selectedAnalysis?.id === match.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="pt-2 border-t border-border space-y-2">
                            <p className="text-xs text-muted-foreground leading-relaxed">{match.analysis.thesis}</p>
                            {match.real_result && (
                              <div className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-primary/10">
                                <Trophy className="w-3 h-3 text-primary" />
                                <span className="text-muted-foreground">Resultado real:</span>
                                <span className="font-bold text-foreground">
                                  {match.real_result.score_home} x {match.real_result.score_away}
                                </span>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <GoldButton
                    size="sm"
                    className="w-full"
                    onClick={() => analyzeMatch(match)}
                    disabled={match.analyzing}
                  >
                    {match.analyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        Analisando...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-1" />
                        Simular Análise (Min 30)
                      </>
                    )}
                  </GoldButton>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
