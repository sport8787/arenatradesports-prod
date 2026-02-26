import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GoldButton from '@/components/game/GoldButton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import {
  ArrowLeft, Play, Settings, History, Shield, TrendingUp, AlertTriangle,
  RotateCcw, Spade, Heart, Diamond, Club, Zap, Target, Eye
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
type HandResult = 'win' | 'loss' | 'push' | 'blackjack';

const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_SUITS = [
  { symbol: '♠', code: 'S', color: 'text-foreground' },
  { symbol: '♥', code: 'H', color: 'text-red-500' },
  { symbol: '♦', code: 'D', color: 'text-blue-400' },
  { symbol: '♣', code: 'C', color: 'text-green-400' },
];

const VARIANTS = [
  { value: 'classic', label: 'Clássico 6D', decks: 6 },
  { value: 'switch', label: 'Blackjack Switch', decks: 6 },
  { value: 'spanish21', label: 'Spanish 21', decks: 8 },
  { value: 'double_exposure', label: 'Double Exposure', decks: 8 },
];

function CardSelector({ onSelect, label }: { onSelect: (card: string) => void; label: string }) {
  const [selectedRank, setSelectedRank] = useState<string | null>(null);

  const handleSuitClick = (suitCode: string) => {
    if (!selectedRank) return;
    onSelect(`${selectedRank}${suitCode}`);
    setSelectedRank(null);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground text-center">{label}</div>
      <div className="flex flex-wrap gap-1 justify-center">
        {CARD_RANKS.map(rank => (
          <button
            key={rank}
            onClick={() => setSelectedRank(rank === selectedRank ? null : rank)}
            className={`w-8 h-8 rounded text-xs font-bold transition-all ${
              selectedRank === rank
                ? 'bg-primary text-primary-foreground scale-110'
                : 'bg-secondary hover:bg-secondary/80 text-foreground'
            }`}
          >
            {rank}
          </button>
        ))}
      </div>
      {selectedRank && (
        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 justify-center">
          {CARD_SUITS.map(suit => (
            <button key={suit.code} onClick={() => handleSuitClick(suit.code)}
              className={`w-10 h-10 rounded-lg text-xl hover:scale-110 transition-all bg-secondary hover:bg-secondary/80 ${suit.color}`}>
              {suit.symbol}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function PlayingCard({ card, size = 'md' }: { card: string; size?: 'sm' | 'md' }) {
  const rank = card.slice(0, -1);
  const suitCode = card.slice(-1);
  const suit = CARD_SUITS.find(s => s.code === suitCode) || CARD_SUITS[0];
  const sizeClass = size === 'sm' ? 'w-10 h-14 text-sm' : 'w-14 h-20 text-lg';

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      className={`${sizeClass} rounded-lg flex flex-col items-center justify-center font-bold
        border border-[hsl(var(--arena-gold)_/_0.3)] bg-gradient-to-br from-secondary to-background
        shadow-[0_0_15px_hsl(var(--arena-gold)_/_0.2)]`}
    >
      <span className={suit.color}>{rank}</span>
      <span className={`${suit.color} ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>{suit.symbol}</span>
    </motion.div>
  );
}

export default function ArenaBlackjack() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Game phase
  const [phase, setPhase] = useState<GamePhase>('config');
  const [sessionId, setSessionId] = useState<string | null>(null);

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
  const [dealerCard, setDealerCard] = useState<string>('');
  const [currentBet, setCurrentBet] = useState(5);
  const [lastWinBet, setLastWinBet] = useState(5);

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
  const [showHistory, setShowHistory] = useState(false);
  const [historyHands, setHistoryHands] = useState<any[]>([]);
  const [stopReason, setStopReason] = useState<'stop_loss' | 'stop_win' | null>(null);

  // Computed
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
  const showDecision = playerCards.length >= 2 && dealerCard;
  const decision = showDecision ? getOptimalDecision(hand, dealerCard, countingState.trueCount) : null;
  const optimalBet = getOptimalBet(config, currentBet, countingState.trueCount, bankroll);
  const profit = bankroll - config.initialBankroll;
  const roi = config.initialBankroll > 0 ? ((profit / config.initialBankroll) * 100).toFixed(1) : '0';

  // ═══ Handlers ═══

  const startSession = async () => {
    const validation = validateBettingConfig(config, config.initialBankroll);
    if (!validation.valid) {
      validation.errors.forEach(e => toast.error(e));
      return;
    }
    validation.warnings.forEach(w => toast.warning(w));

    setBankroll(config.initialBankroll);
    setCurrentBet(config.baseUnit);
    setLastWinBet(config.baseUnit);
    setDecksRemaining(config.decks);
    setRunningCount(0);
    setCardsSeen(0);
    setHandsPlayed(0);
    setHandsWon(0);
    setHandsLost(0);
    setConsecutiveLosses(0);
    setResultHistory([]);

    if (user) {
      const { data } = await supabase.from('blackjack_sessions').insert({
        user_id: user.id,
        casino: config.casino,
        variant: config.variant,
        decks: config.decks,
        initial_bankroll: config.initialBankroll,
        current_bankroll: config.initialBankroll,
        base_unit: config.baseUnit,
        increment: config.increment,
        max_bet: config.maxBet,
        stop_loss: config.stopLoss,
        stop_win: config.stopWin,
        blackjack_payout: config.blackjackPayout,
        use_counting: config.useCounting,
      } as any).select().single();
      if (data) setSessionId((data as any).id);
    }

    setPhase('playing');
    toast.success('Sessão iniciada! Boa sorte 🃏');
  };

  const addCardToCount = useCallback((cards: string[]) => {
    const newCount = updateCountBatch(runningCount, cards);
    setRunningCount(newCount);
    setCardsSeen(prev => prev + cards.length);
    setDecksRemaining(estimateDecksRemaining(config.decks, cardsSeen + cards.length));
  }, [runningCount, cardsSeen, config.decks]);

  const addPlayerCard = (card: string) => {
    setPlayerCards(prev => [...prev, card]);
    addCardToCount([card]);
  };

  const setDealer = (card: string) => {
    setDealerCard(card);
    addCardToCount([card]);
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

    // Save hand to DB
    if (sessionId && user) {
      await supabase.from('blackjack_hands').insert({
        session_id: sessionId,
        hand_number: handsPlayed + 1,
        player_cards: playerCards,
        player_total: hand.total,
        player_soft: hand.soft,
        dealer_card: dealerCard,
        running_count: runningCount,
        true_count: countingState.trueCount,
        recommended_action: decision?.action || null,
        player_action: result,
        was_deviation: decision?.isDeviation || false,
        bet_amount: currentBet,
        bet_units: currentBet / config.baseUnit,
        result,
        profit_loss: profitAmount,
      } as any);

      await supabase.from('blackjack_sessions').update({
        current_bankroll: newBankroll,
        hands_played: handsPlayed + 1,
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
    }

    // Reset for next hand
    setPlayerCards([]);
    setDealerCard('');
  };

  const resetShoe = () => {
    setRunningCount(0);
    setCardsSeen(0);
    setDecksRemaining(config.decks);
    toast.info('Shoe resetado! Contagem zerada.');
  };

  const newHand = () => {
    setPlayerCards([]);
    setDealerCard('');
    setLastResult(null);
  };

  // ═══ Render ═══

  if (phase === 'stopped') {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full">
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
              <div className="text-muted-foreground">ROI: {roi}%</div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="text-xl font-bold">{handsPlayed}</div><div className="text-xs text-muted-foreground">Mãos</div></div>
                <div><div className="text-xl font-bold">{handsPlayed > 0 ? ((handsWon / handsPlayed) * 100).toFixed(0) : 0}%</div><div className="text-xs text-muted-foreground">Win Rate</div></div>
                <div><div className="text-xl font-bold">R$ {bankroll.toFixed(2)}</div><div className="text-xs text-muted-foreground">Banca Final</div></div>
              </div>
              <div className="flex gap-2">
                <GoldButton className="flex-1" onClick={() => { setPhase('config'); setStopReason(null); }}>
                  Nova Sessão
                </GoldButton>
                <Button variant="outline" onClick={() => navigate('/lobby')}>Voltar</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (phase === 'config') {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-lg mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/lobby')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-orbitron text-xl text-primary">Arena Blackjack</h1>
              <p className="text-xs text-muted-foreground">Assistente Inteligente • Hi-Lo + Martingale</p>
            </div>
          </div>

          {/* Disclaimer */}
          <Alert>
            <Shield className="w-4 h-4" />
            <AlertDescription className="text-xs">
              ⚠️ Ferramenta EDUCACIONAL. Não garante lucro. Jogue com responsabilidade. +18.
            </AlertDescription>
          </Alert>

          {/* Config Form */}
          <Card className="luxury-card">
            <CardHeader>
              <CardTitle className="font-orbitron text-lg flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Configurar Sessão
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Variant */}
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

              {/* Bankroll */}
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

              {/* Payout */}
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

              {/* Counting toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="text-sm">Contagem Hi-Lo</div>
                <button
                  onClick={() => setConfig(prev => ({ ...prev, useCounting: !prev.useCounting }))}
                  className={`w-12 h-6 rounded-full transition-all ${config.useCounting ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-all ${config.useCounting ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <GoldButton className="w-full" onClick={startSession}>
                <Play className="w-4 h-4 mr-2" />
                Iniciar Sessão
              </GoldButton>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ═══ PLAYING PHASE ═══
  return (
    <div className="min-h-screen bg-background p-3 pb-20">
      <div className="max-w-lg mx-auto space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setPhase('config'); }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="font-orbitron text-sm text-primary">Arena Blackjack</div>
              <div className="text-[10px] text-muted-foreground">
                {VARIANTS.find(v => v.value === config.variant)?.label}
              </div>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetShoe} title="Resetar Shoe">
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Banca + Stats */}
        <Card className="luxury-card">
          <CardContent className="py-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className={`text-lg font-orbitron font-bold ${profit >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'}`}>
                  R$ {bankroll.toFixed(0)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Banca ({profit >= 0 ? '+' : ''}{roi}%)
                </div>
              </div>
              <div>
                <div className="text-lg font-bold">{handsPlayed}</div>
                <div className="text-[10px] text-muted-foreground">Mãos</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {handsPlayed > 0 ? ((handsWon / handsPlayed) * 100).toFixed(0) : 0}%
                </div>
                <div className="text-[10px] text-muted-foreground">Win Rate</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  R$ {optimalBet.amount.toFixed(0)}
                </div>
                <div className="text-[10px] text-muted-foreground">Aposta</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Counter Hi-Lo */}
        {config.useCounting && (
          <Card className="luxury-card">
            <CardContent className="py-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-orbitron text-primary flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Contador Hi-Lo
                </div>
                <Badge variant={countIndicator.color === 'green' ? 'default' : 'secondary'} className="text-[10px]">
                  {countIndicator.emoji} {countIndicator.label}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold font-orbitron">{runningCount}</div>
                  <div className="text-[10px] text-muted-foreground">RC</div>
                </div>
                <div>
                  <div className="text-xl font-bold font-orbitron">{decksRemaining.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">Decks</div>
                </div>
                <div>
                  <div className={`text-xl font-bold font-orbitron ${
                    countingState.trueCount >= 2 ? 'text-[hsl(var(--success))]' :
                    countingState.trueCount < 0 ? 'text-[hsl(var(--destructive))]' : ''
                  }`}>
                    {countingState.trueCount > 0 ? '+' : ''}{countingState.trueCount}
                  </div>
                  <div className="text-[10px] text-muted-foreground">TC</div>
                </div>
                <div>
                  <div className={`text-xl font-bold font-orbitron ${
                    countingState.playerEdge >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
                  }`}>
                    {countingState.playerEdge >= 0 ? '+' : ''}{countingState.playerEdge.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Edge</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bet recommendation */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border">
          <div className="text-xs text-muted-foreground">{optimalBet.reason}</div>
          <div className="font-orbitron font-bold text-primary">R$ {optimalBet.amount.toFixed(2)}</div>
        </div>

        {/* Mesa de jogo */}
        <Card className="luxury-card">
          <CardContent className="py-4 space-y-4">
            {/* Dealer */}
            <div className="text-center space-y-2">
              <div className="text-xs text-muted-foreground">Carta do Dealer</div>
              <div className="flex justify-center min-h-[80px] items-center">
                {dealerCard ? (
                  <PlayingCard card={dealerCard} />
                ) : (
                  <div className="w-14 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-2xl">?</div>
                )}
              </div>
              {!dealerCard && <CardSelector label="Selecione a carta do Dealer" onSelect={setDealer} />}
            </div>

            {/* Divisor */}
            <div className="border-t border-border" />

            {/* Player */}
            <div className="text-center space-y-2">
              <div className="text-xs text-muted-foreground">
                Suas Cartas {hand.total > 0 && <span className="font-bold text-foreground">({hand.soft ? 'Soft ' : ''}{hand.total})</span>}
              </div>
              <div className="flex justify-center gap-2 min-h-[80px] items-center flex-wrap">
                {playerCards.length > 0 ? (
                  playerCards.map((c, i) => <PlayingCard key={i} card={c} />)
                ) : (
                  <>
                    <div className="w-14 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-2xl">?</div>
                    <div className="w-14 h-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-2xl">?</div>
                  </>
                )}
              </div>
              <CardSelector label="Adicione suas cartas" onSelect={addPlayerCard} />
              {playerCards.length > 0 && (
                <Button variant="ghost" size="sm" onClick={newHand} className="text-xs">
                  <RotateCcw className="w-3 h-3 mr-1" /> Limpar
                </Button>
              )}
            </div>

            {/* Decision */}
            <AnimatePresence>
              {decision && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`p-4 rounded-xl text-center border ${
                    decision.isDeviation
                      ? 'border-[hsl(var(--warning))] bg-[hsl(var(--warning)_/_0.1)]'
                      : 'border-primary/50 bg-primary/5'
                  }`}>
                  <div className="text-3xl font-orbitron font-bold text-primary mb-1">
                    {decision.action === 'surrender' ? 'RENDER' : decision.action === 'hit' ? 'COMPRAR' :
                     decision.action === 'stand' ? 'PARAR' : decision.action === 'double' ? 'DOBRAR' : 'SEPARAR'}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    Confiança: {decision.confidence}%
                  </div>
                  {decision.isDeviation && (
                    <Badge className="mb-2 bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]">
                      <Zap className="w-3 h-3 mr-1" /> Desvio TC aplicado
                    </Badge>
                  )}
                  <div className="text-xs text-muted-foreground">{decision.explanation}</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Result buttons */}
            {showDecision && (
              <div className="grid grid-cols-4 gap-2">
                <Button onClick={() => handleResult('blackjack')}
                  className="bg-primary/80 hover:bg-primary font-orbitron text-xs py-3 text-primary-foreground">
                  🃏 BJ
                </Button>
                <Button onClick={() => handleResult('win')}
                  className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)_/_0.8)] font-orbitron text-xs py-3">
                  ✅ WIN
                </Button>
                <Button onClick={() => handleResult('loss')} variant="destructive"
                  className="font-orbitron text-xs py-3">
                  ❌ LOSS
                </Button>
                <Button onClick={() => handleResult('push')} variant="outline"
                  className="font-orbitron text-xs py-3">
                  🤝 PUSH
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Last result indicator */}
        <AnimatePresence>
          {lastResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
              className={`text-center p-2 rounded-lg font-orbitron text-sm ${
                lastResult === 'win' || lastResult === 'blackjack'
                  ? 'bg-[hsl(var(--success)_/_0.2)] text-[hsl(var(--success))]'
                  : lastResult === 'loss'
                  ? 'bg-[hsl(var(--destructive)_/_0.2)] text-[hsl(var(--destructive))]'
                  : 'bg-muted text-muted-foreground'
              }`}>
              Última: {lastResult === 'blackjack' ? '🃏 BLACKJACK!' : lastResult === 'win' ? '✅ Vitória' :
                       lastResult === 'loss' ? '❌ Derrota' : '🤝 Empate'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trap Alert */}
        <AnimatePresence>
          {trapDetection?.detected && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <Alert variant={trapDetection.severity === 'danger' ? 'destructive' : 'default'}>
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="font-bold">{trapDetection.message}</div>
                  <div className="text-xs mt-1">{trapDetection.recommendation}</div>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet warning */}
        {optimalBet.warning && (
          <div className="text-center text-xs text-[hsl(var(--warning))]">
            ⚠️ {optimalBet.warning}
          </div>
        )}
      </div>
    </div>
  );
}
