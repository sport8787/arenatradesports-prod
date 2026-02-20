import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, Zap, Trophy, ArrowLeft, Heart, Coins,
  ChevronUp, ChevronDown, Crosshair, Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TrainingChampionScreen from './TrainingChampionScreen';

interface Scenario {
  cenario: {
    heroPosicao: string;
    heroStack: number;
    heroCartas: string;
    vilaoNome: string;
    vilaoPosicao: string;
    vilaoAcao: string;
    vilaoStack: number;
    potAtual: number;
    blinds: string;
    contexto: string;
    boardCards: string;
    street: string;
  };
  acaoCorreta: string;
  raiseIdeal: number | null;
  explicacao: string;
  dificuldade: number;
}

interface EvalResult {
  correto: boolean;
  nota: number;
  feedbackMycroft: string;
  feedbackHorus: string;
  explicacaoDetalhada: string;
  bcGanho: number;
  bcPerdido: number;
  evDiferenca: string;
}

const suitSymbol: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const suitColor: Record<string, string> = {
  s: 'text-foreground', h: 'text-red-500', d: 'text-blue-400', c: 'text-green-400',
};

function parseCards(str: string) {
  const cards: { rank: string; suit: string }[] = [];
  for (let i = 0; i < str.length; i += 2) {
    if (i + 1 < str.length) {
      cards.push({ rank: str[i], suit: str[i + 1].toLowerCase() });
    }
  }
  return cards;
}

interface TrainingModeProps {
  onBack: () => void;
  handContext?: string;
}

const INITIAL_BANK = 5000;
const MAX_LIVES = 3;
const WIN_TARGET = 10;

const TrainingMode = ({ onBack, handContext }: TrainingModeProps) => {
  const [bank, setBank] = useState(INITIAL_BANK);
  const [lives, setLives] = useState(MAX_LIVES);
  const [scenarioNum, setScenarioNum] = useState(1);
  const [wins, setWins] = useState(0);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [raiseValue, setRaiseValue] = useState(6);
  const [gameOver, setGameOver] = useState(false);
  const [isChampion, setIsChampion] = useState(false);
  const [bankAnimation, setBankAnimation] = useState<'gain' | 'loss' | null>(null);

  const generateScenario = useCallback(async () => {
    setIsLoading(true);
    setEvalResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-training', {
        body: { action: 'generate', scenarioNumber: scenarioNum, handContext },
      });
      if (error) throw error;
      setScenario(data);
      setRaiseValue(data?.cenario?.potAtual ? Math.ceil(data.cenario.potAtual * 2.5) : 6);
    } catch (err) {
      console.error('Generate error:', err);
      toast.error('Erro ao gerar cenário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [scenarioNum, handContext]);

  const evaluateAction = useCallback(async (action: string) => {
    if (!scenario) return;
    setIsEvaluating(true);
    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-training', {
        body: {
          action: 'evaluate',
          scenario: scenario.cenario,
          playerAction: action,
          raiseAmount: action === 'Raise' ? raiseValue : null,
          correctAction: scenario.acaoCorreta,
        },
      });
      if (error) throw error;

      const result = data as EvalResult;
      setEvalResult(result);

      if (result.correto) {
        const gain = result.bcGanho || 100;
        setBank(prev => prev + gain);
        setBankAnimation('gain');
        setWins(prev => {
          const next = prev + 1;
          if (next >= WIN_TARGET) setIsChampion(true);
          return next;
        });
      } else {
        const loss = result.bcPerdido || 200;
        setBank(prev => Math.max(0, prev - loss));
        setBankAnimation('loss');
        setLives(prev => {
          const next = prev - 1;
          if (next <= 0) setGameOver(true);
          return next;
        });
      }

      setTimeout(() => setBankAnimation(null), 1500);
    } catch (err) {
      console.error('Evaluate error:', err);
      toast.error('Erro ao avaliar. Tente novamente.');
    } finally {
      setIsEvaluating(false);
    }
  }, [scenario, raiseValue]);

  const nextScenario = () => {
    setScenarioNum(prev => prev + 1);
    setEvalResult(null);
    setScenario(null);
    generateScenario();
  };

  const restartTraining = () => {
    setBank(INITIAL_BANK);
    setLives(MAX_LIVES);
    setScenarioNum(1);
    setWins(0);
    setScenario(null);
    setEvalResult(null);
    setGameOver(false);
    setIsChampion(false);
  };

  if (isChampion) {
    return <TrainingChampionScreen wins={wins} bank={bank} onRestart={restartTraining} onBack={onBack} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Crosshair className="w-5 h-5 text-[hsl(var(--arena-cyan))]" />
              <h1 className="font-mono text-sm font-bold uppercase tracking-[0.15em]">
                <span className="text-[hsl(var(--arena-cyan))]">Modo</span>{' '}
                <span className="text-[hsl(var(--arena-gold))]">Treino</span>
              </h1>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <Heart
                  key={i}
                  className={`w-4 h-4 transition-all ${i < lives ? 'text-red-500 fill-red-500' : 'text-muted-foreground/30'}`}
                />
              ))}
            </div>
            <div className="h-5 w-px bg-border" />
            <motion.div
              animate={bankAnimation === 'gain' ? { scale: [1, 1.2, 1] } : bankAnimation === 'loss' ? { scale: [1, 0.8, 1] } : {}}
              className={`flex items-center gap-1.5 font-mono text-sm font-bold ${
                bankAnimation === 'gain' ? 'text-[hsl(var(--success))]' : bankAnimation === 'loss' ? 'text-[hsl(var(--destructive))]' : 'text-[hsl(var(--arena-gold))]'
              }`}
            >
              <Coins className="w-4 h-4" />
              {bank.toLocaleString()} BC
            </motion.div>
            <div className="h-5 w-px bg-border" />
            <span className="font-mono text-xs text-muted-foreground">
              <span className="text-[hsl(var(--arena-cyan))]">{wins}</span>/{WIN_TARGET} vitórias
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* Start / Game Over */}
        {!scenario && !isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 space-y-6">
            {gameOver ? (
              <>
                <div className="text-6xl mb-4">💀</div>
                <h2 className="font-mono text-2xl font-black uppercase text-[hsl(var(--destructive))]">Game Over</h2>
                <p className="font-mono text-sm text-muted-foreground">
                  Você sobreviveu {wins} cenários com {bank.toLocaleString()} BC restantes.
                </p>
                <div className="flex justify-center gap-3">
                  <Button onClick={restartTraining} className="bg-[hsl(var(--arena-cyan))] text-black font-mono font-bold uppercase tracking-wider">
                    Tentar Novamente
                  </Button>
                  <Button variant="outline" onClick={onBack} className="font-mono">Voltar</Button>
                </div>
              </>
            ) : (
              <>
                <Crosshair className="w-16 h-16 mx-auto text-[hsl(var(--arena-cyan))]" />
                <h2 className="font-mono text-2xl font-black uppercase tracking-wider">
                  <span className="text-[hsl(var(--arena-cyan))]">Modo</span>{' '}
                  <span className="text-[hsl(var(--arena-gold))]">Treino</span>
                </h2>
                <p className="font-mono text-sm text-muted-foreground max-w-md mx-auto">
                  Vença {WIN_TARGET} cenários seguidos para se tornar Campeão da Arena Poker.
                  Você tem {MAX_LIVES} vidas e uma banca de {INITIAL_BANK.toLocaleString()} BC.
                </p>
                <Button
                  onClick={generateScenario}
                  className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider font-mono text-sm px-8 py-3"
                >
                  <Brain className="w-5 h-5 mr-2" />
                  Iniciar Treino
                </Button>
              </>
            )}
          </motion.div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="space-y-6 py-8">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-[hsl(var(--arena-cyan))] animate-pulse" />
              <span className="font-mono text-sm text-[hsl(var(--arena-cyan))]">Mycroft gerando cenário {scenarioNum}...</span>
            </div>
            <Skeleton className="h-40 w-full rounded-xl bg-secondary/30" />
            <Skeleton className="h-24 w-full rounded-xl bg-secondary/30" />
          </div>
        )}

        {/* Scenario */}
        {scenario && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Scenario Card */}
            <div className="border border-[hsl(var(--arena-cyan)_/_0.3)] rounded-xl p-6 bg-[hsl(var(--arena-cyan)_/_0.03)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-xs uppercase tracking-widest text-[hsl(var(--arena-cyan))] flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Cenário #{scenarioNum} — {scenario.cenario.street}
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))]">
                  Dificuldade: {scenario.dificuldade}/10
                </span>
              </div>

              {/* Context */}
              <p className="font-mono text-sm text-muted-foreground italic mb-5">"{scenario.cenario.contexto}"</p>

              {/* Table Layout */}
              <div className="grid grid-cols-2 gap-6">
                {/* Hero */}
                <div className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-lg p-4 bg-[hsl(var(--arena-gold)_/_0.03)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--arena-gold)_/_0.2)] flex items-center justify-center">
                      <Shield className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-[hsl(var(--arena-gold))] uppercase">Você — {scenario.cenario.heroPosicao}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">Stack: {scenario.cenario.heroStack}BB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {parseCards(scenario.cenario.heroCartas).map((card, i) => (
                      <div
                        key={i}
                        className="w-16 h-24 rounded-lg border-2 border-[hsl(var(--arena-gold))] bg-[hsl(var(--arena-gold)_/_0.1)] shadow-[0_0_20px_hsl(var(--arena-gold)_/_0.3)] flex flex-col items-center justify-center"
                      >
                        <span className={`font-bold text-2xl ${suitColor[card.suit]}`}>{card.rank}</span>
                        <span className={`text-lg ${suitColor[card.suit]}`}>{suitSymbol[card.suit]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Villain */}
                <div className="border border-[hsl(var(--destructive)_/_0.3)] rounded-lg p-4 bg-[hsl(var(--destructive)_/_0.03)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--destructive)_/_0.2)] flex items-center justify-center">
                      <Crosshair className="w-4 h-4 text-[hsl(var(--destructive))]" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-[hsl(var(--destructive))] uppercase">{scenario.cenario.vilaoNome} — {scenario.cenario.vilaoPosicao}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">Stack: {scenario.cenario.vilaoStack}BB</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm text-foreground">{scenario.cenario.vilaoAcao}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">Pot:</span>
                    <span className="font-mono text-sm font-bold text-[hsl(var(--arena-gold))]">{scenario.cenario.potAtual}BB</span>
                  </div>
                </div>
              </div>

              {/* Board */}
              {scenario.cenario.boardCards && (
                <div className="mt-4 text-center">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Board</span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {parseCards(scenario.cenario.boardCards).map((card, i) => (
                      <div key={i} className="w-12 h-18 rounded border border-border bg-secondary flex flex-col items-center justify-center p-1">
                        <span className={`font-bold text-lg ${suitColor[card.suit]}`}>{card.rank}</span>
                        <span className={`text-sm ${suitColor[card.suit]}`}>{suitSymbol[card.suit]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dealer Button */}
              <div className="mt-4 flex justify-center">
                <div className="w-10 h-10 rounded-full bg-[hsl(var(--arena-gold))] text-black flex items-center justify-center font-mono text-xs font-black shadow-[0_0_15px_hsl(var(--arena-gold)_/_0.5)]">
                  D
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {!evalResult && !isEvaluating && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <p className="font-mono text-sm text-center text-muted-foreground">O que você faz?</p>
                <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
                  <Button
                    onClick={() => evaluateAction('Fold')}
                    variant="outline"
                    className="font-mono text-sm uppercase tracking-wider h-14 border-muted-foreground/30 hover:border-muted-foreground"
                  >
                    Fold
                  </Button>
                  <Button
                    onClick={() => evaluateAction('Call')}
                    className="font-mono text-sm uppercase tracking-wider h-14 bg-[hsl(var(--arena-cyan))] text-black hover:brightness-110"
                  >
                    Call
                  </Button>
                  <div className="flex items-center gap-2 border border-[hsl(var(--arena-gold)_/_0.5)] rounded-lg p-2 bg-[hsl(var(--arena-gold)_/_0.05)]">
                    <Button
                      onClick={() => evaluateAction('Raise')}
                      className="flex-1 font-mono text-xs uppercase tracking-wider bg-[hsl(var(--arena-gold))] text-black hover:brightness-110 h-10"
                    >
                      Raise
                    </Button>
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => setRaiseValue(v => v + 1)} className="text-[hsl(var(--arena-gold))] hover:text-foreground">
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <span className="font-mono text-xs text-center font-bold w-8">{raiseValue}BB</span>
                      <button onClick={() => setRaiseValue(v => Math.max(2, v - 1))} className="text-[hsl(var(--arena-gold))] hover:text-foreground">
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={() => evaluateAction('All-in')}
                    className="font-mono text-sm uppercase tracking-wider h-14 bg-[hsl(var(--destructive))] text-white hover:brightness-110"
                  >
                    All-in
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Evaluating */}
            {isEvaluating && (
              <div className="text-center py-8">
                <Zap className="w-8 h-8 mx-auto text-[hsl(var(--arena-cyan))] animate-pulse mb-3" />
                <p className="font-mono text-sm text-[hsl(var(--arena-cyan))]">Mycroft analisando sua decisão...</p>
              </div>
            )}

            {/* Result */}
            <AnimatePresence>
              {evalResult && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Mycroft Feedback */}
                  <div className={`border rounded-xl p-5 ${
                    evalResult.correto
                      ? 'border-[hsl(var(--success)_/_0.4)] bg-[hsl(var(--success)_/_0.05)]'
                      : 'border-[hsl(var(--destructive)_/_0.4)] bg-[hsl(var(--destructive)_/_0.05)]'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-5 h-5 text-[hsl(var(--arena-cyan))]" />
                      <span className="font-mono text-xs uppercase tracking-wider text-[hsl(var(--arena-cyan))] font-bold">
                        Relatório Digital — Mycroft 2.0
                      </span>
                      <span className={`ml-auto font-mono text-2xl font-black ${
                        evalResult.correto ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                      }`}>
                        {evalResult.nota}/100
                      </span>
                    </div>
                    <p className="font-mono text-sm text-foreground mb-2">{evalResult.feedbackMycroft}</p>
                    <p className="font-mono text-xs text-muted-foreground">{evalResult.explicacaoDetalhada}</p>
                    {evalResult.evDiferenca && (
                      <p className="font-mono text-[10px] text-[hsl(var(--arena-cyan)_/_0.6)] mt-2">
                        EV Diferença: {evalResult.evDiferenca}
                      </p>
                    )}
                  </div>

                  {/* Hórus Comment */}
                  <div className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-lg p-4 bg-[hsl(var(--arena-gold)_/_0.04)]">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-gold))] font-bold">Hórus diz:</span>
                    </div>
                    <p className="font-mono text-sm text-[hsl(var(--arena-gold))] italic">"{evalResult.feedbackHorus}"</p>
                  </div>

                  {/* BC Change */}
                  <div className="text-center">
                    <p className={`font-mono text-lg font-bold ${
                      evalResult.correto ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                    }`}>
                      {evalResult.correto ? `+${evalResult.bcGanho} BC` : `-${evalResult.bcPerdido} BC`}
                    </p>
                  </div>

                  {/* Next button */}
                  {!gameOver && (
                    <div className="text-center pt-2">
                      <Button
                        onClick={nextScenario}
                        className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider font-mono"
                      >
                        Próximo Cenário →
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>
    </div>
  );
};

export default TrainingMode;
