import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Heart, Star, Target, RotateCcw, Trophy, Zap, AlertTriangle, PartyPopper } from 'lucide-react';
import GoldButton from '@/components/game/GoldButton';
import { trainingScenarios } from '@/data/trainingScenarios';
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
  const [phase, setPhase] = useState<Phase>('scenario');
  const [wasCorrect, setWasCorrect] = useState(false);

  const scenario = trainingScenarios[game.currentIndex];

  const handleDecision = useCallback((decision: Decision) => {
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

  const handleNext = useCallback(() => {
    if (game.lives <= 0) {
      setPhase('gameover');
    } else if (game.currentIndex >= trainingScenarios.length - 1) {
      setPhase('victory');
    } else {
      setGame(prev => ({ ...prev, currentIndex: prev.currentIndex + 1 }));
      setPhase('scenario');
    }
  }, [game.lives, game.currentIndex]);

  const handleRestart = () => {
    setGame(initialState);
    setPhase('scenario');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex justify-between items-center">
          <button onClick={() => navigate('/arena-trader-sports')} className="text-muted-foreground hover:text-foreground"><ArrowLeft /></button>
          <div className="flex gap-4">
            <div className="flex items-center gap-1.5 text-sm font-bold"><Heart className="text-red-500 fill-red-500" /> {game.lives}</div>
            <div className="flex items-center gap-1.5 text-sm font-bold"><Trophy className="text-yellow-500" /> {game.bluffCoins.toLocaleString()} BC</div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <AnimatePresence mode="wait">
          {phase === 'scenario' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
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
            <div className="flex flex-col items-center justify-center py-20 gap-6">
              <div className="relative w-24 h-24">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} className="w-full h-full border-4 border-primary/20 border-t-primary rounded-full" />
                <Zap className="absolute inset-0 m-auto w-8 h-8 text-primary animate-pulse" />
              </div>
              <h3 className="font-orbitron text-xl font-bold text-primary text-center">Analisando...</h3>
            </div>
          )}

          {phase === 'result' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6">
              <div className={cn("p-8 rounded-3xl border-2 text-center space-y-4", wasCorrect ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30")}>
                {wasCorrect ? <PartyPopper className="w-12 h-12 mx-auto text-green-500" /> : <AlertTriangle className="w-12 h-12 mx-auto text-red-500" />}
                <h2 className={cn("font-orbitron text-3xl font-bold", wasCorrect ? "text-green-500" : "text-red-500")}>{wasCorrect ? "ACERTOU!" : "ERROU!"}</h2>
                <p className="font-medium">{wasCorrect ? scenario.mycroftFeedback.correct : scenario.mycroftFeedback.wrong}</p>
                <p className="text-xs text-muted-foreground mt-4">{scenario.outcome.happened}</p>
              </div>
              <GoldButton onClick={handleNext} className="w-full py-6">PRÓXIMO CENÁRIO <ArrowRight className="ml-2 w-5 h-5" /></GoldButton>
            </motion.div>
          )}

          {(phase === 'gameover' || phase === 'victory') && (
            <div className="text-center py-12 space-y-6">
              <h2 className="font-orbitron text-4xl font-bold">{phase === 'gameover' ? 'GAME OVER' : 'VITÓRIA!'}</h2>
              <p className="text-muted-foreground">{phase === 'gameover' ? 'Suas vidas acabaram.' : 'Você completou o treino!'}</p>
              <div className="flex gap-3 justify-center">
                <GoldButton onClick={handleRestart} variant="outline"><RotateCcw className="mr-1.5" /> Recomeçar</GoldButton>
                <GoldButton onClick={() => navigate('/arena-trader-sports')}>Arena Trader Sports</GoldButton>
              </div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}