import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, ArrowLeft, Heart, Coins,
  ChevronUp, ChevronDown, Crosshair, Brain
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TrainingChampionScreen from './TrainingChampionScreen';
import { MonocleIcon, PharaohIcon } from './PersonaIcons';
import { GoldEditionCard, parseCards } from './GoldEditionCard';
import { HorusTrashTalk, ReactionButtons } from './HorusTrashTalk';

// ─── Types ───────────────────────────────────────────────────
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

interface TrainingModeProps {
  onBack: () => void;
  handContext?: string;
}

// ─── Constants ───────────────────────────────────────────────
const INITIAL_BANK = 5000;
const MAX_LIVES = 3;
const WIN_TARGET = 10;

// ─── Sound Effects ───────────────────────────────────────────
function playSound(path: string, volume = 0.4) {
  try {
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch(() => {});
  } catch {}
}

// ─── Main Component ──────────────────────────────────────────
const TrainingMode = ({ onBack, handContext }: TrainingModeProps) => {
  const [bank, setBank] = useState(INITIAL_BANK);
  const [lives, setLives] = useState(MAX_LIVES);
  const [scenarioNum, setScenarioNum] = useState(1);
  const [wins, setWins] = useState(0);
  const [totalPlayed, setTotalPlayed] = useState(0);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [raiseValue, setRaiseValue] = useState(6);
  const [gameOver, setGameOver] = useState(false);
  const [isChampion, setIsChampion] = useState(false);
  const [bankAnimation, setBankAnimation] = useState<'gain' | 'loss' | null>(null);
  const [bcEarned, setBcEarned] = useState(0);
  const scenarioStartTime = useRef(Date.now());

  // ─── Persistence ────────────────────────────────────────────
  const persistSession = useCallback(async (earned: number, scenariosWon: number, played: number, champion: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.rpc('record_arena_session', {
        p_user_id: user.id,
        p_apc_earned: earned,
        p_scenarios_won: scenariosWon,
        p_scenarios_played: played,
        p_is_champion: champion,
      });
    } catch (err) {
      console.error('Failed to persist session:', err);
    }
  }, []);

  // ─── Scenario Generation ───────────────────────────────────
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
      scenarioStartTime.current = Date.now();
      // Card dealing sound
      playSound('/audio/horus/bip.mp3', 0.3);
    } catch (err) {
      console.error('Generate error:', err);
      toast.error('Erro ao gerar cenário. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [scenarioNum, handContext]);

  // ─── Action Evaluation ─────────────────────────────────────
  const evaluateAction = useCallback(async (action: string) => {
    if (!scenario) return;
    setIsEvaluating(true);
    // Chip sound on action
    playSound('/audio/horus/bip.mp3', 0.25);
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
      setTotalPlayed(prev => prev + 1);

      if (result.correto) {
        const gain = result.bcGanho || 100;
        setBank(prev => prev + gain);
        setBcEarned(prev => prev + gain);
        setBankAnimation('gain');
        playSound('/audio/horus/acordo.mp3', 0.4);
        setWins(prev => {
          const next = prev + 1;
          if (next >= WIN_TARGET) {
            setIsChampion(true);
            persistSession(bcEarned + gain, next, totalPlayed + 1, true);
          }
          return next;
        });
      } else {
        const loss = result.bcPerdido || 200;
        setBank(prev => Math.max(0, prev - loss));
        setBankAnimation('loss');
        playSound('/audio/horus/erro.mp3', 0.4);
        setLives(prev => {
          const next = prev - 1;
          if (next <= 0) {
            setGameOver(true);
            persistSession(bcEarned, wins, totalPlayed + 1, false);
          }
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
  }, [scenario, raiseValue, bcEarned, wins, totalPlayed, persistSession]);

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
    setTotalPlayed(0);
    setBcEarned(0);
    setScenario(null);
    setEvalResult(null);
    setGameOver(false);
    setIsChampion(false);
  };

  if (isChampion) {
    return <TrainingChampionScreen wins={wins} bank={bank} bcEarned={bcEarned} onRestart={restartTraining} onBack={onBack} />;
  }

  const showingDecisionPhase = scenario && !isLoading && !evalResult && !isEvaluating;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ─── Header ─────────────────────────────────────────── */}
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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: MAX_LIVES }).map((_, i) => (
                <Heart key={i} className={`w-4 h-4 transition-all ${i < lives ? 'text-red-500 fill-red-500' : 'text-muted-foreground/30'}`} />
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
              <span className="text-[hsl(var(--arena-cyan))]">{wins}</span>/{WIN_TARGET}
            </span>
          </div>
        </div>
      </header>

      {/* ─── Progress Bar ─────────────────────────────────── */}
      {(scenario || isLoading || evalResult) && (
        <div className="border-b border-border bg-background/80">
          <div className="max-w-[1200px] mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                Modo Treino
              </span>
              <span className="font-mono text-xs text-foreground whitespace-nowrap">
                Cenário <span className="text-[hsl(var(--arena-cyan))] font-bold">{scenarioNum}</span> de {WIN_TARGET}
              </span>
              <div className="flex-1 relative h-3 rounded-full overflow-hidden bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--arena-cyan))] to-[hsl(var(--arena-gold))]"
                  initial={{ width: 0 }}
                  animate={{ width: `${(wins / WIN_TARGET) * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ boxShadow: '0 0 8px hsl(var(--arena-cyan) / 0.5)' }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-[hsl(var(--arena-cyan))] whitespace-nowrap">
                {Math.round((wins / WIN_TARGET) * 100)}%
              </span>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                {Array.from({ length: MAX_LIVES }).map((_, i) => (
                  <span key={i} className={`text-sm transition-all ${i < lives ? '' : 'opacity-20 grayscale'}`}>❤️</span>
                ))}
              </div>
              <div className="h-4 w-px bg-border" />
              <span className="font-mono text-xs font-bold text-[hsl(var(--arena-gold))] whitespace-nowrap">
                💰 {bank.toLocaleString()} BC
              </span>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* ─── Start / Game Over ──────────────────────────── */}
        {!scenario && !isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 space-y-6">
            {gameOver ? (
              <>
                <div className="text-6xl mb-4">💀</div>
                <h2 className="font-mono text-2xl font-black uppercase text-[hsl(var(--destructive))]">Game Over</h2>
                <p className="font-mono text-sm text-muted-foreground">
                  Você sobreviveu {wins} cenários com {bank.toLocaleString()} BC restantes.
                </p>
                {bcEarned > 0 && (
                  <p className="font-mono text-xs text-[hsl(var(--arena-gold))]">+{bcEarned} BC salvos no seu perfil</p>
                )}
                <div className="flex justify-center gap-3">
                  <Button onClick={restartTraining} className="bg-[hsl(var(--arena-cyan))] text-black font-mono font-bold uppercase tracking-wider">Tentar Novamente</Button>
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
                  Vença {WIN_TARGET} cenários seguidos para ganhar o <span className="text-[hsl(var(--arena-gold))] font-bold">Tiket Dourado</span>.
                  Você tem {MAX_LIVES} vidas e {INITIAL_BANK.toLocaleString()} BC de banca.
                </p>
                <Button
                  onClick={generateScenario}
                  className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider font-mono text-sm px-8 py-3"
                >
                  <Brain className="w-5 h-5 mr-2" /> Iniciar Treino
                </Button>
              </>
            )}
          </motion.div>
        )}

        {/* ─── Loading ────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-6 py-8">
            <div className="flex items-center gap-2 mb-4">
              <MonocleIcon className="text-[hsl(var(--arena-cyan))] animate-pulse" size={20} />
              <span className="font-mono text-sm text-[hsl(var(--arena-cyan))]">Mycroft gerando cenário {scenarioNum}...</span>
            </div>
            <Skeleton className="h-40 w-full rounded-xl bg-secondary/30" />
            <Skeleton className="h-24 w-full rounded-xl bg-secondary/30" />
          </div>
        )}

        {/* ─── Scenario ───────────────────────────────────── */}
        {scenario && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="border border-[hsl(var(--arena-cyan)_/_0.3)] rounded-xl p-6 bg-[hsl(var(--arena-cyan)_/_0.03)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-xs uppercase tracking-widest text-[hsl(var(--arena-cyan))] flex items-center gap-2">
                  <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={16} />
                  Cenário #{scenarioNum} — {scenario.cenario.street}
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))]">
                  Dificuldade: {scenario.dificuldade}/10
                </span>
              </div>

              <p className="font-mono text-sm text-muted-foreground italic mb-5">"{scenario.cenario.contexto}"</p>

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
                  <div className="flex items-center gap-3">
                    {parseCards(scenario.cenario.heroCartas).map((card, i) => (
                      <GoldEditionCard
                        key={i}
                        rank={card.rank}
                        suit={card.suit}
                        size="md"
                        isLeak={evalResult ? !evalResult.correto : false}
                      />
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
                      <GoldEditionCard key={i} rank={card.rank} suit={card.suit} size="sm" />
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

            {/* ─── Hórus Trash Talk (during decision) ──── */}
            {showingDecisionPhase && (
              <HorusTrashTalk active={true} scenarioStartTime={scenarioStartTime.current} />
            )}

            {/* ─── Action Buttons ─────────────────────────── */}
            {showingDecisionPhase && (
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

                {/* Reaction Buttons */}
                <div className="pt-2">
                  <ReactionButtons onReaction={(emoji) => {
                    toast(`Hórus viu seu ${emoji}`, { icon: '👁️', duration: 1500 });
                  }} />
                </div>
              </motion.div>
            )}

            {/* ─── Evaluating ─────────────────────────────── */}
            {isEvaluating && (
              <div className="text-center py-8">
                <MonocleIcon className="mx-auto text-[hsl(var(--arena-cyan))] animate-pulse mb-3" size={32} />
                <p className="font-mono text-sm text-[hsl(var(--arena-cyan))]">Mycroft preparando laudo pericial...</p>
              </div>
            )}

            {/* ─── Result ─────────────────────────────────── */}
            <AnimatePresence>
              {evalResult && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  {/* Mycroft Laudo Pericial */}
                  <div className={`border rounded-xl p-5 ${
                    evalResult.correto
                      ? 'border-[hsl(var(--success)_/_0.4)] bg-[hsl(var(--success)_/_0.05)]'
                      : 'border-[hsl(var(--destructive)_/_0.4)] bg-[hsl(var(--destructive)_/_0.05)]'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={20} />
                      <span className="font-mono text-xs uppercase tracking-wider text-[hsl(var(--arena-cyan))] font-bold">
                        Laudo Pericial — Mycroft 2.0
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
                    <p className="font-mono text-[10px] text-[hsl(var(--arena-cyan)_/_0.3)] uppercase tracking-widest text-right mt-3">
                      Assinado digitalmente — Mycroft 2.0
                    </p>
                  </div>

                  {/* Hórus Comment */}
                  <div className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-lg p-4 bg-[hsl(var(--arena-gold)_/_0.04)]">
                    <div className="flex items-center gap-2 mb-2">
                      <PharaohIcon className="text-[hsl(var(--arena-gold))]" size={18} />
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
