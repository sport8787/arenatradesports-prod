import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ArrowLeft, Heart, Coins, ChevronRight, ChevronUp, ChevronDown,
  Crosshair, Brain, Settings, MapPin, Clock, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import TrainingChampionScreen from './TrainingChampionScreen';
import { MonocleIcon, PharaohIcon } from './PersonaIcons';
import { GoldEditionCard, parseCards } from './GoldEditionCard';
import { HorusTrashTalk, ReactionButtons } from './HorusTrashTalk';
import BluffTalkModal from './BluffTalkModal';
import CognitiveLeakReport from './CognitiveLeakReport';
import {
  analyzeDecisionForLeak,
  resetLeakTracker,
  advanceHandIndex,
  getSessionLeaks,
  type DetectedLeak,
} from '@/services/cognitiveLeaksService';

// ─── Types ───────────────────────────────────────────────────
interface StreetData {
  scenarioText: string;
  villainAction: string;
  potSize: number;
  options: string[];
  correctAction: string;
  correctActionSet: string[];
  explanation: string;
  difficulty: number;
}

interface HandData {
  heroCards: string;
  villainName: string;
  villainProfile: string;
  positionHero: string;
  positionVillain: string;
  heroStack: number;
  villainStack: number;
  blinds: string;
  ante: string | null;
  context: string;
  boardFlop: string;
  boardTurn: string;
  boardRiver: string;
}

interface GeneratedHand {
  hand: HandData;
  streets: Record<string, StreetData>;
}

interface LaudoResumo {
  street: string;
  acaoCorreta: string;
  situacao: string;
  matematica: string;
  conclusao: string;
  analiseCompleta: string;
}

interface PerspectiveData {
  acao: string;
  raciocinio: string;
  ev: string;
}

interface EvalResult {
  correto: boolean;
  nota: number;
  feedbackHorus: string;
  bcGanho: number;
  bcPerdido: number;
  evDiferenca: string;
  laudoResumo?: LaudoResumo;
  perspectivas?: {
    tag: PerspectiveData;
    lag: PerspectiveData;
    gto: PerspectiveData;
    jogadorEv: string;
    melhorEstilo: 'tag' | 'lag' | 'gto';
  };
  nextStreetUpdate?: {
    newPotSize: number;
    newHeroStack: number;
    newVillainStack: number;
    handEnded: boolean;
  };
}

interface ActionEntry {
  street: string;
  hero: string;
  villain: string;
  result: 'correct' | 'incorrect' | 'pending';
}

interface StreetContinuationProps {
  onBack: () => void;
}

// ─── Constants ───────────────────────────────────────────────
const STREET_ORDER = ['preflop', 'flop', 'turn', 'river'] as const;
const STREET_LABELS: Record<string, string> = { preflop: 'Preflop', flop: 'Flop', turn: 'Turn', river: 'River' };
const INITIAL_BANK = 5000;
const MAX_LIVES = 3;
const WIN_TARGET = 10;

function playSound(path: string, volume = 0.4) {
  try { const a = new Audio(path); a.volume = volume; a.play().catch(() => {}); } catch {}
}

// ─── Street Progress Indicator ──────────────────────────────
function StreetProgress({ currentStreet, completedStreets }: { currentStreet: string; completedStreets: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {STREET_ORDER.map((s, i) => {
        const done = completedStreets.includes(s);
        const active = s === currentStreet;
        return (
          <div key={s} className="flex items-center">
            <div className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded transition-all ${
              done ? 'bg-[hsl(var(--success)_/_0.2)] text-[hsl(var(--success))] font-bold' :
              active ? 'bg-[hsl(var(--arena-cyan)_/_0.2)] text-[hsl(var(--arena-cyan))] font-bold animate-pulse' :
              'bg-secondary/30 text-muted-foreground/50'
            }`}>
              {done ? '✅' : active ? '⏳' : '⏳'} {STREET_LABELS[s]}
            </div>
            {i < STREET_ORDER.length - 1 && (
              <ChevronRight className={`w-3 h-3 mx-0.5 ${done ? 'text-[hsl(var(--success))]' : 'text-muted-foreground/30'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Action Timeline ─────────────────────────────────────────
function ActionTimeline({ actions }: { actions: ActionEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  if (actions.length === 0) return null;

  const visible = expanded ? actions : actions.slice(-3);

  return (
    <div className="border border-[hsl(var(--border)_/_0.3)] rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 flex items-center justify-between bg-secondary/10 hover:bg-secondary/20 transition-colors"
      >
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> Histórico ({actions.length} ações)
        </span>
        <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      <AnimatePresence>
        <div className="divide-y divide-[hsl(var(--border)_/_0.2)]">
          {visible.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="px-4 py-2 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  a.result === 'correct' ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]' :
                  a.result === 'incorrect' ? 'bg-[hsl(var(--destructive)_/_0.15)] text-[hsl(var(--destructive))]' :
                  'bg-secondary/30 text-muted-foreground'
                }`}>
                  {STREET_LABELS[a.street]}
                </span>
                <span className="font-mono text-xs text-muted-foreground">Vilão: {a.villain}</span>
              </div>
              <span className="font-mono text-xs font-bold text-foreground">{a.hero}</span>
            </motion.div>
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}

// ─── Mycroft Structured Laudo (reused) ──────────────────────
function StreetLaudo({ evalResult }: { evalResult: EvalResult }) {
  const [showFull, setShowFull] = useState(false);
  const laudo = evalResult.laudoResumo;

  if (!laudo) {
    return (
      <div className={`border rounded-xl p-5 ${
        evalResult.correto ? 'border-[hsl(var(--success)_/_0.4)] bg-[hsl(var(--success)_/_0.05)]' : 'border-[hsl(var(--destructive)_/_0.4)] bg-[hsl(var(--destructive)_/_0.05)]'
      }`}>
        <div className="flex items-center gap-2 mb-3">
          <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={20} />
          <span className="font-mono text-xs uppercase tracking-wider text-[hsl(var(--arena-cyan))] font-bold">Laudo Pericial — Mycroft 2.0</span>
          <span className={`ml-auto font-mono text-2xl font-black ${evalResult.correto ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
            {evalResult.nota}/100
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`border rounded-xl overflow-hidden ${
      evalResult.correto ? 'border-[hsl(var(--success)_/_0.4)] bg-[hsl(var(--success)_/_0.05)]' : 'border-[hsl(var(--destructive)_/_0.4)] bg-[hsl(var(--destructive)_/_0.05)]'
    }`}>
      <div className="px-5 py-3 flex items-center gap-2 border-b border-[hsl(var(--border)_/_0.3)]">
        <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={20} />
        <span className="font-mono text-xs uppercase tracking-wider text-[hsl(var(--arena-cyan))] font-bold">{laudo.street} — {laudo.acaoCorreta}</span>
        <span className={`ml-auto font-mono text-2xl font-black ${evalResult.correto ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
          {evalResult.nota}/100
        </span>
      </div>
      <div className="px-5 py-4 space-y-4">
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">📊 <span>Situação</span></p>
          <p className="font-mono text-sm text-foreground">{laudo.situacao}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">📈 <span>Matemática</span></p>
          <div className="space-y-0.5">
            {laudo.matematica.split('\n').map((line, i) => (
              <p key={i} className="font-mono text-xs text-foreground">{line}</p>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.5 }} className="border-t border-[hsl(var(--border)_/_0.3)] pt-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 flex items-center gap-1.5">💡 <span>Conclusão</span></p>
          <p className={`font-mono text-sm font-bold ${evalResult.correto ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>{laudo.conclusao}</p>
        </motion.div>
        <div className="border-t border-[hsl(var(--border)_/_0.3)] pt-2">
          <button onClick={() => setShowFull(!showFull)} className="w-full flex items-center justify-between py-2 group">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[hsl(var(--arena-cyan)_/_0.6)] group-hover:text-[hsl(var(--arena-cyan))] transition-colors">Ver Análise Completa</span>
            <ChevronRight className={`w-3.5 h-3.5 text-[hsl(var(--arena-cyan)_/_0.5)] transition-transform duration-200 ${showFull ? 'rotate-90' : ''}`} />
          </button>
          <AnimatePresence>
            {showFull && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <p className="font-mono text-xs text-muted-foreground pb-3 leading-relaxed">{laudo.analiseCompleta}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────
const StreetContinuationTraining = ({ onBack }: StreetContinuationProps) => {
  // Run state
  const [bank, setBank] = useState(INITIAL_BANK);
  const [lives, setLives] = useState(MAX_LIVES);
  const [handsCompleted, setHandsCompleted] = useState(0);
  const [totalDecisions, setTotalDecisions] = useState(0);
  const [bcEarned, setBcEarned] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isChampion, setIsChampion] = useState(false);
  const [errorMode, setErrorMode] = useState<'study' | 'challenge'>('challenge');
  const [showSettings, setShowSettings] = useState(false);

  // Hand state
  const [currentHand, setCurrentHand] = useState<GeneratedHand | null>(null);
  const [currentStreetIdx, setCurrentStreetIdx] = useState(0);
  const [completedStreets, setCompletedStreets] = useState<string[]>([]);
  const [actionHistory, setActionHistory] = useState<ActionEntry[]>([]);
  const [evalResult, setEvalResult] = useState<EvalResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [bankAnimation, setBankAnimation] = useState<'gain' | 'loss' | null>(null);

  // Dynamic stacks
  const [currentPot, setCurrentPot] = useState(0);
  const [currentHeroStack, setCurrentHeroStack] = useState(0);
  const [currentVillainStack, setCurrentVillainStack] = useState(0);

  // Bluff talk
  const [showBluffTalk, setShowBluffTalk] = useState(false);
  const [lastPlayerAction, setLastPlayerAction] = useState('');
  const [bluffTalkEnabled, setBluffTalkEnabled] = useState(true);

  // Study mode retry
  const [showRetryHint, setShowRetryHint] = useState(false);
  const [detectedLeak, setDetectedLeak] = useState<DetectedLeak | null>(null);

  const scenarioStartTime = useRef(Date.now());
  const runIdRef = useRef<string | null>(null);
  const handSessionIdRef = useRef<string | null>(null);

  const currentStreet = STREET_ORDER[currentStreetIdx];
  const streetData = currentHand?.streets[currentStreet];

  // ─── Create Run in DB ──────────────────────────────────────
  const createRun = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase.from('training_runs') as any).insert({
        user_id: user.id,
        error_mode: errorMode,
        bankroll_start: INITIAL_BANK,
        bankroll_current: INITIAL_BANK,
      }).select('id').single();
      if (data) runIdRef.current = data.id;
    } catch (err) { console.error('Create run error:', err); }
  }, [errorMode]);

  // ─── Generate Hand ─────────────────────────────────────────
  const generateHand = useCallback(async () => {
    setIsLoading(true);
    setEvalResult(null);
    setCompletedStreets([]);
    setActionHistory([]);
    setCurrentStreetIdx(0);
    setShowRetryHint(false);

    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-street-training', {
        body: { action: 'generate_hand', scenarioNumber: handsCompleted + 1 },
      });
      if (error) throw error;
      
      const hand = data as GeneratedHand;
      setCurrentHand(hand);
      setCurrentPot(hand.streets.preflop?.potSize || 0);
      setCurrentHeroStack(hand.hand.heroStack);
      setCurrentVillainStack(hand.hand.villainStack);
      scenarioStartTime.current = Date.now();
      playSound('/audio/horus/bip.mp3', 0.3);

      // Persist hand session
      const { data: { user } } = await supabase.auth.getUser();
      if (user && runIdRef.current) {
        const { data: session } = await (supabase.from('training_hand_sessions') as any).insert({
          training_run_id: runIdRef.current,
          user_id: user.id,
          hand_number: handsCompleted + 1,
          hero_hole_cards: hand.hand.heroCards,
          villain_profile: hand.hand.villainProfile,
          villain_name: hand.hand.villainName,
          initial_stacks_json: { hero: hand.hand.heroStack, villain: hand.hand.villainStack },
          blind_level: hand.hand.blinds,
          ante: hand.hand.ante,
          position_hero: hand.hand.positionHero,
          position_villain: hand.hand.positionVillain,
          pot_size: hand.streets.preflop?.potSize || 0,
          hero_stack: hand.hand.heroStack,
          villain_stack: hand.hand.villainStack,
          board_cards_flop: hand.hand.boardFlop,
          board_cards_turn: hand.hand.boardTurn,
          board_cards_river: hand.hand.boardRiver,
        }).select('id').single();
        if (session) handSessionIdRef.current = session.id;
      }
    } catch (err) {
      console.error('Generate error:', err);
      toast.error('Erro ao gerar mão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  }, [handsCompleted]);

  // ─── Get Board Cards ───────────────────────────────────────
  const getBoardCards = useCallback((): string => {
    if (!currentHand) return '';
    const h = currentHand.hand;
    switch (currentStreet) {
      case 'preflop': return '';
      case 'flop': return h.boardFlop;
      case 'turn': return `${h.boardFlop}${h.boardTurn}`;
      case 'river': return `${h.boardFlop}${h.boardTurn}${h.boardRiver}`;
      default: return '';
    }
  }, [currentHand, currentStreet]);

  // ─── Evaluate Street Action ────────────────────────────────
  const evaluateAction = useCallback(async (action: string) => {
    if (!currentHand || !streetData) return;
    setIsEvaluating(true);
    setLastPlayerAction(action);
    playSound('/audio/horus/bip.mp3', 0.25);

    try {
      const { data, error } = await supabase.functions.invoke('arena-poker-street-training', {
        body: {
          action: 'evaluate_street',
          heroCards: currentHand.hand.heroCards,
          positionHero: currentHand.hand.positionHero,
          villainName: currentHand.hand.villainName,
          villainProfile: currentHand.hand.villainProfile,
          positionVillain: currentHand.hand.positionVillain,
          boardCards: getBoardCards(),
          street: currentStreet,
          potSize: currentPot,
          heroStack: currentHeroStack,
          villainStack: currentVillainStack,
          actionHistory,
          scenarioText: streetData.scenarioText,
          villainAction: streetData.villainAction,
          playerAction: action,
          correctAction: streetData.correctAction,
          correctActionSet: streetData.correctActionSet,
        },
      });
      if (error) throw error;

      const result = data as EvalResult;
      setEvalResult(result);
      setTotalDecisions(prev => prev + 1);

      // Update action history
      setActionHistory(prev => [...prev, {
        street: currentStreet,
        hero: action,
        villain: streetData.villainAction,
        result: result.correto ? 'correct' : 'incorrect',
      }]);

      // Persist street to DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user && handSessionIdRef.current) {
        await (supabase.from('training_streets') as any).insert({
          training_hand_session_id: handSessionIdRef.current,
          user_id: user.id,
          street: currentStreet,
          board_cards: getBoardCards() || null,
          pot_size: currentPot,
          hero_stack: currentHeroStack,
          villain_stack: currentVillainStack,
          action_history_json: actionHistory,
          scenario_text: streetData.scenarioText,
          hero_options_json: streetData.options,
          hero_decision: action,
          correct_action_json: { correct: streetData.correctAction, set: streetData.correctActionSet },
          result: result.correto ? 'correct' : 'incorrect',
          feedback_mycroft_text: result.laudoResumo?.analiseCompleta || '',
          verdict_horus_text: result.feedbackHorus,
          nota: result.nota,
          ev_analysis_json: result.perspectivas || null,
        });
      }

      if (result.correto) {
        const gain = result.bcGanho || 100;
        setBank(prev => prev + gain);
        setBcEarned(prev => prev + gain);
        setBankAnimation('gain');
        playSound('/audio/horus/acordo.mp3', 0.4);
        setCompletedStreets(prev => [...prev, currentStreet]);

        // Update stacks from AI response
        if (result.nextStreetUpdate) {
          setCurrentPot(result.nextStreetUpdate.newPotSize);
          setCurrentHeroStack(result.nextStreetUpdate.newHeroStack);
          setCurrentVillainStack(result.nextStreetUpdate.newVillainStack);
        }

        // Cognitive leak analysis (also on correct — tracks full history)
        const leakResult = analyzeDecisionForLeak({
          street: currentStreet,
          playerAction: action,
          correctAction: streetData.correctAction,
          wasCorrect: true,
          nota: result.nota,
          evDiferenca: result.evDiferenca,
          potSize: currentPot,
          heroStack: currentHeroStack,
          scenarioText: streetData.scenarioText,
        });
        setDetectedLeak(leakResult);
      } else {
        const loss = result.bcPerdido || 200;
        setBank(prev => Math.max(0, prev - loss));
        setBankAnimation('loss');
        playSound('/audio/horus/erro.mp3', 0.4);

        // Cognitive leak analysis on errors
        const leakResult = analyzeDecisionForLeak({
          street: currentStreet,
          playerAction: action,
          correctAction: streetData.correctAction,
          wasCorrect: false,
          nota: result.nota,
          evDiferenca: result.evDiferenca,
          potSize: currentPot,
          heroStack: currentHeroStack,
          scenarioText: streetData.scenarioText,
        });
        setDetectedLeak(leakResult);

        if (errorMode === 'challenge') {
          setLives(prev => {
            const next = prev - 1;
            if (next <= 0) {
              setGameOver(true);
              persistSession(bcEarned, handsCompleted, totalDecisions + 1, false);
            }
            return next;
          });
        } else {
          // Study mode: show hint and allow retry
          setShowRetryHint(true);
        }
      }

      setTimeout(() => setBankAnimation(null), 1500);
    } catch (err) {
      console.error('Evaluate error:', err);
      toast.error('Erro ao avaliar. Tente novamente.');
    } finally {
      setIsEvaluating(false);
    }
  }, [currentHand, streetData, currentStreet, currentPot, currentHeroStack, currentVillainStack, actionHistory, getBoardCards, errorMode, bcEarned, handsCompleted, totalDecisions]);

  // ─── Advance to Next Street / Hand ─────────────────────────
  const advanceAfterFeedback = useCallback(() => {
    if (!evalResult) return;

    const handEnded = evalResult.nextStreetUpdate?.handEnded;
    const isLastStreet = currentStreetIdx >= STREET_ORDER.length - 1;

    if (evalResult.correto && !handEnded && !isLastStreet) {
      // Show bluff talk modal for flop/turn/river if enabled
      if (bluffTalkEnabled && currentStreetIdx >= 0) {
        setShowBluffTalk(true);
      } else {
        moveToNextStreet();
      }
    } else {
      // Hand completed or ended
      if (evalResult.correto || handEnded) {
        completeHand();
      } else if (errorMode === 'study') {
        // In study mode, can retry
        setEvalResult(null);
        setShowRetryHint(false);
      } else {
        // Challenge mode: move to next hand
        moveToNextHand();
      }
    }
  }, [evalResult, currentStreetIdx, bluffTalkEnabled, errorMode]);

  const moveToNextStreet = () => {
    setCurrentStreetIdx(prev => prev + 1);
    setEvalResult(null);
    setShowRetryHint(false);
    scenarioStartTime.current = Date.now();
  };

  const completeHand = () => {
    advanceHandIndex();
    setHandsCompleted(prev => {
      const next = prev + 1;
      if (next >= WIN_TARGET) {
        setIsChampion(true);
        persistSession(bcEarned, next, totalDecisions, true);
      }
      return next;
    });

    // Update hand session status
    if (handSessionIdRef.current) {
      (supabase.from('training_hand_sessions') as any).update({
        status: 'cleared',
        current_street: 'completed',
        pot_size: currentPot,
        hero_stack: currentHeroStack,
        villain_stack: currentVillainStack,
      }).eq('id', handSessionIdRef.current).then(() => {});
    }

    moveToNextHand();
  };

  const moveToNextHand = () => {
    setCurrentHand(null);
    setEvalResult(null);
    setCompletedStreets([]);
    setActionHistory([]);
    setCurrentStreetIdx(0);
    setShowRetryHint(false);
    setDetectedLeak(null);
  };

  const handleBluffTalkComplete = () => {
    setShowBluffTalk(false);
    moveToNextStreet();
  };

  // ─── Persist Session ───────────────────────────────────────
  const persistSession = useCallback(async (earned: number, hands: number, decisions: number, champion: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.rpc('record_arena_session', {
        p_user_id: user.id,
        p_apc_earned: earned,
        p_scenarios_won: hands,
        p_scenarios_played: decisions,
        p_is_champion: champion,
      });
      if (runIdRef.current) {
        await (supabase.from('training_runs') as any).update({
          status: champion ? 'completed' : 'failed',
          lives_remaining: lives,
          bankroll_current: bank,
          hands_completed: hands,
          golden_ticket_progress_delta: champion ? 1 : 0,
          ended_at: new Date().toISOString(),
        }).eq('id', runIdRef.current);
      }
    } catch (err) { console.error('Persist session error:', err); }
  }, [lives, bank]);

  // ─── Restart ───────────────────────────────────────────────
  const restartTraining = () => {
    resetLeakTracker();
    setBank(INITIAL_BANK);
    setLives(MAX_LIVES);
    setHandsCompleted(0);
    setTotalDecisions(0);
    setBcEarned(0);
    setCurrentHand(null);
    setEvalResult(null);
    setCompletedStreets([]);
    setActionHistory([]);
    setCurrentStreetIdx(0);
    setGameOver(false);
    setIsChampion(false);
    setShowRetryHint(false);
    runIdRef.current = null;
    handSessionIdRef.current = null;
  };

  // ─── Start ─────────────────────────────────────────────────
  const startTraining = async () => {
    await createRun();
    generateHand();
  };

  // ─── Champion ──────────────────────────────────────────────
  if (isChampion) {
    return <TrainingChampionScreen wins={handsCompleted} bank={bank} bcEarned={bcEarned} onRestart={restartTraining} onBack={onBack} />;
  }

  const showDecision = currentHand && streetData && !isLoading && !evalResult && !isEvaluating;

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
              <MapPin className="w-5 h-5 text-[hsl(var(--arena-cyan))]" />
              <h1 className="font-mono text-sm font-bold uppercase tracking-[0.15em]">
                <span className="text-[hsl(var(--arena-cyan))]">Street</span>{' '}
                <span className="text-[hsl(var(--arena-gold))]">Continuation</span>
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
              <span className="text-[hsl(var(--arena-cyan))]">{handsCompleted}</span>/{WIN_TARGET} mãos
            </span>
            <button onClick={() => setShowSettings(!showSettings)} className="text-muted-foreground hover:text-foreground">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings panel */}
        <AnimatePresence>
          {showSettings && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-border">
              <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">Modo erro:</span>
                  <button
                    onClick={() => setErrorMode('study')}
                    className={`font-mono text-xs px-3 py-1 rounded-full transition-all ${errorMode === 'study' ? 'bg-[hsl(var(--arena-cyan)_/_0.2)] text-[hsl(var(--arena-cyan))] font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    📚 Estudo
                  </button>
                  <button
                    onClick={() => setErrorMode('challenge')}
                    className={`font-mono text-xs px-3 py-1 rounded-full transition-all ${errorMode === 'challenge' ? 'bg-[hsl(var(--destructive)_/_0.2)] text-[hsl(var(--destructive))] font-bold' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    💀 Desafio
                  </button>
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">Table Talk:</span>
                  <button
                    onClick={() => setBluffTalkEnabled(!bluffTalkEnabled)}
                    className={`font-mono text-xs px-3 py-1 rounded-full transition-all ${bluffTalkEnabled ? 'bg-[hsl(var(--arena-gold)_/_0.2)] text-[hsl(var(--arena-gold))] font-bold' : 'text-muted-foreground'}`}
                  >
                    {bluffTalkEnabled ? '🎙️ ON' : '🔇 OFF'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ─── Street Progress Bar ──────────────────────────── */}
      {currentHand && (
        <div className="border-b border-border bg-background/80">
          <div className="max-w-[1200px] mx-auto px-4 py-3 flex items-center justify-between">
            <StreetProgress currentStreet={currentStreet} completedStreets={completedStreets} />
            <div className="flex items-center gap-4">
              <span className="font-mono text-xs text-muted-foreground">
                Mão <span className="text-[hsl(var(--arena-cyan))] font-bold">{handsCompleted + 1}</span> de {WIN_TARGET}
              </span>
              <div className="flex-shrink-0 w-32 h-2 rounded-full overflow-hidden bg-secondary">
                <motion.div
                  className="h-full bg-gradient-to-r from-[hsl(var(--arena-cyan))] to-[hsl(var(--arena-gold))]"
                  animate={{ width: `${(handsCompleted / WIN_TARGET) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        {/* ─── Start / Game Over ──────────────────────────── */}
        {!currentHand && !isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 space-y-6">
            {gameOver ? (
              <>
                <div className="text-6xl mb-4">💀</div>
                <h2 className="font-mono text-2xl font-black uppercase text-[hsl(var(--destructive))]">Eliminado</h2>
                <p className="font-mono text-sm text-muted-foreground">
                  Sobreviveu a {handsCompleted} mãos com {bank.toLocaleString()} BC restantes.
                </p>
                {bcEarned > 0 && <p className="font-mono text-xs text-[hsl(var(--arena-gold))]">+{bcEarned} BC salvos</p>}
                <div className="flex justify-center gap-3">
                  <Button onClick={restartTraining} className="bg-[hsl(var(--arena-cyan))] text-black font-mono font-bold uppercase tracking-wider">Tentar Novamente</Button>
                  <Button variant="outline" onClick={onBack} className="font-mono">Voltar</Button>
                </div>
              </>
            ) : (
              <>
                <MapPin className="w-16 h-16 mx-auto text-[hsl(var(--arena-cyan))]" />
                <h2 className="font-mono text-2xl font-black uppercase tracking-wider">
                  <span className="text-[hsl(var(--arena-cyan))]">Street</span>{' '}
                  <span className="text-[hsl(var(--arena-gold))]">Continuation</span>
                </h2>
                <p className="font-mono text-sm text-muted-foreground max-w-lg mx-auto">
                  Sobreviva a <span className="text-[hsl(var(--arena-cyan))] font-bold">{WIN_TARGET} decisões críticas</span> sem quebrar.
                  Cada mão é jogada street-by-street: Preflop → Flop → Turn → River.
                </p>
                <p className="font-mono text-xs text-muted-foreground max-w-md mx-auto">
                  {MAX_LIVES} vidas • {INITIAL_BANK.toLocaleString()} BC de banca • <span className="text-[hsl(var(--arena-gold))]">Tiket Dourado</span> para campeões
                </p>

                {/* Mode selector */}
                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setErrorMode('study')}
                    className={`font-mono text-xs px-4 py-2 rounded-lg border transition-all ${errorMode === 'study' ? 'border-[hsl(var(--arena-cyan))] bg-[hsl(var(--arena-cyan)_/_0.1)] text-[hsl(var(--arena-cyan))] font-bold' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    📚 Modo Estudo<br /><span className="text-[9px]">Repita streets com guidance</span>
                  </button>
                  <button
                    onClick={() => setErrorMode('challenge')}
                    className={`font-mono text-xs px-4 py-2 rounded-lg border transition-all ${errorMode === 'challenge' ? 'border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)_/_0.1)] text-[hsl(var(--destructive))] font-bold' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    💀 Modo Desafio<br /><span className="text-[9px]">Erro = perder vida</span>
                  </button>
                </div>

                <Button
                  onClick={startTraining}
                  className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider font-mono text-sm px-8 py-3"
                >
                  <Brain className="w-5 h-5 mr-2" /> Iniciar Sobrevivência
                </Button>

                <p className="font-mono text-[9px] text-muted-foreground/50 max-w-sm mx-auto">
                  ⚠️ Para estudo e treino. Não use como assistência em tempo real durante jogo ao vivo.
                </p>
              </>
            )}
          </motion.div>
        )}

        {/* ─── Loading ────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-6 py-8">
            <div className="flex items-center gap-2 mb-4">
              <MonocleIcon className="text-[hsl(var(--arena-cyan))] animate-pulse" size={20} />
              <span className="font-mono text-sm text-[hsl(var(--arena-cyan))]">Mycroft gerando mão #{handsCompleted + 1}...</span>
            </div>
            <Skeleton className="h-40 w-full rounded-xl bg-secondary/30" />
            <Skeleton className="h-24 w-full rounded-xl bg-secondary/30" />
          </div>
        )}

        {/* ─── Scenario ───────────────────────────────────── */}
        {currentHand && streetData && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            {/* Action Timeline */}
            <ActionTimeline actions={actionHistory} />

            {/* Scenario Card */}
            <div className="border border-[hsl(var(--arena-cyan)_/_0.3)] rounded-xl p-6 bg-[hsl(var(--arena-cyan)_/_0.03)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-xs uppercase tracking-widest text-[hsl(var(--arena-cyan))] flex items-center gap-2">
                  <MonocleIcon className="text-[hsl(var(--arena-cyan))]" size={16} />
                  {STREET_LABELS[currentStreet]} — Mão #{handsCompleted + 1}
                </h3>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))]">
                  Dificuldade: {streetData.difficulty}/10
                </span>
              </div>

              <p className="font-mono text-sm text-muted-foreground italic mb-5">"{currentHand.hand.context}"</p>
              <p className="font-mono text-sm text-foreground mb-4">{streetData.scenarioText}</p>

              <div className="grid grid-cols-2 gap-6">
                {/* Hero */}
                <div className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-lg p-4 bg-[hsl(var(--arena-gold)_/_0.03)]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-[hsl(var(--arena-gold)_/_0.2)] flex items-center justify-center">
                      <Shield className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
                    </div>
                    <div>
                      <p className="font-mono text-xs font-bold text-[hsl(var(--arena-gold))] uppercase">Você — {currentHand.hand.positionHero}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">Stack: {currentHeroStack}BB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {parseCards(currentHand.hand.heroCards).map((card, i) => (
                      <GoldEditionCard key={i} rank={card.rank} suit={card.suit} size="md" isLeak={evalResult ? !evalResult.correto : false} />
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
                      <p className="font-mono text-xs font-bold text-[hsl(var(--destructive))] uppercase">{currentHand.hand.villainName} — {currentHand.hand.positionVillain}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">Stack: {currentVillainStack}BB • {currentHand.hand.villainProfile}</p>
                    </div>
                  </div>
                  <p className="font-mono text-sm text-foreground">{streetData.villainAction}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">Pot:</span>
                    <span className="font-mono text-sm font-bold text-[hsl(var(--arena-gold))]">{currentPot}BB</span>
                  </div>
                </div>
              </div>

              {/* Board */}
              {getBoardCards() && (
                <div className="mt-4 text-center">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Board</span>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {parseCards(getBoardCards()).map((card, i) => (
                      <GoldEditionCard key={i} rank={card.rank} suit={card.suit} size="sm" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ─── Hórus Trash Talk ──────────────────────── */}
            {showDecision && <HorusTrashTalk active={true} scenarioStartTime={scenarioStartTime.current} />}

            {/* ─── Table Talk Badge ─────────────────────── */}
            {showDecision && bluffTalkEnabled && currentStreet !== 'preflop' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[hsl(var(--arena-gold)_/_0.08)] border border-[hsl(var(--arena-gold)_/_0.25)]">
                  <Video className="w-3 h-3 text-[hsl(var(--arena-gold))]" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-gold))] font-bold">Table Talk disponível</span>
                </div>
              </motion.div>
            )}

            {/* ─── Action Buttons ─────────────────────────── */}
            {showDecision && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <p className="font-mono text-sm text-center text-muted-foreground">O que você faz?</p>
                <div className="flex flex-wrap justify-center gap-3 max-w-lg mx-auto">
                  {streetData.options.map((option) => {
                    const isAllIn = option.toLowerCase().includes('all-in');
                    const isFold = option.toLowerCase() === 'fold';
                    return (
                      <Button
                        key={option}
                        onClick={() => evaluateAction(option)}
                        className={`font-mono text-sm uppercase tracking-wider h-12 px-6 ${
                          isAllIn ? 'bg-[hsl(var(--destructive))] text-white hover:brightness-110' :
                          isFold ? 'border border-muted-foreground/30 bg-transparent text-foreground hover:bg-secondary' :
                          'bg-[hsl(var(--arena-cyan))] text-black hover:brightness-110'
                        }`}
                        variant={isFold ? 'outline' : 'default'}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>

                {/* Bluff Talk button — visible on post-flop streets */}
                {bluffTalkEnabled && currentStreet !== 'preflop' && (
                  <div className="flex justify-center pt-1">
                    <Button
                      variant="outline"
                      onClick={() => setShowBluffTalk(true)}
                      className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-gold)_/_0.4)] text-[hsl(var(--arena-gold))] hover:bg-[hsl(var(--arena-gold)_/_0.1)] gap-2"
                    >
                      <Video className="w-4 h-4" /> Gravar Provocação
                    </Button>
                  </div>
                )}

                <div className="pt-2">
                  <ReactionButtons onReaction={(emoji) => toast(`Hórus viu seu ${emoji}`, { icon: '👁️', duration: 1500 })} />
                </div>
              </motion.div>
            )}

            {/* ─── Evaluating ─────────────────────────────── */}
            {isEvaluating && (
              <div className="text-center py-8">
                <MonocleIcon className="mx-auto text-[hsl(var(--arena-cyan))] animate-pulse mb-3" size={32} />
                <p className="font-mono text-sm text-[hsl(var(--arena-cyan))]">Mycroft analisando {STREET_LABELS[currentStreet]}...</p>
              </div>
            )}

            {/* ─── Result ─────────────────────────────────── */}
            <AnimatePresence>
              {evalResult && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <StreetLaudo evalResult={evalResult} />

                  {/* Cognitive Leak Report */}
                  {detectedLeak && (
                    <CognitiveLeakReport leak={detectedLeak} />
                  )}

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
                    <p className={`font-mono text-lg font-bold ${evalResult.correto ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
                      {evalResult.correto ? `+${evalResult.bcGanho} BC` : `-${evalResult.bcPerdido} BC`}
                    </p>
                  </div>

                  {/* Study mode retry hint */}
                  {showRetryHint && errorMode === 'study' && (
                    <div className="border border-[hsl(var(--arena-cyan)_/_0.3)] rounded-lg p-4 bg-[hsl(var(--arena-cyan)_/_0.05)] text-center">
                      <p className="font-mono text-xs text-[hsl(var(--arena-cyan))] mb-3">
                        📚 Modo Estudo: Tente novamente com o feedback do Mycroft
                      </p>
                      <Button
                        onClick={() => { setEvalResult(null); setShowRetryHint(false); }}
                        variant="outline"
                        className="font-mono text-xs uppercase border-[hsl(var(--arena-cyan)_/_0.5)] text-[hsl(var(--arena-cyan))]"
                      >
                        Tentar Novamente
                      </Button>
                    </div>
                  )}

                  {/* Next button */}
                  {!gameOver && (
                    <div className="text-center pt-2">
                      <Button
                        onClick={advanceAfterFeedback}
                        className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider font-mono"
                      >
                        {evalResult.correto && currentStreetIdx < STREET_ORDER.length - 1 && !evalResult.nextStreetUpdate?.handEnded
                          ? `→ ${STREET_LABELS[STREET_ORDER[currentStreetIdx + 1]]}`
                          : 'Próxima Mão →'
                        }
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* Between hands: generate next */}
        {!currentHand && !isLoading && !gameOver && handsCompleted > 0 && handsCompleted < WIN_TARGET && (
          <div className="text-center py-8">
            <Button
              onClick={generateHand}
              className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider font-mono"
            >
              <Brain className="w-5 h-5 mr-2" /> Próxima Mão
            </Button>
          </div>
        )}
      </main>

      {/* ─── Bluff Talk Modal ─────────────────────────────── */}
      <AnimatePresence>
        {showBluffTalk && currentHand && (
          <BluffTalkModal
            street={STREET_LABELS[currentStreet]}
            heroCards={currentHand.hand.heroCards}
            boardCards={getBoardCards()}
            heroAction={lastPlayerAction}
            villainName={currentHand.hand.villainName}
            villainProfile={currentHand.hand.villainProfile}
            onClose={() => { setShowBluffTalk(false); moveToNextStreet(); }}
            onComplete={handleBluffTalkComplete}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StreetContinuationTraining;
