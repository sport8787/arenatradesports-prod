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
  calculateNextBet, getOptimalBet, shouldStopBetting,
  calculateProfit, validateBettingConfig, type BettingConfig
} from '@/lib/blackjack/betting-system';

type GamePhase = 'config' | 'playing' | 'stopped';
type HandStep = 'select_dealer' | 'select_player' | 'action' | 'hit_card' | 'select_dealer2' | 'result';
type HandResult = 'win' | 'loss' | 'push' | 'blackjack';

const CARD_VALUES = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const VARIANTS = [
  { value: 'classic', label: 'Clássico 6D', decks: 6 },
  { value: 'switch', label: 'Blackjack Switch', decks: 6 },
  { value: 'spanish21', label: 'Spanish 21', decks: 8 },
  { value: 'double_exposure', label: 'Double Exposure', decks: 8 },
];

// Simple value-only card button grid (no suits)
function ValueCardGrid({ onSelect, disabled }: { onSelect: (val: string) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-7 gap-2">
      {CARD_VALUES.map(v => (
        <motion.button
          key={v}
          whileTap={{ scale: 0.9 }}
          disabled={disabled}
          onClick={() => onSelect(v + 'S')} // append dummy suit for engine compatibility
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

// Mini card display (value only)
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

// Step indicator with label
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
  const [config, setConfig] = useState<BettingConfig & { casino: string; variant: string; decks: number; initialBankroll: number }>({
    casino: 'Online', variant: 'classic', decks: 6,
    initialBankroll: 500, baseUnit: 5, increment: 2,
    maxBet: 50, stopLoss: 100, stopWin: 150,
    blackjackPayout: 1.5, useCounting: true,
  });

  // Game state
  const [bankroll, setBankroll] = useState(500);
  const [playerCards, setPlayerCards] = useState<string[]>([]);
  const [dealerCards, setDealerCards] = useState<string[]>([]); // [upcard, hole card]
  const [currentBet, setCurrentBet] = useState(5);
  const [lastWinBet, setLastWinBet] = useState(5);
  const [lastAction, setLastAction] = useState<Action | null>(null);

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
  const [lastResult, setLastResult] = useState<HandResult | null>(null);

  // UI
  const [trapDetection, setTrapDetection] = useState<TrapDetection | null>(null);
  const [stopReason, setStopReason] = useState<'stop_loss' | 'stop_win' | null>(null);

  // ═══ Computed ═══
  const hand: Hand = (() => {
    if (playerCards.length === 0) return { cards: [], total: 0, soft: false, canSplit: false, canDouble: false, canSurrender: false };
    const { total, soft } = calculateHandTotal(playerCards);
    return {
      cards: playerCards, total, soft,
      canSplit: playerCards.length === 2 && getCardValue(playerCards[0]) === getCardValue(playerCards[1]),
      canDouble: playerCards.length === 2 && bankroll >= currentBet * 2,
      canSurrender: playerCards.length === 2
    };
  })();

  const countingState = getCountingState(runningCount, decksRemaining);
  const countIndicator = getCountIndicator(countingState.trueCount);
  const canShowDecision = playerCards.length >= 2 && dealerCards.length >= 1;
  const decision = canShowDecision ? getOptimalDecision(hand, dealerCards[0], countingState.trueCount) : null;
  const optimalBet = getOptimalBet(config, currentBet, countingState.trueCount, bankroll);
  const profit = bankroll - config.initialBankroll;
  const roi = config.initialBankroll > 0 ? ((profit / config.initialBankroll) * 100).toFixed(1) : '0';

  // ═══ Card counting helper ═══
  const addToCount = useCallback((cards: string[]) => {
    const newCount = updateCountBatch(runningCount, cards);
    setRunningCount(newCount);
    setCardsSeen(prev => prev + cards.length);
    setDecksRemaining(estimateDecksRemaining(config.decks, cardsSeen + cards.length));
  }, [runningCount, cardsSeen, config.decks]);

  // ═══ Handlers ═══
  const startSession = async () => {
    const validation = validateBettingConfig(config, config.initialBankroll);
    if (!validation.valid) { validation.errors.forEach(e => toast.error(e)); return; }
    validation.warnings.forEach(w => toast.warning(w));

    setBankroll(config.initialBankroll);
    setCurrentBet(config.baseUnit);
    setLastWinBet(config.baseUnit);
    setDecksRemaining(config.decks);
    setRunningCount(0); setCardsSeen(0);
    setHandsPlayed(0); setHandsWon(0); setHandsLost(0);
    setConsecutiveLosses(0); setResultHistory([]);
    setHandStep('select_dealer');
    setPlayerCards([]); setDealerCards([]);
    setLastResult(null); setLastAction(null);

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
    setHandStep('select_player');
  };

  const handleSelectPlayerCard = (card: string) => {
    const newCards = [...playerCards, card];
    setPlayerCards(newCards);
    addToCount([card]);
    if (newCards.length >= 2) {
      setHandStep('action');
    }
  };

  const handleAction = (action: Action) => {
    setLastAction(action);
    if (action === 'hit') {
      setHandStep('hit_card');
    } else if (action === 'stand' || action === 'double' || action === 'surrender') {
      // After stand/double/surrender → ask dealer's 2nd card
      setHandStep('select_dealer2');
    } else if (action === 'split') {
      // Simplified: just continue, user re-enters cards
      toast.info('Separe as mãos e jogue cada uma.');
      resetHand();
    }
  };

  const handleHitCard = (card: string) => {
    const newCards = [...playerCards, card];
    setPlayerCards(newCards);
    addToCount([card]);
    const { total } = calculateHandTotal(newCards);
    if (total > 21) {
      // Bust → auto loss
      setHandStep('result');
    } else {
      // Re-show decision
      setHandStep('action');
    }
  };

  const handleSelectDealerHoleCard = (card: string) => {
    setDealerCards(prev => [...prev, card]);
    addToCount([card]);
    setHandStep('result');
  };

  const handleResult = async (result: HandResult) => {
    const profitAmount = calculateProfit(result, currentBet, config.blackjackPayout);
    const newBankroll = bankroll + profitAmount;
    setBankroll(newBankroll);

    const { newBet, newLastWinBet } = calculateNextBet(config, result, currentBet, lastWinBet);
    setCurrentBet(newBet);
    setLastWinBet(newLastWinBet);

    setHandsPlayed(prev => prev + 1);
    if (result === 'win' || result === 'blackjack') { setHandsWon(prev => prev + 1); setConsecutiveLosses(0); }
    else if (result === 'loss') { setHandsLost(prev => prev + 1); setConsecutiveLosses(prev => prev + 1); }

    const mappedResult = result === 'blackjack' ? 'win' : result;
    setResultHistory(prev => [...prev.slice(-19), mappedResult as 'win' | 'loss' | 'push']);
    setLastResult(result);

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
    const stopCheck = shouldStopBetting(config, newBankroll, config.initialBankroll);
    if (stopCheck.shouldStop) {
      setStopReason(stopCheck.reason);
      setPhase('stopped');
      if (sessionId) {
        await supabase.from('blackjack_sessions').update({
          status: 'completed', ended_at: new Date().toISOString()
        } as any).eq('id', sessionId);
      }
      return;
    }

    // Reset for next hand
    resetHand();
  };

  const resetHand = () => {
    setPlayerCards([]); setDealerCards([]);
    setHandStep('select_dealer');
    setLastAction(null);
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
                <Button variant="outline" onClick={() => navigate('/')}>Voltar</Button>
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-orbitron text-xl text-primary">Arena Blackjack</h1>
              <p className="text-xs text-muted-foreground">Assistente Inteligente • Hi-Lo + Martingale</p>
            </div>
          </div>

          <Alert>
            <Shield className="w-4 h-4" />
            <AlertDescription className="text-xs">
              ⚠️ Ferramenta EDUCACIONAL. Não garante lucro. Jogue com responsabilidade. +18.
            </AlertDescription>
          </Alert>

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
            <div className="text-base font-orbitron font-bold text-primary">R${optimalBet.amount.toFixed(0)}</div>
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

        {/* Cards display - Dealer & Player side by side */}
        <div className="grid grid-cols-2 gap-3">
          {/* Dealer */}
          <div className="p-3 rounded-lg bg-secondary/20 border border-border text-center">
            <div className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Dealer</div>
            <div className="flex justify-center gap-1 min-h-[56px] items-center">
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
        </div>

        {/* ═══ STEP-BASED FLOW ═══ */}
        <Card className="luxury-card">
          <CardContent className="py-4 space-y-3">
            
            {/* STEP 1: Select dealer up card */}
            {handStep === 'select_dealer' && (
              <>
                <StepLabel text="📍 Selecione a carta do Dealer" active />
                <ValueCardGrid onSelect={handleSelectDealerUpCard} />
              </>
            )}

            {/* STEP 2: Select player initial cards (need at least 2) */}
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

            {/* STEP 3: Show decision + action buttons */}
            {handStep === 'action' && decision && (
              <>
                {/* Decision display */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-4 rounded-xl text-center border ${
                    decision.isDeviation
                      ? 'border-[hsl(var(--warning))] bg-[hsl(var(--warning)_/_0.1)]'
                      : 'border-primary/50 bg-primary/5'
                  }`}
                >
                  <div className="text-sm text-muted-foreground mb-1">Decisão Ótima</div>
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

                {/* Action buttons - prominent */}
                <div className="grid grid-cols-2 gap-2">
                  {(['hit', 'stand', 'double', 'surrender'] as Action[])
                    .filter(a => {
                      if (a === 'double' && !hand.canDouble) return false;
                      if (a === 'surrender' && !hand.canSurrender) return false;
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

                {/* Undo button */}
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={resetHand}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Recomeçar mão
                </Button>
              </>
            )}

            {/* STEP 3b: Hit → select new card */}
            {handStep === 'hit_card' && (
              <>
                <StepLabel text="📍 Selecione a carta recebida" active />
                <ValueCardGrid onSelect={handleHitCard} />
              </>
            )}

            {/* STEP 4: Select dealer hole card */}
            {handStep === 'select_dealer2' && (
              <>
                <StepLabel text="📍 Segunda carta do Dealer" active />
                <ValueCardGrid onSelect={handleSelectDealerHoleCard} />
              </>
            )}

            {/* STEP 5: Result */}
            {handStep === 'result' && (
              <>
                {isBust ? (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    className="text-center p-4 rounded-xl bg-[hsl(var(--destructive)_/_0.1)] border border-[hsl(var(--destructive)_/_0.3)]">
                    <div className="text-3xl font-orbitron font-bold text-[hsl(var(--destructive))]">💥 BUST!</div>
                    <div className="text-sm text-muted-foreground mt-1">{hand.total} pontos</div>
                  </motion.div>
                ) : (
                  <StepLabel text="📍 Resultado da mão" active />
                )}

                <div className="grid grid-cols-2 gap-3">
                  {!isBust && (
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => handleResult('blackjack')}
                      className="py-5 rounded-xl font-orbitron font-bold text-lg bg-primary text-primary-foreground hover:bg-primary/80 transition-all">
                      🃏 BJ
                    </motion.button>
                  )}
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
                      className="py-5 rounded-xl font-orbitron font-bold text-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-all border border-border">
                      🤝 EMPATE
                    </motion.button>
                  )}
                </div>
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
                lastResult === 'win' || lastResult === 'blackjack'
                  ? 'bg-[hsl(var(--success)_/_0.15)] text-[hsl(var(--success))]'
                  : lastResult === 'loss'
                  ? 'bg-[hsl(var(--destructive)_/_0.15)] text-[hsl(var(--destructive))]'
                  : 'bg-muted/30 text-muted-foreground'
              }`}>
              Última: {lastResult === 'blackjack' ? '🃏 BJ!' : lastResult === 'win' ? '✅ Win' : lastResult === 'loss' ? '❌ Loss' : '🤝 Push'}
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

        {/* Bet warning */}
        {optimalBet.warning && (
          <div className="text-center text-xs text-[hsl(var(--warning))]">⚠️ {optimalBet.warning}</div>
        )}
      </div>
    </div>
  );
}
