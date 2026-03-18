import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Heart, Star, Target, RotateCcw, Trophy, Zap, AlertTriangle, PartyPopper, Loader2, CheckCircle2, Database } from 'lucide-react';
import GoldButton from '@/components/game/GoldButton';
import { trainingScenarios, type TrainingScenario } from '@/data/trainingScenarios';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useSportsTrainingStatus } from '@/hooks/useSportsTrainingStatus';
import { toast } from 'sonner';

type Decision = 'ENTRO' | 'AGUARDO' | 'NAO_ENTRO';
type Phase = 'loading_scenarios' | 'scenario' | 'loading' | 'result' | 'gameover' | 'victory' | 'graduated';

const TOTAL_SCENARIOS = 15;
const PASS_RATE = 0.7; // 70%

interface GameState {
  currentIndex: number;
  bluffCoins: number;
  lives: number;
  correctCount: number;
  totalAnswered: number;
  streak: number;
}

const initialState: GameState = {
  currentIndex: 0,
  bluffCoins: 5000,
  lives: 3,
  correctCount: 0,
  totalAnswered: 0,
  streak: 0,
};

export default function ModoTreino() {
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState>(initialState);
  const [phase, setPhase] = useState<Phase>('loading_scenarios');
  const [wasCorrect, setWasCorrect] = useState(false);
  const [scenarios, setScenarios] = useState<TrainingScenario[]>([]);
  const { completed, markCompleted } = useSportsTrainingStatus();

  // Fetch dynamic scenarios from DB, mix with static fallback
  useEffect(() => {
    const fetchScenarios = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('generate-training-scenarios', {
          body: { count: TOTAL_SCENARIOS },
        });

        let dynamicScenarios: TrainingScenario[] = [];
        if (!error && data?.scenarios?.length > 0) {
          dynamicScenarios = data.scenarios.map((s: any, i: number) => ({
            ...s,
            id: i + 100,
          }));
        }

        // Mix: dynamic first, fill remaining with static
        const needed = TOTAL_SCENARIOS - dynamicScenarios.length;
        const staticFill = needed > 0
          ? trainingScenarios.sort(() => Math.random() - 0.5).slice(0, needed)
          : [];

        const mixed = [...dynamicScenarios, ...staticFill].sort(() => Math.random() - 0.5);
        setScenarios(mixed.slice(0, TOTAL_SCENARIOS));
        setPhase('scenario');
      } catch {
        // Fallback to static scenarios
        const shuffled = [...trainingScenarios].sort(() => Math.random() - 0.5);
        setScenarios(shuffled.slice(0, Math.min(TOTAL_SCENARIOS, shuffled.length)));
        setPhase('scenario');
      }
    };

    fetchScenarios();
  }, []);

  const scenario = scenarios[game.currentIndex];

  const handleDecision = useCallback((decision: Decision) => {
    if (!scenario) return;
    setPhase('loading');
    setTimeout(() => {
      const isCorrect = decision === scenario.correctDecision;
      setWasCorrect(isCorrect);
      setGame(prev => ({
        ...prev,
        bluffCoins: Math.max(0, prev.bluffCoins + (isCorrect ? scenario.rewards.correct : scenario.rewards.wrong)),
        lives: !isCorrect && scenario.rewards.loseLife ? prev.lives - 1 : prev.lives,
        correctCount: prev.correctCount + (isCorrect ? 1 : 0),
        totalAnswered: prev.totalAnswered + 1,
        streak: isCorrect ? prev.streak + 1 : 0,
      }));
      setPhase('result');
    }, 2000);
  }, [scenario]);

  const handleNext = useCallback(async () => {
    const newLives = game.lives - (!wasCorrect && scenario?.rewards.loseLife ? 1 : 0);

    if (game.lives <= 0) {
      setPhase('gameover');
      return;
    }

    if (game.currentIndex >= scenarios.length - 1) {
      // Check pass rate
      const accuracy = game.correctCount / game.totalAnswered;
      if (accuracy >= PASS_RATE) {
        await markCompleted();

        // Save session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('sports_training_sessions').insert({
            user_id: user.id,
            scenarios_total: scenarios.length,
            scenarios_answered: game.totalAnswered,
            scenarios_correct: game.correctCount,
            accuracy: Math.round(accuracy * 100),
            passed: true,
            bluff_coins_earned: game.bluffCoins - 5000,
            completed_at: new Date().toISOString(),
          });
        }

        setPhase('graduated');
      } else {
        setPhase('victory'); // completed but didn't pass
      }
    } else {
      setGame(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
      setPhase('scenario');
    }
  }, [game, scenarios.length, wasCorrect, scenario, markCompleted]);

  const handleRestart = () => {
    setGame(initialState);
    setPhase('loading_scenarios');
    // Re-fetch scenarios
    const fetchAgain = async () => {
      try {
        const { data } = await supabase.functions.invoke('generate-training-scenarios', {
          body: { count: TOTAL_SCENARIOS },
        });
        let dynamic: TrainingScenario[] = [];
        if (data?.scenarios?.length > 0) {
          dynamic = data.scenarios.map((s: any, i: number) => ({ ...s, id: i + 200 }));
        }
        const needed = TOTAL_SCENARIOS - dynamic.length;
        const staticFill = needed > 0 ? trainingScenarios.sort(() => Math.random() - 0.5).slice(0, needed) : [];
        setScenarios([...dynamic, ...staticFill].sort(() => Math.random() - 0.5).slice(0, TOTAL_SCENARIOS));
        setPhase('scenario');
      } catch {
        setScenarios([...trainingScenarios].sort(() => Math.random() - 0.5).slice(0, Math.min(TOTAL_SCENARIOS, trainingScenarios.length)));
        setPhase('scenario');
      }
    };
    fetchAgain();
  };

  const accuracy = game.totalAnswered > 0 ? Math.round((game.correctCount / game.totalAnswered) * 100) : 0;
  const progress = scenarios.length > 0 ? Math.round(((game.currentIndex + (phase === 'result' ? 1 : 0)) / scenarios.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <button onClick={() => navigate('/arena-trader-sports')} className="text-muted-foreground hover:text-foreground"><ArrowLeft /></button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{game.currentIndex + 1}/{scenarios.length}</span>
            <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-sm font-bold"><Heart className="w-4 h-4 text-red-500 fill-red-500" /> {game.lives}</div>
            <div className="flex items-center gap-1.5 text-sm font-bold"><Target className="w-4 h-4 text-primary" /> {accuracy}%</div>
            <div className="flex items-center gap-1.5 text-sm font-bold"><Trophy className="w-4 h-4 text-yellow-500" /> {game.bluffCoins.toLocaleString()}</div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <AnimatePresence mode="wait">
          {phase === 'loading_scenarios' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative w-24 h-24">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-full h-full border-4 border-primary/20 border-t-primary rounded-full" />
                <Database className="absolute inset-0 m-auto w-8 h-8 text-primary" />
              </div>
              <h3 className="font-orbitron text-lg font-bold text-primary text-center">Carregando cenários reais...</h3>
              <p className="text-sm text-muted-foreground text-center">Buscando jogos do banco de dados do Mycroft</p>
            </motion.div>
          )}

          {phase === 'scenario' && scenario && (
            <motion.div key={game.currentIndex} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* Onboarding banner */}
              {!completed && (
                <div className="bg-primary/10 border border-primary/30 rounded-xl p-3 text-center">
                  <p className="text-xs font-medium text-primary">🎯 ONBOARDING OBRIGATÓRIO — Acerte 70% para desbloquear o modo ao vivo</p>
                </div>
              )}

              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <h2 className="font-orbitron text-xl font-bold">{scenario.match}</h2>
                    <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('w-4 h-4', i < scenario.difficulty ? 'fill-primary text-primary' : 'text-muted-foreground/30')} />)}</div>
                  </div>
                  <p className="text-muted-foreground">{scenario.horusQuote}</p>
                  <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                    <p className="text-sm font-medium">Competition: {scenario.competition} | Minute: {scenario.minute}' | Score: {scenario.score}</p>
                    <p className="text-xs text-muted-foreground mt-2">Stats: xG {scenario.stats.xG_home} - {scenario.stats.xG_away} | Market: {scenario.market} @ {scenario.odd}</p>
                    <p className="text-xs text-muted-foreground mt-1">Posse: {scenario.stats.possession_home}% | Ataques: {scenario.stats.attacks_home} - {scenario.stats.attacks_away}</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <GoldButton onClick={() => handleDecision('ENTRO')} className="py-8">ENTRO COM TUDO</GoldButton>
                <GoldButton onClick={() => handleDecision('AGUARDO')} variant="outline" className="py-6">AGUARDO CONFIRMAÇÃO</GoldButton>
                <GoldButton onClick={() => handleDecision('NAO_ENTRO')} variant="ghost" className="py-6 text-muted-foreground">FORA DESSE JOGO</GoldButton>
              </div>
            </motion.div>
          )}

          {phase === 'loading' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative w-24 h-24">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-full h-full border-4 border-primary/20 border-t-primary rounded-full" />
                <Zap className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="font-orbitron text-xl font-bold text-primary text-center">Analisando...</h3>
            </motion.div>
          )}

          {phase === 'result' && scenario && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className={cn("p-8 rounded-3xl border-2 text-center space-y-4", wasCorrect ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30")}>
                {wasCorrect ? <PartyPopper className="w-12 h-12 mx-auto text-green-500" /> : <AlertTriangle className="w-12 h-12 mx-auto text-red-500" />}
                <h2 className={cn("font-orbitron text-3xl font-bold", wasCorrect ? "text-green-500" : "text-red-500")}>{wasCorrect ? "ACERTOU!" : "ERROU!"}</h2>
                <p className="font-medium">{wasCorrect ? scenario.mycroftFeedback.correct : scenario.mycroftFeedback.wrong}</p>
                <p className="text-xs text-muted-foreground mt-4">{scenario.outcome.happened}</p>
                <div className="flex justify-center gap-4 mt-4 text-sm">
                  <span className="text-muted-foreground">Acurácia: <span className={cn("font-bold", accuracy >= 70 ? "text-green-500" : "text-red-500")}>{accuracy}%</span></span>
                  <span className="text-muted-foreground">Streak: <span className="font-bold text-primary">{game.streak}</span></span>
                </div>
              </div>
              <GoldButton onClick={handleNext} className="w-full py-6">
                {game.currentIndex >= scenarios.length - 1 ? 'VER RESULTADO FINAL' : 'PRÓXIMO CENÁRIO'}
                <ArrowRight className="ml-2 w-5 h-5" />
              </GoldButton>
            </motion.div>
          )}

          {phase === 'gameover' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-6">
              <h2 className="font-orbitron text-4xl font-bold text-red-500">GAME OVER</h2>
              <p className="text-muted-foreground">Suas vidas acabaram. Acurácia final: {accuracy}%</p>
              <p className="text-sm text-muted-foreground">Você precisa de pelo menos 70% de acerto para desbloquear o modo ao vivo.</p>
              <GoldButton onClick={handleRestart} variant="outline"><RotateCcw className="mr-1.5" /> Tentar Novamente</GoldButton>
            </motion.div>
          )}

          {phase === 'victory' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12 space-y-6">
              <h2 className="font-orbitron text-3xl font-bold text-yellow-500">TREINO CONCLUÍDO</h2>
              <p className="text-muted-foreground">Acurácia: <span className="text-red-500 font-bold">{accuracy}%</span></p>
              <p className="text-sm text-muted-foreground">Você precisa de pelo menos <span className="font-bold text-primary">70%</span> para desbloquear o modo ao vivo. Continue treinando!</p>
              <div className="flex gap-3 justify-center">
                <GoldButton onClick={handleRestart} variant="outline"><RotateCcw className="mr-1.5" /> Tentar Novamente</GoldButton>
              </div>
            </motion.div>
          )}

          {phase === 'graduated' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-12 space-y-6">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: 2 }}
              >
                <CheckCircle2 className="w-20 h-20 mx-auto text-green-500" />
              </motion.div>
              <h2 className="font-orbitron text-3xl font-bold text-green-500">APROVADO!</h2>
              <p className="text-lg font-medium">Acurácia: <span className="text-green-500">{accuracy}%</span> | BC: {game.bluffCoins.toLocaleString()}</p>
              <p className="text-muted-foreground">Modo ao vivo desbloqueado! Você demonstrou disciplina e leitura de mercado.</p>
              <GoldButton onClick={() => navigate('/arena-trader-sports')} className="py-6 px-8">
                <Zap className="mr-2 w-5 h-5" /> ENTRAR NO MODO AO VIVO
              </GoldButton>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
