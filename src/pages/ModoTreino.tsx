import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Heart, Star, Target, Clock, RotateCcw, Trophy, Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import GoldButton from '@/components/game/GoldButton';
import { trainingScenarios, type TrainingScenario } from '@/data/trainingScenarios';
import { cn } from '@/lib/utils';

type Decision = 'ENTRO' | 'AGUARDO' | 'NAO_ENTRO';
type Phase = 'scenario' | 'loading' | 'result' | 'gameover' | 'victory';

interface GameState {
  currentIndex: number;
  bluffCoins: number;
  lives: number;
  correctCount: number;
  totalAnswered: number;
  streak: number;
  bestStreak: number;
}

const initialState: GameState = {
  currentIndex: 0,
  bluffCoins: 5000,
  lives: 3,
  correctCount: 0,
  totalAnswered: 0,
  streak: 0,
  bestStreak: 0,
};

export default function ModoTreino() {
  const navigate = useNavigate();
  const [game, setGame] = useState<GameState>(initialState);
  const [phase, setPhase] = useState<Phase>('scenario');
  const [lastDecision, setLastDecision] = useState<Decision | null>(null);
  const [wasCorrect, setWasCorrect] = useState(false);

  const scenario = trainingScenarios[game.currentIndex];
  const winRate = game.totalAnswered > 0 ? Math.round((game.correctCount / game.totalAnswered) * 100) : 0;

  const handleDecision = useCallback((decision: Decision) => {
    setLastDecision(decision);
    setPhase('loading');

    setTimeout(() => {
      const isCorrect = decision === scenario.correctDecision;
      setWasCorrect(isCorrect);

      setGame(prev => {
        const newCoins = prev.bluffCoins + (isCorrect ? scenario.rewards.correct : scenario.rewards.wrong);
        const newLives = !isCorrect && scenario.rewards.loseLife ? prev.lives - 1 : prev.lives;
        const newStreak = isCorrect ? prev.streak + 1 : 0;

        return {
          ...prev,
          bluffCoins: Math.max(0, newCoins),
          lives: newLives,
          correctCount: prev.correctCount + (isCorrect ? 1 : 0),
          totalAnswered: prev.totalAnswered + 1,
          streak: newStreak,
          bestStreak: Math.max(prev.bestStreak, newStreak),
        };
      });

      setPhase('result');
    }, 2000);
  }, [scenario]);

  const handleNext = useCallback(() => {
    if (game.lives <= 0) {
      setPhase('gameover');
      return;
    }
    if (game.currentIndex >= trainingScenarios.length - 1) {
      setPhase('victory');
      return;
    }
    setGame(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
    setPhase('scenario');
    setLastDecision(null);
  }, [game.lives, game.currentIndex]);

  const handleRestart = () => {
    setGame(initialState);
    setPhase('scenario');
    setLastDecision(null);
  };

  const difficultyStars = (d: number) => Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className={cn('w-4 h-4', i < d ? 'fill-primary text-primary' : 'text-muted-foreground/30')} />
  ));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-orbitron text-sm md:text-base font-bold text-primary">MODO TREINO</h1>
            <div className="flex items-center gap-4">
              <span className="text-xs md:text-sm font-orbitron text-foreground">💰 {game.bluffCoins.toLocaleString()} BC</span>
              <span className="text-xs md:text-sm">{Array.from({ length: 3 }, (_, i) => (
                <span key={i} className={cn('transition-opacity', i < game.lives ? 'opacity-100' : 'opacity-20')}>❤️</span>
              ))}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <Progress value={((game.currentIndex + (phase === 'result' ? 1 : 0)) / trainingScenarios.length) * 100} className="h-2 flex-1" />
            <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
              {game.currentIndex + (phase === 'result' ? 1 : 0)}/{trainingScenarios.length}
            </span>
            {game.totalAnswered > 0 && (
              <span className="text-xs font-orbitron text-primary whitespace-nowrap">WR: {winRate}%</span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <AnimatePresence mode="wait">
          {/* SCENARIO PHASE */}
          {phase === 'scenario' && scenario && (
            <motion.div key={`scenario-${scenario.id}`} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="space-y-5">
              {/* Scenario Header */}
              <div className="text-center space-y-1">
                <p className="text-muted-foreground text-xs uppercase tracking-wider">🎮 Cenário #{scenario.id}</p>
                <div className="flex items-center justify-center gap-1">{difficultyStars(scenario.difficulty)}</div>
              </div>

              {/* Match Card */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase">{scenario.competition}</p>
                  <h2 className="font-orbitron text-lg font-bold text-foreground mt-1">{scenario.match}</h2>
                  <div className="flex items-center justify-center gap-3 mt-2">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" /> {scenario.minute}'
                    </span>
                    <span className="font-orbitron text-xl font-bold text-foreground">{scenario.score}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="bg-secondary/30 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">📊 Dados do jogo</p>
                  {[
                    ['Ataques perigosos', scenario.stats.attacks_home, scenario.stats.attacks_away],
                    ['xG', scenario.stats.xG_home.toFixed(1), scenario.stats.xG_away.toFixed(1)],
                    ['Posse', `${scenario.stats.possession_home}%`, `${100 - scenario.stats.possession_home}%`],
                  ].map(([label, home, away]) => (
                    <div key={label as string} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground w-16 text-right">{home}</span>
                      <span className="text-muted-foreground text-xs flex-1 text-center">{label}</span>
                      <span className="font-medium text-foreground w-16 text-left">{away}</span>
                    </div>
                  ))}
                </div>

                {/* Market */}
                <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-lg p-3">
                  <div>
                    <p className="text-xs text-muted-foreground">💰 Mercado</p>
                    <p className="font-bold text-foreground">{scenario.market}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Odd</p>
                    <p className="font-orbitron text-xl font-bold text-primary">@ {scenario.odd.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Horus Quote */}
              <div className="bg-card border border-primary/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary mb-2">🦅 HÓRUS PROVOCA:</p>
                <p className="text-sm text-foreground italic leading-relaxed">"{scenario.horusQuote}"</p>
              </div>

              {/* Decision Buttons */}
              <div className="space-y-2">
                <p className="text-center text-sm font-semibold text-muted-foreground uppercase">O que você faz?</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <GoldButton onClick={() => handleDecision('ENTRO')} className="w-full">
                    <Target className="w-4 h-4 mr-1.5" /> Entro Agora
                  </GoldButton>
                  <GoldButton variant="outline" onClick={() => handleDecision('AGUARDO')} className="w-full">
                    <Clock className="w-4 h-4 mr-1.5" /> Aguardo
                  </GoldButton>
                  <GoldButton variant="ghost" onClick={() => handleDecision('NAO_ENTRO')} className="w-full border border-border">
                    ❌ Não Entro
                  </GoldButton>
                </div>
              </div>
            </motion.div>
          )}

          {/* LOADING PHASE */}
          {phase === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20 space-y-6">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                <Zap className="w-16 h-16 text-primary" />
              </motion.div>
              <p className="font-orbitron text-lg text-foreground">Analisando decisão...</p>
              <p className="text-sm text-muted-foreground">Mycroft está verificando o resultado real</p>
            </motion.div>
          )}

          {/* RESULT PHASE */}
          {phase === 'result' && scenario && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              {/* Verdict Badge */}
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.2 }} className="text-center">
                <div className={cn(
                  'inline-flex items-center gap-3 px-6 py-4 rounded-2xl font-orbitron text-xl font-bold',
                  wasCorrect ? 'bg-success/20 text-success border border-success/30' : 'bg-destructive/20 text-destructive border border-destructive/30'
                )}>
                  {wasCorrect ? '✅ DECISÃO CORRETA!' : '❌ DECISÃO ERRADA'}
                </div>
              </motion.div>

              {/* Outcome */}
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground uppercase mb-1">O que aconteceu no jogo real:</p>
                <p className="font-bold text-foreground">{scenario.outcome.happened}</p>
                <p className={cn('font-orbitron text-lg font-bold mt-1', wasCorrect ? 'text-success' : 'text-destructive')}>
                  {scenario.outcome.result}
                </p>
              </div>

              {/* Mycroft Feedback */}
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-xs font-semibold text-primary mb-3">🔬 ANÁLISE MYCROFT:</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {wasCorrect ? scenario.mycroftFeedback.correct : scenario.mycroftFeedback.wrong}
                </p>
              </div>

              {/* Rewards */}
              <div className="flex items-center justify-center gap-6">
                <div className={cn('text-center', wasCorrect ? 'text-success' : 'text-destructive')}>
                  <p className="text-xs text-muted-foreground">BluffCoins</p>
                  <p className="font-orbitron text-lg font-bold">
                    {wasCorrect ? `+${scenario.rewards.correct}` : scenario.rewards.wrong}
                  </p>
                </div>
                {!wasCorrect && scenario.rewards.loseLife && (
                  <div className="text-center text-destructive">
                    <p className="text-xs text-muted-foreground">Vida</p>
                    <p className="font-orbitron text-lg font-bold">-1 ❤️</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="font-orbitron text-lg font-bold text-foreground">{winRate}%</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <GoldButton onClick={handleNext} className="flex-1">
                  <ArrowRight className="w-4 h-4 mr-1.5" />
                  {game.currentIndex >= trainingScenarios.length - 1 ? 'Ver Resultado Final' : 'Próximo Cenário'}
                </GoldButton>
              </div>
            </motion.div>
          )}

          {/* GAME OVER */}
          {phase === 'gameover' && (
            <motion.div key="gameover" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 py-12">
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl">💀</motion.p>
              <h2 className="font-orbitron text-2xl font-bold text-destructive">GAME OVER</h2>
              <p className="text-muted-foreground">Você perdeu todas as vidas.</p>
              <div className="flex flex-wrap justify-center gap-6">
                <div><p className="text-xs text-muted-foreground">Cenários</p><p className="font-orbitron text-lg font-bold text-foreground">{game.totalAnswered}</p></div>
                <div><p className="text-xs text-muted-foreground">Acertos</p><p className="font-orbitron text-lg font-bold text-success">{game.correctCount}</p></div>
                <div><p className="text-xs text-muted-foreground">BluffCoins</p><p className="font-orbitron text-lg font-bold text-foreground">{game.bluffCoins.toLocaleString()}</p></div>
              </div>
              <GoldButton onClick={handleRestart}><RotateCcw className="w-4 h-4 mr-1.5" /> Recomeçar</GoldButton>
            </motion.div>
          )}

          {/* VICTORY */}
          {phase === 'victory' && (
            <motion.div key="victory" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6 py-12">
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }} className="text-6xl">🏆</motion.p>
              <h2 className="font-orbitron text-2xl font-bold text-primary">TREINO COMPLETO!</h2>
              <div className="flex flex-wrap justify-center gap-6">
                <div><p className="text-xs text-muted-foreground">Win Rate</p><p className="font-orbitron text-xl font-bold text-success">{winRate}%</p></div>
                <div><p className="text-xs text-muted-foreground">BluffCoins</p><p className="font-orbitron text-xl font-bold text-foreground">{game.bluffCoins.toLocaleString()}</p></div>
                <div><p className="text-xs text-muted-foreground">Melhor Streak</p><p className="font-orbitron text-xl font-bold text-primary">{game.bestStreak}🔥</p></div>
                <div><p className="text-xs text-muted-foreground">Vidas</p><p className="font-orbitron text-xl font-bold text-foreground">{game.lives} ❤️</p></div>
              </div>
              {/* Badges */}
              <div className="flex flex-wrap justify-center gap-2">
                {winRate === 100 && <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold text-primary">🏆 Perfect Score</span>}
                {game.bestStreak >= 5 && <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold text-primary">🎯 Sniper</span>}
                {game.lives === 3 && <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold text-primary">🛡️ Imortal</span>}
                {game.bluffCoins >= 10000 && <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-bold text-primary">🚀 Whale</span>}
              </div>
              <div className="flex gap-3 justify-center">
                <GoldButton onClick={handleRestart} variant="outline"><RotateCcw className="w-4 h-4 mr-1.5" /> Jogar Novamente</GoldButton>
                <GoldButton onClick={() => navigate('/dashboard')}><ArrowLeft className="w-4 h-4 mr-1.5" /> Dashboard</GoldButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
