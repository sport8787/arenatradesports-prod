import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import GoldButton from '@/components/game/GoldButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  ArrowLeft, Play, Settings, Shield, AlertTriangle,
  RotateCcw, Eye
} from 'lucide-react';
import WhatsAppSupportButton from '@/components/WhatsAppSupportButton';
import {
  getOptimalDecision, calculateHandTotal, getCardValue,
  type Hand, type Action, type Decision
} from '@/lib/blackjack/decision-engine';
import {
  getCountingState, getCountIndicator, updateCountBatch,
  estimateDecksRemaining, detectTrap, getSuggestedAction,
  type CountingState, type SessionStats, type TrapDetection
} from '@/lib/blackjack/counting-and-trap';
import {
  type BettingMode,
  type BettingConfig as HybridBettingConfig,
  type BettingState,
  type BetRecommendation,
  getOptimalBet as getHybridOptimalBet,
  calculatePlayerEdge,
} from '@/lib/hybrid-betting-system';
import { calculateProfit } from '@/lib/blackjack/betting-system';
import { MiniHybridDisplay } from '@/components/arena-blackjack/HybridBettingDisplay';
import { BettingSystemSelector } from '@/components/arena-blackjack/BettingSystemSelector';

type GamePhase = 'config' | 'playing' | 'stopped';
type HandStep = 'select_dealer' | 'insurance_check' | 'ten_check' | 'insurance_bj_card' | 'insurance_bj_player' | 'select_player' | 'action' | 'hit_card' | 'double_card' | 'split_select_card' | 'split_action' | 'split_hit_card' | 'split_double_card' | 'player_bj_check' | 'select_dealer2' | 'result' | 'split_result';
type HandResult = 'win' | 'loss' | 'push' | 'blackjack';

interface SplitHand {
  cards: string[];
  bet: number;
  result?: HandResult;
  doubled?: boolean;
}

const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const VARIANTS = [
  { value: 'classic', label: 'Clássico 6D', decks: 6 },
  { value: 'switch', label: 'Blackjack Switch', decks: 6 },
  { value: 'spanish21', label: 'Spanish 21', decks: 8 },
  { value: 'double_exposure', label: 'Double Exposure', decks: 8 },
];

function ValueCardGrid({ onSelect, disabled }: { onSelect: (val: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {CARD_VALUES.map(v => (
        <motion.button
          key={v}
          whileTap={{ scale: 0.9 }}
          disabled={disabled}
          onClick={() => onSelect(v + 'S')}
          className={`h-12 rounded-lg text-base font-bold transition-all
            ${disabled
              ? 'bg-muted/30 text-muted-foreground/30 cursor-not-allowed'
              : 'bg-secondary hover:bg-primary hover:text-primary-foreground active:bg-primary text-foreground border border-border hover:border-primary'
            }`}
        >
          {v}
        </motion.button>
      ))}
    </div>
  );
}

function MiniCard({ card }: { card: string }) {
  const rank = card.slice(0, -1);
  const isRed = ['H', 'D'].includes(card.slice(-1));
  return (
    <motion.div
      initial={{ scale: 0, rotateY: 90 }}
      animate={{ scale: 1, rotateY: 0 }}
      className={`w-11 h-14 rounded-lg flex items-center justify-center font-bold text-lg
        border border-[hsl(var(--arena-gold)_/_0.3)] bg-gradient-to-br from-secondary to-background
        shadow-[0_0_10px_hsl(var(--arena-gold)_/_0.15)] ${isRed ? 'text-red-500' : 'text-foreground'}`}
    >
      {rank}
    </motion.div>
  );
}

function StepLabel({ text, active }: { text: string; active?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -5 }}
      animate={{ opacity: 1, y: 0 }}
      className={`text-center text-sm font-semibold py-2 px-4 rounded-lg mb-2 ${
        active ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground'
      }`}
    >
      {text}
    </motion.div>
  );
}

const ACTION_LABELS: Record<Action, string> = {
  hit: 'COMPRAR', stand: 'PARAR', double: 'DOBRAR', split: 'SEPARAR', surrender: 'RENDER'
};

const ACTION_COLORS: Record<Action, string> = {
  hit: 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.8)] text-white',
  stand: 'bg-primary hover:bg-primary/80 text-primary-foreground',
  double: 'bg-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)_/_0.8)] text-black',
  split: 'bg-blue-600 hover:bg-blue-500 text-white',
  surrender: 'bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)_/_0.8)] text-white',
};

export default function ArenaBlackjack() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [phase, setPhase] = useState<GamePhase>('config');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [handStep, setHandStep] = useState<HandStep>('select_dealer');

  // Config
  const [config, setConfig] = useState({
    casino: 'Online', variant: 'classic', decks: 6,
    initialBankroll: 500, baseUnit: 5, increment: 2,
    maxBet: 50, stopLoss: 100, stopWin: 150,
    blackjackPayout: 1.5, useCounting: true,
  });

  // Hybrid betting config
  const [bettingMode, setBettingMode] = useState<BettingMode>('hybrid');
  const [kellyFraction, setKellyFraction] = useState<0.25 | 0.5 | 1.0>(0.5);

  // Game state
  const [bankroll, setBankroll] = useState(500);
  const [playerCards, setPlayerCards] = useState<string[]>([]);
  const [dealerCards, setDealerCards] = useState<string[]>([]);
  const [currentBet, setCurrentBet] = useState(5);
  const [lastAction, setLastAction] = useState<Action | null>(null);

  // Hybrid betting state
  const [bettingState, setBettingState] = useState<BettingState>({
    currentBet: 5,
    lastWinBet: 5,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    totalHands: 0,
    totalProfit: 0,
  });
  const [lastResult, setLastResult] = useState<'win' | 'loss' | 'push' | null>(null);
  const [dealerBJConfirmed, setDealerBJConfirmed] = useState(false);
  const [playerBusted, setPlayerBusted] = useState(false);

  // Split state
  const [splitMode, setSplitMode] = useState(false);
  const [splitHands, setSplitHands] = useState<SplitHand[]>([]);
  const [activeSplitHand, setActiveSplitHand] = useState(0);

  // Counting
  const [runningCount, setRunningCount] = useState(0);
  const [cardsSeen, setCardsSeen] = useState(0);
  const [decksRemaining, setDecksRemaining] = useState(6);

  // Stats
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [handsWon, setHandsWon] = useState(0);
  const [handsLost, setHandsLost] = useState(0);
  const [consecutiveLosses, setConsecutiveLosses] = useState(0);
  const [resultHistory, setResultHistory] = useState<('win' | 'loss' | 'push')[]>([]);

  // UI
  const [trapDetection, setTrapDetection] = useState<TrapDetection | null>(null);
  const [stopReason, setStopReason] = useState<'stop_loss' | 'stop_win' | null>(null);

  // ═══ Computed ═══
  const activeCards = splitMode ? (splitHands[activeSplitHand]?.cards || []) : playerCards;
  
  const hand: Hand = (() => {
    if (activeCards.length === 0) return { cards: [], total: 0, soft: false, canSplit: false, canDouble: false, canSurrender: false };
    const { total, soft } = calculateHandTotal(activeCards);
    const totalBetNeeded = splitMode ? splitHands.reduce((s, h) => s + h.bet, 0) : currentBet;
    return {
      cards: activeCards, total, soft,
      canSplit: !splitMode && activeCards.length === 2 && getCardValue(activeCards[0]) === getCardValue(activeCards[1]) && bankroll >= currentBet * 2,
      canDouble: activeCards.length === 2 && (total === 10 || total === 11) && bankroll >= totalBetNeeded + (splitMode ? splitHands[activeSplitHand]?.bet || 0 : currentBet),
      canSurrender: !splitMode && activeCards.length === 2
    };
  })();

  const countingState = getCountingState(runningCount, decksRemaining);
  const countIndicator = getCountIndicator(countingState.trueCount);
  const canShowDecision = activeCards.length >= 2 && dealerCards.length >= 1;
  const decision = canShowDecision ? getOptimalDecision(hand, dealerCards[0], countingState.trueCount) : null;
  const profit = bankroll - config.initialBankroll;
  const roi = config.initialBankroll > 0 ? ((profit / config.initialBankroll) * 100).toFixed(1) : '0';

  // ═══ Hybrid bet recommendation ═══
  const hybridConfig: HybridBettingConfig = {
    mode: bettingMode,
    baseUnit: config.baseUnit,
    bankroll,
    initialBankroll: config.initialBankroll,
    increment: config.increment,
    maxBet: config.maxBet,
    kellyFraction,
    stopLoss: config.stopLoss,
    stopWin: config.stopWin,
    blackjackPayout: config.blackjackPayout,
    hybridConfig: {
      protectiveThreshold: -1,
      recoveryThreshold: 0,
      attackThreshold: 2,
    },
  };

  let hybridRecommendation: BetRecommendation | null = null;
  try {
    hybridRecommendation = getHybridOptimalBet(
      hybridConfig,
      bettingState,
      countingState.trueCount,
      lastResult
    );
  } catch {
    // stop loss/win reached — handled elsewhere
  }

  // ═══ Card counting helper ═══
  const addToCount = useCallback((cards: string[]) => {
    const newCount = updateCountBatch(runningCount, cards);
    setRunningCount(newCount);
    setCardsSeen(prev => prev + cards.length);
    setDecksRemaining(estimateDecksRemaining(config.decks, cardsSeen + cards.length));
  }, [runningCount, cardsSeen, config.decks]);

  // ═══ Update betting state after result ═══
  const updateBettingState = (result: HandResult, bet: number) => {
    const mappedResult = result === 'blackjack' ? 'win' : result;
    const profitAmount = calculateProfit(result, bet, config.blackjackPayout);

    setBettingState(prev => {
      const newState = { ...prev };
      newState.totalHands++;
      newState.totalProfit += profitAmount;
      
      if (mappedResult === 'win') {
        newState.consecutiveLosses = 0;
        newState.consecutiveWins++;
        newState.lastWinBet = bet;
      } else if (mappedResult === 'loss') {
        newState.consecutiveLosses++;
        newState.consecutiveWins = 0;
      }
      
      // Get next recommended bet
      try {
        const nextConfig: HybridBettingConfig = {
          ...hybridConfig,
          bankroll: bankroll + profitAmount,
        };
        const nextRec = getHybridOptimalBet(
          nextConfig,
          newState,
          countingState.trueCount,
          mappedResult
        );
        newState.currentBet = nextRec.amount;
      } catch {
        newState.currentBet = config.baseUnit;
      }
      
      return newState;
    });

    setLastResult(mappedResult);
  };

  // ═══ Handlers ═══
  const startSession = async () => {
    setBankroll(config.initialBankroll);
    setCurrentBet(config.baseUnit);
    setBettingState({
      currentBet: config.baseUnit,
      lastWinBet: config.baseUnit,
      consecutiveLosses: 0,
      consecutiveWins: 0,
      totalHands: 0,
      totalProfit: 0,
    });
    setDecksRemaining(config.decks);
    setRunningCount(0); setCardsSeen(0);
    setHandsPlayed(0); setHandsWon(0); setHandsLost(0);
    setConsecutiveLosses(0); setResultHistory([]);
    setHandStep('select_dealer');
    setPlayerCards([]); setDealerCards([]);
    setLastResult(null); setLastAction(null);
    setDealerBJConfirmed(false); setPlayerBusted(false);

    if (user) {
      const { data } = await supabase.from('blackjack_sessions').insert({
        user_id: user.id, casino: config.casino, variant: config.variant,
        decks: config.decks, initial_bankroll: config.initialBankroll,
        current_bankroll: config.initialBankroll, base_unit: config.baseUnit,
        increment: config.increment, max_bet: config.maxBet,
        stop_loss: config.stopLoss, stop_win: config.stopWin,
        blackjack_payout: config.blackjackPayout, use_counting: config.useCounting,
      } as any).select().single();
      if (data) setSessionId((data as any).id);
    }
    setPhase('playing');
    toast.success('Sessão iniciada! 🃏');
  };

  const handleSelectDealerUpCard = (card: string) => {
    setDealerCards([card]);
    addToCount([card]);
    if (card === 'A' || card === 'AS') {
      setHandStep('insurance_check');
    } else {
      setHandStep('select_player');
    }
  };

  const handleInsuranceAnswer = (dealerHasBJ: boolean) => {
    if (dealerHasBJ) {
      setDealerBJConfirmed(true);
      setHandStep('insurance_bj_card');
    } else {
      setDealerBJConfirmed(false);
      setHandStep('select_player');
    }
  };

  const handleInsuranceBJCard = (card: string) => {
    const newDealerCards = [...dealerCards, card];
    setDealerCards(newDealerCards);
    addToCount([card]);
    setHandStep('insurance_bj_player');
  };

  const handleInsuranceBJPlayerCard = (card: string) => {
    const newCards = [...playerCards, card];
    setPlayerCards(newCards);
    addToCount([card]);
    if (newCards.length >= 2) {
      // Player entered their cards for counting, now auto-result as loss
      setHandStep('result');
    }
  };

  const handleSelectPlayerCard = (card: string) => {
    const newCards = [...playerCards, card];
    setPlayerCards(newCards);
    addToCount([card]);
    if (newCards.length >= 2) {
      if (dealerBJConfirmed) {
        // Dealer has BJ, cards entered for counting only → auto loss
        setHandStep('result');
        return;
      }
      // Check for natural blackjack
      const { total } = calculateHandTotal(newCards);
      if (total === 21 && newCards.length === 2) {
        // Natural BJ — pergunta se o jogador consegue ver a 2ª carta do dealer
        toast.success('🃏 BLACKJACK NATURAL! Parabéns!');
        setHandStep('player_bj_check');
        return;
      }
      setHandStep('action');
    }
  };

  const handleAction = (action: Action) => {
    setLastAction(action);
    if (splitMode) {
      if (action === 'hit') {
        setHandStep('split_hit_card');
      } else if (action === 'double') {
        setSplitHands(prev => prev.map((h, i) => i === activeSplitHand ? { ...h, bet: h.bet * 2, doubled: true } : h));
        setHandStep('split_double_card');
      } else if (action === 'stand') {
        advanceToNextSplitHand();
      }
      return;
    }
    if (action === 'hit') {
      setHandStep('hit_card');
    } else if (action === 'double') {
      setCurrentBet(prev => prev * 2);
      setHandStep('double_card');
    } else if (action === 'stand' || action === 'surrender') {
      setHandStep('select_dealer2');
    } else if (action === 'split') {
      handleSplit();
    }
  };

  // ═══ SPLIT HANDLERS ═══
  const handleSplit = () => {
    const card1 = playerCards[0];
    const card2 = playerCards[1];
    setSplitMode(true);
    setSplitHands([
      { cards: [card1], bet: currentBet },
      { cards: [card2], bet: currentBet },
    ]);
    setActiveSplitHand(0);
    setHandStep('split_select_card');
    toast.info('✂️ Mãos separadas! Jogue a Mão 1 primeiro.');
  };

  const handleSplitSelectCard = (card: string) => {
    setSplitHands(prev => prev.map((h, i) => i === activeSplitHand ? { ...h, cards: [...h.cards, card] } : h));
    addToCount([card]);
    setHandStep('split_action');
  };

  const handleSplitHitCard = (card: string) => {
    const newCards = [...splitHands[activeSplitHand].cards, card];
    setSplitHands(prev => prev.map((h, i) => i === activeSplitHand ? { ...h, cards: newCards } : h));
    addToCount([card]);
    const { total } = calculateHandTotal(newCards);
    if (total > 21) {
      setSplitHands(prev => prev.map((h, i) => i === activeSplitHand ? { ...h, cards: newCards, result: 'loss' } : h));
      advanceToNextSplitHand();
    } else {
      setHandStep('split_action');
    }
  };

  const handleSplitDoubleCard = (card: string) => {
    const newCards = [...splitHands[activeSplitHand].cards, card];
    setSplitHands(prev => prev.map((h, i) => i === activeSplitHand ? { ...h, cards: newCards } : h));
    addToCount([card]);
    const { total } = calculateHandTotal(newCards);
    if (total > 21) {
      setSplitHands(prev => prev.map((h, i) => i === activeSplitHand ? { ...h, cards: newCards, result: 'loss' } : h));
    }
    advanceToNextSplitHand();
  };

  const advanceToNextSplitHand = () => {
    if (activeSplitHand === 0) {
      setActiveSplitHand(1);
      if (splitHands[1].cards.length < 2) {
        setHandStep('split_select_card');
        toast.info('📍 Agora jogue a Mão 2.');
      } else {
        setHandStep('split_action');
      }
    } else {
      setHandStep('select_dealer2');
    }
  };

  const handleSplitResults = async () => {
    let totalProfitAmount = 0;
    for (const sh of splitHands) {
      if (sh.result) {
        totalProfitAmount += calculateProfit(sh.result, sh.bet, config.blackjackPayout);
      }
    }
    const newBankroll = bankroll + totalProfitAmount;
    setBankroll(newBankroll);

    const totalBet = splitHands.reduce((s, h) => s + h.bet, 0);
    const overallResult: HandResult = totalProfitAmount > 0 ? 'win' : totalProfitAmount < 0 ? 'loss' : 'push';

    updateBettingState(overallResult, totalBet);
    setCurrentBet(bettingState.currentBet);

    setHandsPlayed(prev => prev + 1);
    if (overallResult === 'win') { setHandsWon(prev => prev + 1); setConsecutiveLosses(0); }
    else if (overallResult === 'loss') { setHandsLost(prev => prev + 1); setConsecutiveLosses(prev => prev + 1); }

    const mappedResult = overallResult;
    setResultHistory(prev => [...prev.slice(-19), mappedResult as 'win' | 'loss' | 'push']);

    // Check stop
    const profitNow = newBankroll - config.initialBankroll;
    if ((Math.abs(profitNow) >= config.stopLoss && profitNow < 0) || profitNow >= config.stopWin) {
      setStopReason(profitNow >= config.stopWin ? 'stop_win' : 'stop_loss');
      setPhase('stopped');
      return;
    }

    resetHand();
  };

  const handleDoubleCard = (card: string) => {
    const newCards = [...playerCards, card];
    setPlayerCards(newCards);
    addToCount([card]);
    setHandStep('select_dealer2');
  };

  const handleHitCard = (card: string) => {
    const newCards = [...playerCards, card];
    setPlayerCards(newCards);
    addToCount([card]);
    const { total } = calculateHandTotal(newCards);
    if (total > 21) {
      // Player busted — still need dealer's hole card for counting
      setPlayerBusted(true);
      setHandStep('select_dealer2');
    } else {
      setHandStep('action');
    }
  };

  const handleSelectDealerHoleCard = (card: string) => {
    const newDealerCards = [...dealerCards, card];
    setDealerCards(newDealerCards);
    addToCount([card]);
    
    // If player busted, auto-resolve as loss after collecting dealer hole card for TC
    if (playerBusted) {
      setHandStep('result');
      return;
    }
    
    const { total: dealerTotal } = calculateHandTotal(newDealerCards);
    if (dealerTotal < 17) {
      setHandStep('select_dealer2');
    } else {
      setHandStep(splitMode ? 'split_result' : 'result');
    }
  };

  const handleResult = async (result: HandResult) => {
    const profitAmount = calculateProfit(result, currentBet, config.blackjackPayout);
    const newBankroll = bankroll + profitAmount;
    setBankroll(newBankroll);

    updateBettingState(result, currentBet);

    setHandsPlayed(prev => prev + 1);
    if (result === 'win' || result === 'blackjack') { setHandsWon(prev => prev + 1); setConsecutiveLosses(0); }
    else if (result === 'loss') { setHandsLost(prev => prev + 1); setConsecutiveLosses(prev => prev + 1); }

    const mappedResult = result === 'blackjack' ? 'win' : result;
    setResultHistory(prev => [...prev.slice(-19), mappedResult as 'win' | 'loss' | 'push']);

    // Trap detection
    const stats: SessionStats = {
      handsPlayed: handsPlayed + 1,
      handsWon: (result === 'win' || result === 'blackjack') ? handsWon + 1 : handsWon,
      handsLost: result === 'loss' ? handsLost + 1 : handsLost,
      consecutiveLosses: result === 'loss' ? consecutiveLosses + 1 : 0,
      currentBankroll: newBankroll,
      initialBankroll: config.initialBankroll,
      resultHistory: [...resultHistory.slice(-19), mappedResult as 'win' | 'loss' | 'push']
    };
    setTrapDetection(detectTrap(stats, {
      consecutiveLossAlert: 5, consecutiveLossDanger: 7,
      minHandsForPattern: 15, minWinRate: 35
    }));

    // Save to DB
    if (sessionId && user) {
      await supabase.from('blackjack_hands').insert({
        session_id: sessionId, hand_number: handsPlayed + 1,
        player_cards: playerCards, player_total: hand.total,
        player_soft: hand.soft, dealer_card: dealerCards[0] || '',
        running_count: runningCount, true_count: countingState.trueCount,
        recommended_action: decision?.action || null,
        player_action: lastAction || result,
        was_deviation: decision?.isDeviation || false,
        bet_amount: currentBet, bet_units: currentBet / config.baseUnit,
        result, profit_loss: profitAmount,
      } as any);

      await supabase.from('blackjack_sessions').update({
        current_bankroll: newBankroll, hands_played: handsPlayed + 1,
        hands_won: (result === 'win' || result === 'blackjack') ? handsWon + 1 : handsWon,
        hands_lost: result === 'loss' ? handsLost + 1 : handsLost,
        total_profit: newBankroll - config.initialBankroll,
        best_true_count: Math.max(countingState.trueCount, 0),
      } as any).eq('id', sessionId);
    }

    // Check stop
    const profitNow = newBankroll - config.initialBankroll;
    if ((Math.abs(profitNow) >= config.stopLoss && profitNow < 0) || profitNow >= config.stopWin) {
      setStopReason(profitNow >= config.stopWin ? 'stop_win' : 'stop_loss');
      setPhase('stopped');
      if (sessionId) {
        await supabase.from('blackjack_sessions').update({
          status: 'completed', ended_at: new Date().toISOString()
        } as any).eq('id', sessionId);
      }
      return;
    }

    resetHand();
  };

  const resetHand = () => {
    setPlayerCards([]); setDealerCards([]);
    setHandStep('select_dealer');
    setLastAction(null);
    setSplitMode(false);
    setSplitHands([]);
    setActiveSplitHand(0);
    setDealerBJConfirmed(false);
    setPlayerBusted(false);
    // Set currentBet from hybrid recommendation
    if (hybridRecommendation) {
      setCurrentBet(hybridRecommendation.amount);
    }
  };

  const resetShoe = () => {
    setRunningCount(0); setCardsSeen(0);
    setDecksRemaining(config.decks);
    toast.info('Shoe resetado!');
  };

  // ═══ STOPPED PHASE ═══
  if (phase === 'stopped') {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md w-full">
          <Card className="luxury-card text-center">
            <CardHeader>
              <CardTitle className="font-orbitron text-2xl">
                {stopReason === 'stop_win' ? '🎉 STOP WIN!' : '🛑 STOP LOSS'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={`text-5xl font-orbitron font-bold ${profit >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
                {profit >= 0 ? '+' : ''}R$ {profit.toFixed(2)}
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="text-xl font-bold">{handsPlayed}</div><div className="text-xs text-muted-foreground">Mãos</div></div>
                <div><div className="text-xl font-bold">{handsPlayed > 0 ? ((handsWon / handsPlayed) * 100).toFixed(0) : 0}%</div><div className="text-xs text-muted-foreground">Win Rate</div></div>
                <div><div className="text-xl font-bold">R$ {bankroll.toFixed(2)}</div><div className="text-xs text-muted-foreground">Banca Final</div></div>
              </div>
              <div className="flex gap-2">
                <GoldButton className="flex-1" onClick={() => { setPhase('config'); setStopReason(null); }}>Nova Sessão</GoldButton>
                <Button variant="outline" onClick={() => navigate('/lobby')}>Voltar</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ═══ CONFIG PHASE ═══
  if (phase === 'config') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lobby')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-orbitron text-xl text-primary">Arena Blackjack</h1>
              <p className="text-xs text-muted-foreground">Assistente Inteligente • Hi-Lo + Sistema Híbrido</p>
            </div>
            <WhatsAppSupportButton />
          </div>

          <Alert>
            <Shield className="w-4 h-4" />
            <AlertDescription className="text-xs">
              ⚠️ Ferramenta EDUCACIONAL. Não garante lucro. Jogue com responsabilidade. +18.
            </AlertDescription>
          </Alert>

          {/* Betting System Selector */}
          <BettingSystemSelector
            initialBankroll={config.initialBankroll}
            baseUnit={config.baseUnit}
            increment={config.increment}
            maxBet={config.maxBet}
            stopLoss={config.stopLoss}
            stopWin={config.stopWin}
            onConfigChange={(mode, fraction) => {
              setBettingMode(mode);
              setKellyFraction(fraction);
            }}
          />

          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="font-orbitron text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" /> Configurar Sessão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Modalidade</Label>
                <div className="grid grid-cols-2 gap-2">
                  {VARIANTS.map(v => (
                    <button key={v.value}
                      onClick={() => setConfig(prev => ({ ...prev, variant: v.value, decks: v.decks }))}
                      className={`p-3 rounded-lg text-sm font-medium transition-all border ${
                        config.variant === v.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/50 hover:border-primary/50'
                      }`}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Banca Inicial (R$)</Label>
                  <Input type="number" value={config.initialBankroll}
                    onChange={e => setConfig(prev => ({ ...prev, initialBankroll: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Aposta Base (R$)</Label>
                  <Input type="number" value={config.baseUnit}
                    onChange={e => setConfig(prev => ({ ...prev, baseUnit: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Incremento (R$)</Label>
                  <Input type="number" value={config.increment}
                    onChange={e => setConfig(prev => ({ ...prev, increment: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Aposta Máxima (R$)</Label>
                  <Input type="number" value={config.maxBet}
                    onChange={e => setConfig(prev => ({ ...prev, maxBet: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stop Loss (R$)</Label>
                  <Input type="number" value={config.stopLoss}
                    onChange={e => setConfig(prev => ({ ...prev, stopLoss: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Stop Win (R$)</Label>
                  <Input type="number" value={config.stopWin}
                    onChange={e => setConfig(prev => ({ ...prev, stopWin: Number(e.target.value) }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Blackjack Payout</Label>
                <div className="flex gap-2">
                  {[{ value: 1.5, label: '3:2' }, { value: 1.2, label: '6:5' }].map(p => (
                    <button key={p.value}
                      onClick={() => setConfig(prev => ({ ...prev, blackjackPayout: p.value }))}
                      className={`flex-1 p-2 rounded-lg text-sm border transition-all ${
                        config.blackjackPayout === p.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/50'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-sm">Contagem Hi-Lo</div>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, useCounting: !prev.useCounting }))}
                  className={`w-12 h-6 rounded-full transition-all ${config.useCounting ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-all ${config.useCounting ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <GoldButton className="w-full" onClick={startSession}>
                <Play className="w-4 h-4 mr-2" /> Iniciar Sessão
              </GoldButton>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══ PLAYING PHASE ═══
  const { total: playerTotal } = playerCards.length > 0 ? calculateHandTotal(playerCards) : { total: 0 };
  const isBust = playerTotal > 21;
  const isPlayerBJ = playerCards.length === 2 && playerTotal === 21;
  const isDealerBJ = dealerCards.length >= 2 && calculateHandTotal(dealerCards).total === 21;

  return (
    <div className="min-h-screen bg-background p-3 pb-6">
      <div className="max-w-lg mx-auto space-y-3">
        {/* Header compact */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPhase('config')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="font-orbitron text-sm text-primary">Blackjack</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetShoe} title="Resetar Shoe">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Banca + Aposta + Stats - compact row */}
        <div className="grid grid-cols-4 gap-1 text-center p-2 rounded-lg bg-secondary/30 border border-border">
          <div>
            <div className={`text-base font-orbitron font-bold ${profit >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
              R${bankroll.toFixed(0)}
            </div>
            <div className="text-[9px] text-muted-foreground">Banca</div>
          </div>
          <div>
            <div className="text-base font-orbitron font-bold text-primary">R${splitMode ? splitHands.reduce((s, h) => s + h.bet, 0).toFixed(0) : currentBet.toFixed(0)}</div>
            <div className="text-[9px] text-muted-foreground">Aposta</div>
          </div>
          <div>
            <div className="text-base font-bold">{handsPlayed}</div>
            <div className="text-[9px] text-muted-foreground">Mãos</div>
          </div>
          <div>
            <div className="text-base font-bold">{handsPlayed > 0 ? ((handsWon / handsPlayed) * 100).toFixed(0) : 0}%</div>
            <div className="text-[9px] text-muted-foreground">Win</div>
          </div>
        </div>

        {/* Counter Hi-Lo - compact */}
        {config.useCounting && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/30 border border-border text-xs">
            <div className="flex items-center gap-1 text-primary font-orbitron">
              <Eye className="w-3 h-3" /> Hi-Lo
            </div>
            <div className="flex items-center gap-3">
              <span>RC: <b>{runningCount}</b></span>
              <span className={countingState.trueCount >= 2 ? 'text-[hsl(var(--success))]' : countingState.trueCount < 0 ? 'text-[hsl(var(--destructive))]' : ''}>
                TC: <b>{countingState.trueCount > 0 ? '+' : ''}{countingState.trueCount}</b>
              </span>
              <span className={countingState.playerEdge >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}>
                Edge: <b>{countingState.playerEdge >= 0 ? '+' : ''}{countingState.playerEdge.toFixed(1)}%</b>
              </span>
              <span>{countIndicator.emoji}</span>
            </div>
          </div>
        )}

        {/* Hybrid Betting Display - Mini */}
        {hybridRecommendation && handStep === 'select_dealer' && (
          <MiniHybridDisplay recommendation={hybridRecommendation} />
        )}

        {/* Cards display - Dealer & Player side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Dealer */}
          <div className="p-3 rounded-lg bg-secondary/20 border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
              Dealer {dealerCards.length >= 2 && (() => { const { total } = calculateHandTotal(dealerCards); return <span className="text-foreground font-bold">({total})</span>; })()}
            </div>
            <div className="flex justify-center gap-1 min-h-[56px] items-center flex-wrap">
              {dealerCards.length > 0 ? (
                dealerCards.map((c, i) => <MiniCard key={i} card={c} />)
              ) : (
                <div className="w-11 h-14 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-lg">?</div>
              )}
              {dealerCards.length === 1 && (
                <div className="w-11 h-14 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-lg bg-muted/10">?</div>
              )}
            </div>
          </div>

          {/* Player */}
          {splitMode ? (
            <div className="p-3 rounded-lg bg-secondary/20 border border-border text-center">
              <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Mãos Separadas</div>
              <div className="space-y-2">
                {splitHands.map((sh, idx) => {
                  const { total: shTotal, soft: shSoft } = sh.cards.length > 0 ? calculateHandTotal(sh.cards) : { total: 0, soft: false };
                  const isActive = activeSplitHand === idx && !['select_dealer2', 'split_result', 'result'].includes(handStep);
                  const isBusted = shTotal > 21;
                  return (
                    <div key={idx} className={`p-1.5 rounded-lg border ${isActive ? 'border-primary bg-primary/10' : sh.result === 'loss' ? 'border-destructive/30 bg-destructive/5 opacity-60' : 'border-border bg-secondary/10'}`}>
                      <div className="text-[9px] text-muted-foreground flex justify-between items-center mb-1">
                        <span>Mão {idx + 1} {sh.doubled ? '(2x)' : ''}</span>
                        <span className="font-bold text-foreground">
                          {shTotal > 0 && `${shSoft ? 'S' : ''}${shTotal}`}
                          {isBusted && ' 💥'}
                          {sh.result && ` • ${sh.result === 'win' ? '✅' : sh.result === 'loss' ? '❌' : '🤝'}`}
                        </span>
                      </div>
                      <div className="flex justify-center gap-1 min-h-[40px] items-center flex-wrap">
                        {sh.cards.map((c, ci) => <MiniCard key={ci} card={c} />)}
                        {sh.cards.length < 2 && <div className="w-9 h-12 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-sm">?</div>}
                      </div>
                      <div className="text-[9px] text-primary font-bold">R${sh.bet}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-secondary/20 border border-border text-center">
              <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
                Você {hand.total > 0 && <span className="text-foreground font-bold">({hand.soft ? 'S' : ''}{hand.total})</span>}
              </div>
              <div className="flex justify-center gap-1 min-h-[56px] items-center flex-wrap">
                {playerCards.length > 0 ? (
                  playerCards.map((c, i) => <MiniCard key={i} card={c} />)
                ) : (
                  <>
                    <div className="w-11 h-14 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-lg">?</div>
                    <div className="w-11 h-14 rounded-lg border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-lg">?</div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ═══ STEP-BASED FLOW ═══ */}
        <Card className="luxury-card">
          <CardContent className="py-4 space-y-3">
            
            {handStep === 'select_dealer' && (
              <>
                <StepLabel text="📍 Selecione a carta do Dealer" active />
                <ValueCardGrid onSelect={handleSelectDealerUpCard} />
              </>
            )}

            {handStep === 'insurance_check' && (
              <>
                <StepLabel text="🛡️ Dealer mostra Ás — Seguro?" active />
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-3">
                  <p className="text-sm font-bold text-destructive">❌ RECUSE O SEGURO</p>
                  <p className="text-xs text-muted-foreground">Estatisticamente o seguro é sempre um mau negócio para o jogador.</p>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-center font-semibold text-foreground">O Dealer fez Blackjack?</p>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleInsuranceAnswer(true)}
                      className="py-5 rounded-xl font-orbitron font-bold text-lg bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive)_/_0.8)] transition-all">
                      ✅ SIM
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleInsuranceAnswer(false)}
                      className="py-5 rounded-xl font-orbitron font-bold text-lg bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success)_/_0.8)] transition-all">
                      ❌ NÃO
                    </motion.button>
                  </div>
                </div>
              </>
            )}

            {handStep === 'insurance_bj_card' && (
              <>
                <StepLabel text="🃏 Dealer fez BJ — Qual a 2ª carta do Dealer?" active />
                <p className="text-xs text-center text-muted-foreground mb-2">Selecione a carta que completou o Blackjack (10, J, Q ou K)</p>
                <div className="grid grid-cols-4 gap-3">
                  {['10', 'J', 'Q', 'K'].map(v => (
                    <motion.button key={`bj-${v}`} whileTap={{ scale: 0.9 }}
                      onClick={() => handleInsuranceBJCard(v + 'S')}
                      className="py-4 rounded-xl font-bold text-lg bg-destructive/20 border-2 border-destructive/50 text-destructive hover:bg-destructive/30 transition-all">
                      {v}
                    </motion.button>
                  ))}
                </div>
              </>
            )}

            {handStep === 'insurance_bj_player' && (
              <>
                <StepLabel text={`📍 Suas cartas para contagem (${playerCards.length}/2 mínimo)`} active />
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-center mb-2">
                  <p className="text-xs text-muted-foreground">Dealer fez BJ — informe suas cartas para manter a contagem precisa.</p>
                </div>
                <ValueCardGrid onSelect={handleInsuranceBJPlayerCard} />
              </>
            )}

            {handStep === 'select_player' && (
              <>
                <StepLabel text={`📍 Suas cartas (${playerCards.length}/2 mínimo)`} active />
                <ValueCardGrid onSelect={handleSelectPlayerCard} />
                {playerCards.length >= 2 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <Button variant="outline" className="w-full" onClick={() => setHandStep('action')}>
                      Confirmar ({hand.total})
                    </Button>
                  </motion.div>
                )}
              </>
            )}

            {(handStep === 'action' || handStep === 'split_action') && decision && (
              <>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-xl text-center border ${
                    decision.isDeviation
                      ? 'border-[hsl(var(--warning))] bg-[hsl(var(--warning)_/_0.1)]'
                      : 'border-primary/50 bg-primary/5'
                  }`}
                >
                  <div className="text-sm text-muted-foreground mb-1">
                    {splitMode ? `Mão ${activeSplitHand + 1} — ` : ''}Decisão Ótima
                  </div>
                  <div className="text-3xl font-orbitron font-bold text-primary">
                    {ACTION_LABELS[decision.action]}
                  </div>
                  {decision.isDeviation && (
                    <Badge className="mt-2 bg-[hsl(var(--warning))] text-black text-xs">
                      ⚡ Desvio TC {countingState.trueCount > 0 ? '+' : ''}{countingState.trueCount}
                    </Badge>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">{decision.explanation}</div>
                </motion.div>

                <div className="grid grid-cols-2 gap-2">
                  {(['hit', 'stand', 'double', 'split', 'surrender'] as Action[])
                    .filter(a => {
                      if (a === 'double' && !hand.canDouble) return false;
                      if (a === 'split' && !hand.canSplit) return false;
                      if (a === 'surrender' && !hand.canSurrender) return false;
                      if (splitMode && a === 'surrender') return false;
                      if (splitMode && a === 'split') return false;
                      return true;
                    })
                    .map(action => (
                      <motion.button
                        key={action}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleAction(action)}
                        className={`py-4 rounded-xl font-orbitron font-bold text-base transition-all ${ACTION_COLORS[action]}
                          ${action === decision.action ? 'ring-2 ring-white/50 shadow-lg scale-[1.02]' : 'opacity-70'}
                        `}
                      >
                        {ACTION_LABELS[action]}
                      </motion.button>
                    ))}
                </div>

                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetHand}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Recomeçar mão
                </Button>
              </>
            )}

            {handStep === 'hit_card' && (
              <>
                <StepLabel text="📍 Selecione a carta recebida" active />
                <ValueCardGrid onSelect={handleHitCard} />
              </>
            )}

            {handStep === 'double_card' && (
              <>
                <StepLabel text={`💰 DOBROU! Aposta: R$${currentBet.toFixed(0)} — Selecione a carta recebida`} active />
                <div className="p-3 rounded-xl bg-[hsl(var(--warning)_/_0.1)] border border-[hsl(var(--warning)_/_0.3)] text-center mb-2">
                  <p className="text-xs text-muted-foreground">Você dobrou a aposta. Recebe apenas <b>1 carta</b> e deve parar.</p>
                </div>
                <ValueCardGrid onSelect={handleDoubleCard} />
              </>
            )}

            {handStep === 'split_select_card' && (
              <>
                <StepLabel text={`✂️ Mão ${activeSplitHand + 1} — Selecione a 2ª carta recebida`} active />
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/30 text-center mb-2">
                  <p className="text-xs text-muted-foreground">Carta separada: <b>{splitHands[activeSplitHand]?.cards[0]?.slice(0, -1)}</b> — informe a próxima carta.</p>
                </div>
                <ValueCardGrid onSelect={handleSplitSelectCard} />
              </>
            )}

            {handStep === 'split_hit_card' && (
              <>
                <StepLabel text={`✂️ Mão ${activeSplitHand + 1} — Selecione a carta recebida`} active />
                <ValueCardGrid onSelect={handleSplitHitCard} />
              </>
            )}

            {handStep === 'split_double_card' && (
              <>
                <StepLabel text={`💰 Mão ${activeSplitHand + 1} DOBROU! R$${splitHands[activeSplitHand]?.bet} — Selecione a carta`} active />
                <div className="p-3 rounded-xl bg-[hsl(var(--warning)_/_0.1)] border border-[hsl(var(--warning)_/_0.3)] text-center mb-2">
                  <p className="text-xs text-muted-foreground">Dobrou a aposta. Recebe apenas <b>1 carta</b> e deve parar.</p>
                </div>
                <ValueCardGrid onSelect={handleSplitDoubleCard} />
              </>
            )}

            {handStep === 'player_bj_check' && (
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="space-y-3">
                <div className="text-center p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-2">
                  <div className="text-2xl font-orbitron font-bold text-primary">🃏 BLACKJACK NATURAL!</div>
                  <div className="text-sm text-foreground">Parabéns! Você ganhou com Blackjack — paga {config.blackjackPayout}:1 → +R${(currentBet * config.blackjackPayout).toFixed(2)}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/20 border border-border text-center">
                  <p className="text-sm font-semibold text-foreground mb-1">Você consegue ver a 2ª carta do dealer?</p>
                  <p className="text-xs text-muted-foreground">Se a mesa revelar a carta oculta, informe para checar empate (push). Caso contrário, finalizamos a mão como Blackjack.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => setHandStep('select_dealer2')}
                    className="py-4 rounded-xl font-orbitron font-bold bg-[hsl(var(--warning))] text-black hover:bg-[hsl(var(--warning)_/_0.85)] transition-all">
                    ✅ SIM, informar carta
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => handleResult('blackjack')}
                    className="py-4 rounded-xl font-orbitron font-bold bg-primary text-primary-foreground hover:bg-primary/80 transition-all">
                    🃏 NÃO — Pagar BJ
                  </motion.button>
                </div>
              </motion.div>
            )}

            {handStep === 'select_dealer2' && (
              <>
                <StepLabel text={`📍 ${playerBusted ? '💥 BUST — ' : ''}Carta do Dealer${dealerCards.length >= 2 ? ` (total: ${calculateHandTotal(dealerCards).total})` : ''} — precisa de 17+`} active />
                {playerBusted && (
                  <div className="p-3 rounded-xl bg-[hsl(var(--destructive)_/_0.1)] border border-[hsl(var(--destructive)_/_0.3)] text-center mb-2">
                    <p className="text-xs text-muted-foreground">Você estourou com {hand.total} pontos. Informe as cartas do dealer para manter a contagem precisa.</p>
                  </div>
                )}
                <ValueCardGrid onSelect={handleSelectDealerHoleCard} />
              </>
            )}

            {handStep === 'result' && (
              <>
                {isDealerBJ && isPlayerBJ ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="text-center p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                    <div className="text-3xl font-orbitron font-bold text-muted-foreground">🤝 PUSH — Ambos BJ</div>
                    <div className="text-sm text-muted-foreground">Dealer e jogador com Blackjack natural</div>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleResult('push')}
                      className="w-full py-5 rounded-xl font-orbitron font-bold text-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-all border border-border">
                      🤝 EMPATE — Próxima mão
                    </motion.button>
                  </motion.div>
                ) : isDealerBJ ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="text-center p-4 rounded-xl bg-[hsl(var(--destructive)_/_0.1)] border border-[hsl(var(--destructive)_/_0.3)] space-y-3">
                    <div className="text-3xl font-orbitron font-bold text-[hsl(var(--destructive))]">🃏 DEALER BLACKJACK</div>
                    <div className="text-sm text-muted-foreground">Dealer: A + {dealerCards[1]} = 21</div>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleResult('loss')}
                      className="w-full py-5 rounded-xl font-orbitron font-bold text-lg bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive)_/_0.8)] transition-all">
                      ❌ PERDI — Próxima mão
                    </motion.button>
                  </motion.div>
                ) : isPlayerBJ ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="text-center p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
                    <div className="text-3xl font-orbitron font-bold text-primary">🃏 BLACKJACK!</div>
                    <div className="text-sm text-muted-foreground">21 natural! Paga {config.blackjackPayout}:1 → +R${(currentBet * config.blackjackPayout).toFixed(2)}</div>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleResult('blackjack')}
                      className="w-full py-5 rounded-xl font-orbitron font-bold text-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-all">
                      🃏 BLACKJACK! — Próxima mão
                    </motion.button>
                  </motion.div>
                ) : isBust ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="text-center p-4 rounded-xl bg-[hsl(var(--destructive)_/_0.1)] border border-[hsl(var(--destructive)_/_0.3)]">
                    <div className="text-3xl font-orbitron font-bold text-[hsl(var(--destructive))]">💥 BUST!</div>
                    <div className="text-sm text-muted-foreground mt-1">{hand.total} pontos</div>
                  </motion.div>
                ) : (
                  <StepLabel text="📍 Resultado da mão" active />
                )}

                {!isDealerBJ && !isPlayerBJ && (
                  <div className="grid grid-cols-2 gap-3">
                    {!isBust && (
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => handleResult('win')}
                        className="py-5 rounded-xl font-orbitron font-bold text-lg bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success)_/_0.8)] transition-all">
                        ✅ GANHEI
                      </motion.button>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleResult('loss')}
                      className={`py-5 rounded-xl font-orbitron font-bold text-lg bg-[hsl(var(--destructive))] text-white hover:bg-[hsl(var(--destructive)_/_0.8)] transition-all ${isBust ? 'col-span-2' : ''}`}>
                      ❌ PERDI
                    </motion.button>
                    {!isBust && (
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => handleResult('push')}
                        className="py-5 rounded-xl font-orbitron font-bold text-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-all border border-border col-span-2">
                        🤝 EMPATE
                      </motion.button>
                    )}
                  </div>
                )}
              </>
            )}

            {handStep === 'split_result' && (
              <>
                <StepLabel text="📍 Resultado das mãos separadas" active />
                <div className="space-y-3">
                  {splitHands.map((sh, idx) => {
                    const { total: shTotal } = calculateHandTotal(sh.cards);
                    const shBust = shTotal > 21;
                    const { total: dTotal } = calculateHandTotal(dealerCards);
                    const dealerBust = dTotal > 21;

                    if (sh.result) {
                      return (
                        <div key={idx} className={`p-3 rounded-xl text-center border ${sh.result === 'win' ? 'border-[hsl(var(--success)_/_0.3)] bg-[hsl(var(--success)_/_0.05)]' : sh.result === 'loss' ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/10'}`}>
                          <div className="text-sm font-bold">Mão {idx + 1}: {sh.result === 'win' ? '✅ GANHOU' : sh.result === 'loss' ? '❌ PERDEU' : '🤝 EMPATE'} (R${sh.bet})</div>
                          <div className="flex justify-center gap-1 mt-1">
                            {sh.cards.map((c, ci) => <MiniCard key={ci} card={c} />)}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={idx} className="p-3 rounded-xl border border-primary/30 bg-primary/5 space-y-2">
                        <div className="text-sm font-bold text-center">Mão {idx + 1}{sh.doubled ? ' (2x)' : ''}: {shBust ? '💥 BUST' : shTotal} vs Dealer {dTotal}{dealerBust ? ' 💥' : ''} — R${sh.bet}</div>
                        <div className="flex justify-center gap-1">
                          {sh.cards.map((c, ci) => <MiniCard key={ci} card={c} />)}
                        </div>
                        {shBust ? (
                          <div className="text-center text-sm text-destructive font-bold">Bust automático — Perda</div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSplitHands(prev => prev.map((h, i) => i === idx ? { ...h, result: 'win' } : h));
                              }}
                              className="py-3 rounded-xl font-bold text-sm bg-[hsl(var(--success))] text-white">
                              ✅ GANHOU
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSplitHands(prev => prev.map((h, i) => i === idx ? { ...h, result: 'loss' } : h));
                              }}
                              className="py-3 rounded-xl font-bold text-sm bg-[hsl(var(--destructive))] text-white">
                              ❌ PERDEU
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.95 }}
                              onClick={() => {
                                setSplitHands(prev => prev.map((h, i) => i === idx ? { ...h, result: 'push' } : h));
                              }}
                              className="py-3 rounded-xl font-bold text-sm bg-muted text-muted-foreground border border-border">
                              🤝 EMPATE
                            </motion.button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {splitHands.every(sh => sh.result) && (
                  <GoldButton className="w-full" onClick={handleSplitResults}>
                    Confirmar e Próxima Mão →
                  </GoldButton>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Last result */}
        <AnimatePresence>
          {lastResult && handStep === 'select_dealer' && (
            <motion.div
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className={`text-center py-2 rounded-lg font-orbitron text-xs ${
                lastResult === 'win'
                  ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                  : lastResult === 'loss'
                  ? 'bg-[hsl(var(--destructive)_/_0.15)] text-[hsl(var(--destructive))]'
                  : 'bg-muted/30 text-muted-foreground'
              }`}>
              Última: {lastResult === 'win' ? '✅ Win' : lastResult === 'loss' ? '❌ Loss' : '🤝 Push'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trap alert */}
        <AnimatePresence>
          {trapDetection?.detected && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Alert variant={trapDetection.severity === 'danger' ? 'destructive' : 'default'}>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="font-bold text-sm">{trapDetection.message}</div>
                  <div className="text-xs mt-1">{trapDetection.recommendation}</div>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hybrid bet warning */}
        {hybridRecommendation?.warning && (
          <div className="text-center text-xs text-[hsl(var(--warning))]">⚠️ {hybridRecommendation.warning}</div>
        )}
      </div>
    </div>
  );
}
