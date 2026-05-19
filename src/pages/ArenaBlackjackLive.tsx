import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, RotateCcw, AlertTriangle, Shuffle, Square } from 'lucide-react';
import { toast } from 'sonner';

import SessionSetup from '@/components/arena-blackjack/live/SessionSetup';
import CardKeypad from '@/components/arena-blackjack/live/CardKeypad';
import CountingPanel from '@/components/arena-blackjack/live/CountingPanel';
import SessionHistory from '@/components/arena-blackjack/live/SessionHistory';

import {
  type LiveSessionState, type SessionConfig, type Rank, type RoundResult, type PositionState,
  toCard,
} from '@/lib/blackjack/live/liveTypes';
import { decksRemainingEstimate, penetrationReached } from '@/lib/blackjack/live/penetrationUtils';
import { suggestNextBet, applyRoundResult } from '@/lib/blackjack/live/liveBetSizing';
import {
  updateCount, calculateTrueCount,
} from '@/lib/blackjack/counting-and-trap';
import {
  getOptimalDecision, calculateHandTotal,
  type Action,
} from '@/lib/blackjack/decision-engine';

type Step =
  | 'idle'
  | 'dealer_up'
  | 'pos_cards'           // clássica: cartas das posições (incluindo a minha)
  | 'my_cards'            // infinity: minhas 2 cartas
  | 'others_pre'          // infinity: pergunta outros jogadores antes do dealer
  | 'my_decision'
  | 'await_hit_card'
  | 'await_double_card'
  | 'others_post'         // pergunta outras posições/jogadores pediram carta
  | 'await_other_card'
  | 'dealer_hole'
  | 'dealer_hit_card'
  | 'result';

const STORAGE_KEY = 'blackjack-live-session-v1';

function initialState(cfg: SessionConfig): LiveSessionState {
  const positions: Record<number, PositionState> = {};
  for (let i = 1; i <= 7; i++) positions[i] = cfg.tableType === 'classic' ? 'active' : 'empty';
  if (cfg.tableType === 'classic') positions[4] = 'mine';
  return {
    config: cfg,
    bankroll: cfg.initialBankroll,
    currentBet: cfg.baseBet,
    redStreak: 0,
    paused: false,
    positions,
    myPosition: cfg.tableType === 'classic' ? 4 : 0,
    count: { running: 0, cardsSeen: 0, history: [] },
    shuffles: [],
    history: [],
    startedAt: Date.now(),
  };
}

export default function ArenaBlackjackLive() {
  const navigate = useNavigate();
  const [session, setSession] = useState<LiveSessionState | null>(null);
  const [step, setStep] = useState<Step>('idle');

  // round-scoped state
  const [dealerUp, setDealerUp] = useState<Rank | null>(null);
  const [dealerCards, setDealerCards] = useState<Rank[]>([]);
  const [myCards, setMyCards] = useState<Rank[]>([]);
  const [posIndex, setPosIndex] = useState<number>(1);  // clássica: percorre posições ativas
  const [posCardsCount, setPosCardsCount] = useState<number>(0); // 0..2 cartas dadas pra posição atual
  const [doubled, setDoubled] = useState(false);
  const [surrendered, setSurrendered] = useState(false);
  const [lastResult, setLastResult] = useState<{ result: RoundResult; profit: number } | null>(null);

  // Persistência simples
  useEffect(() => {
    if (!session) {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try { setSession(JSON.parse(raw)); } catch { /* ignore */ }
      }
    }
  }, [session]);
  useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const decksRem = session ? decksRemainingEstimate(session.config.decks, session.count.cardsSeen) : 1;
  const trueCount = session ? calculateTrueCount(session.count.running, decksRem) : 0;
  const suggestion = session ? suggestNextBet(session, trueCount) : null;

  function startSession(cfg: SessionConfig) {
    setSession(initialState(cfg));
    resetRound();
    setStep(cfg.tableType === 'classic' ? 'dealer_up' : 'my_cards');
  }

  function endSession() {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    resetRound();
    setStep('idle');
  }

  function resetRound() {
    setDealerUp(null);
    setDealerCards([]);
    setMyCards([]);
    setPosIndex(1);
    setPosCardsCount(0);
    setDoubled(false);
    setSurrendered(false);
    setLastResult(null);
  }

  /** Adiciona carta(s) à contagem e shoe. */
  function feedCards(cards: Rank[]) {
    if (!session || cards.length === 0) return;
    let running = session.count.running;
    for (const r of cards) running = updateCount(running, toCard(r));
    const cardsSeen = session.count.cardsSeen + cards.length;
    setSession({ ...session, count: { ...session.count, running, cardsSeen } });

    if (penetrationReached(session.config.decks, session.config.penetration, cardsSeen)) {
      toast.warning('Penetração atingida — provável shuffle em breve.');
    }
  }

  function handleShuffle() {
    if (!session) return;
    const roundsBefore = session.history.length - (session.shuffles[session.shuffles.length - 1]?.roundsBefore ?? 0);
    setSession({
      ...session,
      count: { running: 0, cardsSeen: 0, history: session.count.history },
      shuffles: [...session.shuffles, { at: Date.now(), roundsBefore }],
    });
    toast.success('Contagem resetada — nova rodada de contagem iniciada');
  }

  function togglePosition(i: number) {
    if (!session) return;
    if (session.positions[i] === 'mine') return; // não desativa a minha
    const next: PositionState = session.positions[i] === 'active' ? 'empty' : 'active';
    setSession({ ...session, positions: { ...session.positions, [i]: next } });
  }

  function setMyPosition(i: number) {
    if (!session) return;
    const positions = { ...session.positions };
    for (const k of Object.keys(positions)) {
      const n = +k;
      if (positions[n] === 'mine') positions[n] = 'active';
    }
    positions[i] = 'mine';
    setSession({ ...session, myPosition: i, positions });
  }

  /** Sequência de posições ativas (clássica) para o passo pos_cards. */
  const activePositions = useMemo(() => {
    if (!session) return [];
    return Object.entries(session.positions)
      .filter(([, s]) => s !== 'empty')
      .map(([k]) => +k)
      .sort((a, b) => a - b);
  }, [session]);

  // ─────────────── handlers de input ───────────────
  function onPickCard(r: Rank) {
    if (!session) return;

    switch (step) {
      case 'dealer_up': {
        setDealerUp(r);
        setDealerCards([r]);
        feedCards([r]);
        if (session.config.tableType === 'classic') {
          setPosIndex(activePositions[0] ?? session.myPosition);
          setPosCardsCount(0);
          setStep('pos_cards');
        } else {
          // infinity: já temos minhas + outros → vai direto pra decisão
          setStep('my_decision');
        }
        return;
      }
      case 'pos_cards': {
        feedCards([r]);
        const isMine = posIndex === session.myPosition;
        if (isMine) setMyCards(prev => [...prev, r]);
        const nextCount = posCardsCount + 1;
        if (nextCount < 2) {
          setPosCardsCount(nextCount);
        } else {
          // próxima posição ativa
          const idx = activePositions.indexOf(posIndex);
          const next = activePositions[idx + 1];
          if (next != null) {
            setPosIndex(next); setPosCardsCount(0);
          } else {
            setStep('my_decision');
          }
        }
        return;
      }
      case 'my_cards': {
        feedCards([r]);
        const next = [...myCards, r];
        setMyCards(next);
        if (next.length >= 2) setStep('others_pre');
        return;
      }
      case 'await_other_card': {
        feedCards([r]);
        // permanece em others_post para o próximo "sim/não"
        setStep('others_post');
        return;
      }
      case 'await_hit_card': {
        feedCards([r]);
        const next = [...myCards, r];
        setMyCards(next);
        const total = calculateHandTotal(next.map(toCard)).total;
        if (total > 21) { finishRound('loss'); return; }
        if (total === 21) { setStep('others_post'); return; }
        setStep('my_decision');
        return;
      }
      case 'await_double_card': {
        feedCards([r]);
        setMyCards(prev => [...prev, r]);
        setDoubled(true);
        setStep('others_post');
        return;
      }
      case 'dealer_hole': {
        feedCards([r]);
        const all = [...dealerCards, r];
        setDealerCards(all);
        completeDealer(all);
        return;
      }
      case 'dealer_hit_card': {
        feedCards([r]);
        const all = [...dealerCards, r];
        setDealerCards(all);
        completeDealer(all);
        return;
      }
    }
  }

  function completeDealer(cards: Rank[]) {
    const { total, soft } = calculateHandTotal(cards.map(toCard));
    // Dealer para no 17 (incluindo soft 17 — H17 desligado por padrão).
    if (total < 17 || (total === 17 && soft && false)) {
      setStep('dealer_hit_card');
      return;
    }
    resolveRound(cards);
  }

  function resolveRound(finalDealer: Rank[]) {
    const playerTotal = calculateHandTotal(myCards.map(toCard)).total;
    const dealerTotal = calculateHandTotal(finalDealer.map(toCard)).total;
    let result: RoundResult;
    if (surrendered) result = 'loss'; // tratado como perda (½ na realidade, mas histórico simples)
    else if (playerTotal > 21) result = 'loss';
    else if (dealerTotal > 21) result = 'win';
    else if (playerTotal > dealerTotal) result = 'win';
    else if (playerTotal < dealerTotal) result = 'loss';
    else result = 'push';

    // BJ natural detectado (2 cartas, 21)
    if (myCards.length === 2 && playerTotal === 21 && !(finalDealer.length === 2 && dealerTotal === 21)) {
      result = 'blackjack';
    }

    finishRound(result, finalDealer);
  }

  function finishRound(result: RoundResult, finalDealer?: Rank[]) {
    if (!session) return;
    // Caso double, dobra a aposta no resultado
    const betMultiplier = doubled ? 2 : 1;
    const effectiveState = { ...session, currentBet: session.currentBet * betMultiplier };
    const updated = applyRoundResult(effectiveState, result, trueCount);
    // restaurar currentBet para sugestão Martingale base (já recalculada)
    setSession(updated);
    const lastRec = updated.history[updated.history.length - 1];
    setLastResult({ result, profit: lastRec.profit });
    setStep('result');
    if (finalDealer) setDealerCards(finalDealer);
  }

  function pickAction(action: Action) {
    if (!session) return;
    switch (action) {
      case 'hit': setStep('await_hit_card'); return;
      case 'stand': setStep('others_post'); return;
      case 'double': setStep('await_double_card'); return;
      case 'surrender':
        setSurrendered(true);
        setStep('others_post');
        return;
      case 'split':
        toast.info('Split não disponível no Modo Ao Vivo v1 — escolha Hit/Stand/Double.');
        return;
    }
  }

  function nextRound() {
    if (!session) return;
    resetRound();
    setStep(session.config.tableType === 'classic' ? 'dealer_up' : 'my_cards');
  }

  // ─────────────── render ───────────────
  if (!session) {
    return (
      <div className="min-h-screen bg-background p-4 space-y-4">
        <Button variant="ghost" onClick={() => navigate('/arena-blackjack')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar à Arena
        </Button>
        <SessionSetup onStart={startSession} />
      </div>
    );
  }

  const playerHandInfo = (() => {
    if (myCards.length === 0) return null;
    const { total, soft } = calculateHandTotal(myCards.map(toCard));
    return { total, soft };
  })();

  const decision = (() => {
    if (!dealerUp || myCards.length < 2) return null;
    const { total, soft } = calculateHandTotal(myCards.map(toCard));
    const canSplit = myCards.length === 2 && myCards[0] === myCards[1];
    return getOptimalDecision(
      {
        cards: myCards.map(toCard),
        total, soft, canSplit,
        canDouble: myCards.length === 2,
        canSurrender: myCards.length === 2,
      },
      toCard(dealerUp),
      trueCount,
    );
  })();

  return (
    <div className="min-h-screen bg-background p-4 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/arena-blackjack')}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Arena
          </Button>
          <Badge variant="outline" className="border-primary text-primary">
            🔴 Modo Ao Vivo · {session.config.tableType === 'classic' ? 'Clássica' : 'Infinity'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleShuffle}>
            <Shuffle className="h-4 w-4 mr-2" /> Embaralhou
          </Button>
          <Button variant="destructive" size="sm" onClick={endSession}>
            <Square className="h-4 w-4 mr-2" /> Encerrar
          </Button>
        </div>
      </div>

      {session.paused && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {session.pauseReason} — considere reduzir aposta ou trocar de mesa.{' '}
            <Button size="sm" variant="outline" className="ml-2" onClick={() => setSession({ ...session, paused: false, pauseReason: undefined, redStreak: 0, currentBet: session.config.baseBet })}>
              <RotateCcw className="h-3 w-3 mr-1" /> Retomar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Esquerda: painel + histórico */}
        <div className="space-y-4">
          {suggestion && (
            <CountingPanel
              running={session.count.running}
              trueCount={trueCount}
              decksRemaining={decksRem}
              suggestion={suggestion}
            />
          )}
          <SessionHistory state={session} />
        </div>

        {/* Centro/direita: mesa + fluxo */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mesa clássica: posições */}
          {session.config.tableType === 'classic' && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Mesa Clássica · ative/desative posições</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map(i => {
                    const s = session.positions[i];
                    const isCurrent = step === 'pos_cards' && posIndex === i;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => togglePosition(i)}
                          onDoubleClick={() => setMyPosition(i)}
                          title="Clique: ativar/desativar · duplo clique: marcar como minha"
                          className={`h-16 w-full rounded-md border text-xs font-bold transition-all ${
                            s === 'mine'
                              ? 'bg-primary text-primary-foreground border-primary'
                              : s === 'active'
                              ? 'bg-secondary text-foreground border-border hover:border-primary/50'
                              : 'bg-muted/30 text-muted-foreground/60 border-dashed border-border'
                          } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
                        >
                          {s === 'mine' ? `Eu (P${i})` : s === 'active' ? `P${i}` : 'Vazia'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Duplo clique em uma posição para marcá-la como sua. Posições vazias são ignoradas no fluxo.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Dealer + jogador */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Rodada atual</CardTitle>
              <Badge variant="outline">Aposta: R$ {session.currentBet.toFixed(2)}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Dealer:</span>
                <div className="flex gap-1">
                  {dealerCards.map((c, i) => (
                    <span key={i} className="px-2 py-1 rounded bg-secondary border border-border font-bold">{c}</span>
                  ))}
                  {dealerCards.length === 0 && <span className="text-muted-foreground/60">—</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Minha mão:</span>
                <div className="flex gap-1">
                  {myCards.map((c, i) => (
                    <span key={i} className="px-2 py-1 rounded bg-primary/20 border border-primary/40 font-bold">{c}</span>
                  ))}
                  {myCards.length === 0 && <span className="text-muted-foreground/60">—</span>}
                </div>
                {playerHandInfo && (
                  <Badge variant="outline">
                    {playerHandInfo.soft ? 'Soft ' : ''}{playerHandInfo.total}
                  </Badge>
                )}
                {doubled && <Badge>×2 (DD)</Badge>}
              </div>
            </CardContent>
          </Card>

          {/* Fluxo dinâmico */}
          <Card>
            <CardContent className="p-4">
              <AnimatePresence mode="wait">
                {step === 'dealer_up' && (
                  <motion.div key="dup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad label="Up card do dealer" onPick={onPickCard} />
                  </motion.div>
                )}
                {step === 'pos_cards' && (
                  <motion.div key="pc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad
                      label={`Carta ${posCardsCount + 1}/2 da posição ${posIndex}${posIndex === session.myPosition ? ' (sua)' : ''}`}
                      onPick={onPickCard}
                    />
                  </motion.div>
                )}
                {step === 'my_cards' && (
                  <motion.div key="mc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad label={`Sua carta ${myCards.length + 1}/2`} onPick={onPickCard} />
                  </motion.div>
                )}
                {step === 'others_pre' && (
                  <motion.div key="op" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    <p className="text-sm">Há cartas de outros jogadores para informar?</p>
                    <div className="flex gap-2">
                      <Button onClick={() => setStep('await_other_card')}>Sim — informar carta</Button>
                      <Button variant="outline" onClick={() => setStep('dealer_up')}>Não — seguir para dealer</Button>
                    </div>
                  </motion.div>
                )}
                {step === 'await_other_card' && (
                  <motion.div key="aoc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad label="Carta de outro jogador" onPick={onPickCard} />
                  </motion.div>
                )}
                {step === 'my_decision' && decision && (
                  <motion.div key="md" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    <div className="rounded-md border border-primary/40 bg-primary/10 p-3">
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Sugestão</p>
                      <p className="text-xl font-black text-primary">
                        {{
                          hit: 'COMPRAR',
                          stand: 'PARAR',
                          double: 'DOBRAR',
                          split: 'SEPARAR',
                          surrender: 'RENDER',
                        }[decision.action]}
                        {decision.isDeviation && <span className="ml-2 text-xs">(desvio TC)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{decision.explanation}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Button onClick={() => pickAction('hit')}>Comprar</Button>
                      <Button variant="outline" onClick={() => pickAction('stand')}>Parar</Button>
                      <Button variant="outline" onClick={() => pickAction('double')} disabled={myCards.length !== 2}>Dobrar</Button>
                      <Button variant="ghost" onClick={() => pickAction('surrender')} disabled={myCards.length !== 2}>Render</Button>
                    </div>
                  </motion.div>
                )}
                {step === 'await_hit_card' && (
                  <motion.div key="ahc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad label="Sua nova carta (hit)" onPick={onPickCard} />
                  </motion.div>
                )}
                {step === 'await_double_card' && (
                  <motion.div key="adc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad label="Carta do double" onPick={onPickCard} />
                  </motion.div>
                )}
                {step === 'others_post' && (
                  <motion.div key="opst" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
                    <p className="text-sm">Algum jogador pediu carta adicional?</p>
                    <div className="flex gap-2">
                      <Button onClick={() => setStep('await_other_card')}>Sim — informar carta</Button>
                      <Button variant="outline" onClick={() => setStep('dealer_hole')}>Não — revelar hole card</Button>
                    </div>
                  </motion.div>
                )}
                {step === 'dealer_hole' && (
                  <motion.div key="dh" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad label="Hole card do dealer" onPick={onPickCard} />
                  </motion.div>
                )}
                {step === 'dealer_hit_card' && (
                  <motion.div key="dhc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <CardKeypad label="Nova carta do dealer" onPick={onPickCard} />
                  </motion.div>
                )}
                {step === 'result' && lastResult && (
                  <motion.div key="rs" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="text-center space-y-3">
                    <p className="text-3xl font-black">
                      {lastResult.result === 'blackjack' && '🃏 BLACKJACK!'}
                      {lastResult.result === 'win' && '🟢 GREEN'}
                      {lastResult.result === 'loss' && '🔴 RED'}
                      {lastResult.result === 'push' && '⚪ PUSH'}
                    </p>
                    <p className={`text-xl font-bold ${lastResult.profit >= 0 ? 'text-green-400' : 'text-destructive'}`}>
                      {lastResult.profit >= 0 ? '+' : ''}R$ {lastResult.profit.toFixed(2)}
                    </p>
                    <Button onClick={nextRound} disabled={session.paused}>Próxima rodada →</Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
