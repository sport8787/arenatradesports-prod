import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useSoloRankings } from '@/hooks/useSoloRankings';
import { useAuth } from '@/hooks/useAuth';
import { getOrCreateSessionId, uniqueQuestionsByText } from '@/lib/gameUtils';
import { Question } from '@/types/game';
import { BOTS, Bot, BotVote, calculateBotVotes, getRandomTaunt } from '@/types/bot';
import LuxuryCard from '@/components/game/LuxuryCard';
import GoldButton from '@/components/game/GoldButton';
import QuestionCard from '@/components/game/QuestionCard';
import MycroftPanel from '@/components/game/MycroftPanel';
import BluffCoinDisplay, { BluffCoinCost } from '@/components/game/BluffCoinDisplay';
import RoleBanner from '@/components/game/RoleBanner';
import RoundProgress, { PRIZE_LADDER } from '@/components/game/RoundProgress';
import BonusCardUnlock from '@/components/game/BonusCardUnlock';
import ImmunityCardUnlock from '@/components/game/ImmunityCardUnlock';
import ImmunitySavedOverlay from '@/components/game/ImmunitySavedOverlay';
import BonusCardsPanel from '@/components/game/BonusCardsPanel';
import EliminationAnimation from '@/components/game/EliminationAnimation';
import MoneyRain from '@/components/game/MoneyRain';
import AudioRecorder from '@/components/game/AudioRecorder';
import BluffFeedback from '@/components/game/BluffFeedback';
import CashOutDialog from '@/components/game/CashOutDialog';
import MysteryBriefcaseModal from '@/components/game/MysteryBriefcaseModal';
import BriefcaseRevealModal from '@/components/game/BriefcaseRevealModal';
import { Input } from '@/components/ui/input';
import { Play, Bot as BotIcon, Loader2, Home, Lock, Unlock, Trophy, Cpu, Brain, Zap, Skull, Flame, Coins } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// BluffCoin costs
const MYCROFT_COST = 200;

// BluffCoin rewards
const HOST_CORRECT_ANSWER = 100;
const HOST_WRONG_PARTIAL_BLUFF = 200;
const HOST_WRONG_FULL_BLUFF = 300;

// Game progression constants
const MAX_ROUNDS = 15;
const INITIAL_BLUFFCOINS = 1000;
const FINAL_ROUND_PRIZE = 1000000; // Fixed 1M prize for round 15

// Bluff feedback phrases
const BLUFF_PHRASES = [
  'Vendeu gelo para esquimó! ❄️',
  'O Oscar vai para... VOCÊ! 🏆',
  'Cairam igual patinhos! 🦆',
  'Isso não é mentira, é Marketing! 📈',
  'Nem o polígrafo pegava essa. 🤥',
  'Mestre da manipulação. 🕵️‍♂️',
  'Acreditou porque quis! 😂',
  'Blefe de milhões! 💰',
  'Nem tremeu a voz. Psicopata ou Gênio? 🤔',
  'Chorem, meros mortais. O Mestre do Blefe chegou. 👑',
  'Atuação digna de Netflix. 🎬',
];

// Generate weighted random briefcase prize (higher prizes are rarer)
const generateBriefcasePrize = (): number => {
  const random = Math.random();
  // Weighted distribution: lower prizes more common
  if (random < 0.40) return Math.floor(Math.random() * 9000) + 1000; // 1k-10k (40%)
  if (random < 0.65) return Math.floor(Math.random() * 40000) + 10000; // 10k-50k (25%)
  if (random < 0.82) return Math.floor(Math.random() * 50000) + 50000; // 50k-100k (17%)
  if (random < 0.93) return Math.floor(Math.random() * 100000) + 100000; // 100k-200k (11%)
  if (random < 0.98) return Math.floor(Math.random() * 150000) + 200000; // 200k-350k (5%)
  return Math.floor(Math.random() * 100000) + 350000; // 350k-450k (2%)
};

type GamePhase = 'nickname' | 'briefcase' | 'question' | 'recording' | 'analyzing' | 'result' | 'eliminated' | 'victory';

export default function SinglePlayerRoom() {
  const navigate = useNavigate();
  const { playChips, playSuspense, playFanfare, playReveal, playGameOver, playCashRegister, playCardUnlock, playShieldActivate, preloadSounds } = useSoundEffects();
  const { myRanking, getOrCreateSoloRanking, updateSoloRankingStats } = useSoloRankings();
  const { profile, isAuthenticated, loading: authLoading, addBluffCoins, updateProfile } = useAuth();

  const isGuest = sessionStorage.getItem('guestMode') === 'true';
  const [guestNickname] = useState(() => `Convidado${Math.floor(Math.random() * 9999)}`);
  const displayName = isGuest ? guestNickname : profile?.username || 'Jogador';
  
  const [gamePhase, setGamePhase] = useState<GamePhase>('nickname');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set());
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [confirmedAnswer, setConfirmedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showMycroft, setShowMycroft] = useState(false);
  const [mycroftUsed, setMycroftUsed] = useState(false);
  const [bluffcoins, setBluffcoins] = useState(INITIAL_BLUFFCOINS);
  const [bluffFeedback, setBluffFeedback] = useState<{ phrase: string; description: string } | null>(null);

  // Bot votes
  const [botVotes, setBotVotes] = useState<BotVote[]>([]);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [aiTaunt, setAiTaunt] = useState<string | null>(null);

  // Round progression
  const [currentRound, setCurrentRound] = useState(0);
  const [accumulatedPrize, setAccumulatedPrize] = useState(0);
  const [hasGuaranteedPrize, setHasGuaranteedPrize] = useState(false);
  const [safeAmount, setSafeAmount] = useState(0);
  const [showBonusUnlock, setShowBonusUnlock] = useState(false);
  const [showCashOutDialog, setShowCashOutDialog] = useState(false);
  const [newlyUnlockedCard, setNewlyUnlockedCard] = useState<'guaranteed' | 'immunity' | null>(null);
  const [showMoneyRain, setShowMoneyRain] = useState(false);
  const [hasImmunityCard, setHasImmunityCard] = useState(false);
  const [immunityCardUsed, setImmunityCardUsed] = useState(false);
  const [showImmunityUnlock, setShowImmunityUnlock] = useState(false);
  const [showImmunitySaved, setShowImmunitySaved] = useState(false);
  const [showBriefcaseModal, setShowBriefcaseModal] = useState(false);
  const [showBriefcaseReveal, setShowBriefcaseReveal] = useState(false);
  const [briefcasePrize, setBriefcasePrize] = useState(0);

  const sessionId = getOrCreateSessionId();

  // Preload sounds
  useEffect(() => {
    preloadSounds();
  }, [preloadSounds]);

  // Load questions
  useEffect(() => {
    supabase.from('questions').select('*').then(({ data }) => {
      if (data) setQuestions(uniqueQuestionsByText(data as Question[]));
    });
  }, []);

  // Redirect to auth if not authenticated and not guest
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isGuest) {
      navigate('/auth');
    }
  }, [isAuthenticated, authLoading, navigate, isGuest]);

  const startGame = async () => {
    if (!profile) {
      toast({ title: 'Erro ao carregar perfil', variant: 'destructive' });
      return;
    }

    // Create/update solo ranking
    await getOrCreateSoloRanking(profile.username);

    // Start first round
    setCurrentRound(1);
    setAccumulatedPrize(0);
    selectNextQuestion();
    setGamePhase('question');
  };
  
  // Persist bluffcoins to profile (only for authenticated non-guest users)
  const persistWinnings = async (amount: number) => {
    // Don't persist for guests
    if (isGuest) {
      toast({ title: 'Modo Convidado', description: 'BluffCoins não foram salvos. Faça login para guardar seu progresso!' });
      return;
    }
    if (!profile || amount <= 0) return;
    await addBluffCoins(amount);
    await updateProfile({ 
      matches_played: profile.matches_played + 1,
      wins: gamePhase === 'victory' ? profile.wins + 1 : profile.wins
    });
  };

  const selectNextQuestion = () => {
    const availableQuestions = questions.filter(q => !usedQuestionIds.has(q.id));
    if (availableQuestions.length === 0) {
      setUsedQuestionIds(new Set());
      const randomIndex = Math.floor(Math.random() * questions.length);
      setCurrentQuestion(questions[randomIndex]);
      setUsedQuestionIds(new Set([questions[randomIndex].id]));
    } else {
      const randomIndex = Math.floor(Math.random() * availableQuestions.length);
      const q = availableQuestions[randomIndex];
      setCurrentQuestion(q);
      setUsedQuestionIds(prev => new Set([...prev, q.id]));
    }
    
    // Reset states
    setSelectedAnswer(null);
    setConfirmedAnswer(null);
    setShowAnswer(false);
    setMycroftUsed(false);
    setBotVotes([]);
    setAiTaunt(null);
    setAnalyzingProgress(0);
  };

  const confirmAnswer = () => {
    if (!selectedAnswer) return;
    setConfirmedAnswer(selectedAnswer);
    setShowAnswer(true);
    playReveal();
    
    // Round 15: Skip recording/voting, go directly to results
    if (currentRound === MAX_ROUNDS) {
      setTimeout(() => processRound15Results(), 1500);
    } else {
      setGamePhase('recording');
    }
  };

  // Special Round 15 processing (no bluff, pure trivia)
  const processRound15Results = async () => {
    if (!currentQuestion || !confirmedAnswer) return;
    
    const playerAnsweredCorrectly = confirmedAnswer === currentQuestion.correct_option;
    
    if (playerAnsweredCorrectly) {
      // VICTORY! Win exactly 1,000,000 BC
      setAccumulatedPrize(FINAL_ROUND_PRIZE);
      setBluffcoins(prev => prev + HOST_CORRECT_ANSWER);
      setShowMoneyRain(true);
      playFanfare();
      
      // Persist winnings to profile
      await persistWinnings(FINAL_ROUND_PRIZE);
      
      if (myRanking) {
        updateSoloRankingStats({ 
          addGame: true, 
          addWin: true,
          setBestRound: 15,
          addPoints: FINAL_ROUND_PRIZE
        });
      }
      
      toast({ title: '🏆 1 MILHÃO!', description: 'Você conquistou o prêmio máximo!' });
      setGamePhase('victory');
    } else {
      // ELIMINATION - lose all or fall to safe amount
      playGameOver();
      
      const finalPrize = hasGuaranteedPrize ? safeAmount : 0;
      
      // Persist safe amount if any
      if (finalPrize > 0) {
        await persistWinnings(finalPrize);
      }
      
      if (myRanking) {
        updateSoloRankingStats({ 
          addGame: true, 
          setBestRound: 15,
          addPoints: finalPrize
        });
      }
      
      if (hasGuaranteedPrize && safeAmount > 0) {
        setAccumulatedPrize(safeAmount);
      }
      
      setGamePhase('eliminated');
    }
  };

  const activateMycroft = () => {
    if (bluffcoins < MYCROFT_COST) {
      toast({ title: 'BluffCoins insuficientes', variant: 'destructive' });
      return;
    }
    setBluffcoins(prev => prev - MYCROFT_COST);
    setMycroftUsed(true);
    setShowMycroft(true);
    playChips();
  };

  const submitAudio = () => {
    // Skip to AI analysis phase
    setGamePhase('analyzing');
    playSuspense();
    
    // Simulate AI analysis with progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      setAnalyzingProgress(Math.min(progress, 100));
      
      if (progress >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          processResults();
        }, 500);
      }
    }, 300);
  };

  const processResults = async () => {
    if (!currentQuestion || !confirmedAnswer) return;

    const playerAnsweredCorrectly = confirmedAnswer === currentQuestion.correct_option;
    const votes = calculateBotVotes(playerAnsweredCorrectly);
    setBotVotes(votes);

    const believeVotes = votes.filter(v => v.vote === 'believe').length;
    const doubtVotes = votes.filter(v => v.vote === 'doubt').length;

    // Check elimination: wrong answer + all bots voted BLEFE
    const shouldEliminate = !playerAnsweredCorrectly && doubtVotes === 3;

    if (shouldEliminate) {
      if (hasImmunityCard && !immunityCardUsed && currentRound !== MAX_ROUNDS) {
        // Immunity saves the player
        setImmunityCardUsed(true);
        setShowImmunitySaved(true);
        playShieldActivate();
        setGamePhase('result');
        playReveal();
      } else {
        // Show AI taunt and eliminate
        setAiTaunt(getRandomTaunt());
        playGameOver();
        
        // Persist safe amount if any
        const finalPrize = hasGuaranteedPrize ? safeAmount : 0;
        if (finalPrize > 0) {
          await persistWinnings(finalPrize);
        }
        
        // Update ranking
        if (myRanking) {
          updateSoloRankingStats({ 
            addGame: true, 
            setBestRound: currentRound,
            addPoints: finalPrize
          });
        }
        
        setGamePhase('eliminated');
        return;
      }
    } else {
      // Calculate rewards
      let reward = 0;
      
      if (playerAnsweredCorrectly) {
        reward = HOST_CORRECT_ANSWER;
        toast({ title: `+${HOST_CORRECT_ANSWER} BluffCoins`, description: 'Resposta correta!' });
      } else if (believeVotes > 0) {
        // Bluff successful
        if (believeVotes === 3) {
          reward = HOST_WRONG_FULL_BLUFF;
          toast({ title: `+${HOST_WRONG_FULL_BLUFF} BluffCoins`, description: 'Blefe perfeito!' });
        } else {
          reward = HOST_WRONG_PARTIAL_BLUFF;
          toast({ title: `+${HOST_WRONG_PARTIAL_BLUFF} BluffCoins`, description: 'Blefe parcial!' });
        }
        
        // Show bluff feedback
        const unlockingBonusCard = (!hasGuaranteedPrize && believeVotes >= 2) || (!hasImmunityCard && believeVotes >= 3);
        if (!unlockingBonusCard) {
          const randomPhrase = BLUFF_PHRASES[Math.floor(Math.random() * BLUFF_PHRASES.length)];
          setTimeout(() => {
            playCashRegister();
            setBluffFeedback({ phrase: randomPhrase, description: `${believeVotes} caíram no blefe!` });
            setTimeout(() => setBluffFeedback(null), 3000);
          }, 1200);
        }
      }

      setBluffcoins(prev => prev + reward);
      
      // Prize is NOT cumulative - it REPLACES the previous value
      const roundPrize = PRIZE_LADDER[currentRound - 1];
      setAccumulatedPrize(roundPrize);

      // Check for bonus card unlocks
      if (!hasGuaranteedPrize && !playerAnsweredCorrectly && believeVotes >= 2) {
        setHasGuaranteedPrize(true);
        setSafeAmount(roundPrize);
        setNewlyUnlockedCard('guaranteed');
        setTimeout(() => {
          setShowBonusUnlock(true);
          playCardUnlock();
        }, 1500);
      }

      if (!hasImmunityCard && !playerAnsweredCorrectly && believeVotes >= 3) {
        setHasImmunityCard(true);
        setNewlyUnlockedCard('immunity');
        const delay = (!hasGuaranteedPrize && believeVotes >= 2) ? 5000 : 1500;
        setTimeout(() => {
          setShowImmunityUnlock(true);
          playShieldActivate();
        }, delay);
      }

      // Round 15 is handled separately by processRound15Results
      // This code won't run for round 15 because confirmAnswer goes to processRound15Results directly
    }

    setGamePhase('result');
    playReveal();
    setTimeout(() => playFanfare(), 800);
  };

  const nextRound = () => {
    if (currentRound >= MAX_ROUNDS) return;
    
    const nextRoundNum = currentRound + 1;
    setCurrentRound(nextRoundNum);
    selectNextQuestion();
    setNewlyUnlockedCard(null);
    
    // Show briefcase modal before round 15
    if (nextRoundNum === MAX_ROUNDS) {
      setShowBriefcaseModal(true);
    } else {
      setGamePhase('question');
    }
  };

  // Handle briefcase choice - player takes the mystery prize
  const handleOpenBriefcase = async () => {
    setShowBriefcaseModal(false);
    const prize = generateBriefcasePrize();
    setBriefcasePrize(prize);
    setAccumulatedPrize(prize);
    playCashRegister();
    
    // Persist winnings to profile
    await persistWinnings(prize);
    
    // Update ranking
    if (myRanking) {
      updateSoloRankingStats({ 
        addGame: true, 
        addWin: true,
        setBestRound: 14, // They stopped before attempting round 15
        addPoints: prize
      });
    }
    
    setShowBriefcaseReveal(true);
  };

  // Handle briefcase refusal - player sees the question
  const handleRefuseBriefcase = () => {
    setShowBriefcaseModal(false);
    setGamePhase('question');
  };

  // Handle briefcase reveal completion
  const handleBriefcaseRevealComplete = () => {
    setShowBriefcaseReveal(false);
    setShowMoneyRain(true);
    setGamePhase('victory');
  };

  const handleCashOut = async () => {
    setShowMoneyRain(true);
    playCashRegister();
    
    // Persist winnings to profile
    await persistWinnings(accumulatedPrize);
    
    // Update ranking
    if (myRanking) {
      updateSoloRankingStats({ 
        addGame: true, 
        addWin: true,
        setBestRound: currentRound,
        addPoints: accumulatedPrize 
      });
    }
    
    toast({ title: '💰 CASH OUT!', description: `Você saiu com ${accumulatedPrize.toLocaleString()} BluffCoins!` });
    setShowCashOutDialog(false);
    setGamePhase('victory');
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Coins className="w-12 h-12 text-primary" />
        </motion.div>
      </div>
    );
  }

  // Nickname entry screen
  if (gamePhase === 'nickname') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LuxuryCard className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BotIcon className="w-8 h-8 text-destructive" />
            <h2 className="font-orbitron text-2xl text-destructive">MODO SOLO</h2>
          </div>
          
          <p className="text-muted-foreground">
            Enfrente 3 IAs com personalidades únicas. Sobreviva 15 rodadas para vencer.
          </p>

          {/* Bot display */}
          <div className="flex justify-center gap-4 py-4">
            {BOTS.map((bot, i) => (
              <motion.div
                key={bot.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50"
              >
                <span className="text-3xl">{bot.avatar}</span>
                <span className="font-orbitron text-xs text-primary">{bot.nickname}</span>
                <span className="text-[10px] text-muted-foreground text-center max-w-[80px]">{bot.description}</span>
              </motion.div>
            ))}
          </div>

          <div className="py-3 px-4 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-sm text-muted-foreground">Jogando como:</p>
            <p className="font-orbitron text-lg text-primary font-bold">{displayName}</p>
            {isGuest && <p className="text-xs text-destructive/80 mt-1">Modo convidado - moedas não serão salvas</p>}
          </div>
          
          <GoldButton onClick={startGame} className="w-full" size="lg">
            <Play className="w-5 h-5 mr-2" />
            INICIAR DESAFIO
          </GoldButton>
          
          <GoldButton variant="ghost" onClick={() => navigate('/')} className="w-full">
            <Home className="w-5 h-5 mr-2" />
            Voltar
          </GoldButton>
        </LuxuryCard>
      </div>
    );
  }

  // Main game UI
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Role Banner */}
        <RoleBanner isHost={true} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              title="Voltar ao Início"
            >
              <Home className="w-5 h-5 text-primary" />
            </button>
            <div>
              <h1 className="font-orbitron text-xl text-destructive flex items-center gap-2">
                <BotIcon className="w-5 h-5" />
                MODO SOLO
              </h1>
              <p className="text-xs text-muted-foreground">{displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <BluffCoinDisplay amount={bluffcoins} size="md" />
            {/* Bot avatars */}
            <div className="flex -space-x-2">
              {BOTS.map((bot) => (
                <div 
                  key={bot.id}
                  className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-sm"
                  title={bot.nickname}
                >
                  {bot.avatar}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2">
            <LuxuryCard>
              {/* QUESTION PHASE */}
              {gamePhase === 'question' && currentQuestion && (
                <div className="space-y-6">
                  {/* Round 15 Special Banner */}
                  {currentRound === MAX_ROUNDS && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-4 bg-gradient-to-r from-gold/20 via-amber-500/20 to-gold/20 border-2 border-gold/50 rounded-lg text-center"
                    >
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Flame className="w-5 h-5 text-gold animate-pulse" />
                        <span className="font-orbitron text-lg text-gold font-bold">RODADA FINAL - ALL IN!</span>
                        <Flame className="w-5 h-5 text-gold animate-pulse" />
                      </div>
                      <p className="text-sm text-gold/80">
                        ⚠️ Sem chance de blefe! Acerte a pergunta ou perca tudo.
                      </p>
                    </motion.div>
                  )}

                  <QuestionCard
                    question={currentQuestion}
                    showCorrectAnswer={showAnswer}
                    selectedOption={selectedAnswer || undefined}
                    onSelectOption={setSelectedAnswer}
                    confirmedAnswer={confirmedAnswer || undefined}
                    disabled={false}
                  />
                  
                  <div className="space-y-4">
                    <GoldButton 
                      onClick={confirmAnswer} 
                      disabled={!selectedAnswer || !!confirmedAnswer}
                      className="w-full"
                      size="lg"
                    >
                      {confirmedAnswer ? (
                        <><Unlock className="w-5 h-5 mr-2" /> Resposta Revelada</>
                      ) : selectedAnswer ? (
                        currentRound === MAX_ROUNDS ? (
                          <><Flame className="w-5 h-5 mr-2" /> CONFIRMAR - VALE 1 MILHÃO!</>
                        ) : (
                          <><Unlock className="w-5 h-5 mr-2" /> Confirmar e Revelar Resposta</>
                        )
                      ) : (
                        <><Lock className="w-5 h-5 mr-2" /> Selecione uma Resposta</>
                      )}
                    </GoldButton>
                  </div>
                </div>
              )}

              {/* RECORDING PHASE */}
              {gamePhase === 'recording' && currentQuestion && (
                <div className="space-y-6">
                  <QuestionCard
                    question={currentQuestion}
                    showCorrectAnswer={true}
                    selectedOption={confirmedAnswer || undefined}
                    confirmedAnswer={confirmedAnswer || undefined}
                    disabled={true}
                  />
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-secondary/50 rounded-lg border border-border/50 text-center">
                      <p className="text-muted-foreground text-sm mb-2">
                        🎙️ Grave sua justificativa (para imersão)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ou pule direto para a análise da IA
                      </p>
                    </div>

                    <div className="flex gap-4">
                      <GoldButton 
                        variant="outline" 
                        onClick={activateMycroft} 
                        className="flex-1"
                        disabled={mycroftUsed || bluffcoins < MYCROFT_COST}
                      >
                        <BotIcon className="w-5 h-5 mr-2" /> 
                        {mycroftUsed ? 'Mycroft Ativado' : (
                          <>Mycroft <BluffCoinCost amount={MYCROFT_COST} /></>
                        )}
                      </GoldButton>
                      <GoldButton onClick={submitAudio} className="flex-1">
                        <Brain className="w-5 h-5 mr-2" />
                        Enviar para IA
                      </GoldButton>
                    </div>
                  </div>
                </div>
              )}

              {/* ANALYZING PHASE */}
              {gamePhase === 'analyzing' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8 py-12"
                >
                  <div className="text-center space-y-4">
                    <motion.div
                      animate={{ 
                        rotate: 360,
                        boxShadow: ['0 0 20px hsl(var(--destructive))', '0 0 40px hsl(var(--destructive))', '0 0 20px hsl(var(--destructive))']
                      }}
                      transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" }, boxShadow: { duration: 1, repeat: Infinity } }}
                      className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-destructive to-destructive/50 flex items-center justify-center"
                    >
                      <Cpu className="w-10 h-10 text-white" />
                    </motion.div>
                    
                    <h3 className="font-orbitron text-xl text-destructive animate-pulse">
                      A IA ESTÁ ANALISANDO SEUS DADOS BIOMÉTRICOS...
                    </h3>
                    
                    <p className="text-muted-foreground text-sm">
                      Processando padrões vocais e microexpressões
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="max-w-md mx-auto">
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-destructive via-red-500 to-destructive"
                        style={{ width: `${analyzingProgress}%` }}
                      />
                    </div>
                    <p className="text-center text-xs text-muted-foreground mt-2">
                      {Math.round(analyzingProgress)}% processado
                    </p>
                  </div>

                  {/* Bot analysis indicators */}
                  <div className="flex justify-center gap-6">
                    {BOTS.map((bot, i) => (
                      <motion.div
                        key={bot.id}
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: analyzingProgress > (i + 1) * 30 ? 1 : 0.5 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="text-3xl">{bot.avatar}</div>
                        <motion.div
                          animate={{ scale: analyzingProgress > (i + 1) * 30 ? [1, 1.2, 1] : 1 }}
                          transition={{ repeat: Infinity, duration: 0.5 }}
                        >
                          <Zap className={`w-4 h-4 ${analyzingProgress > (i + 1) * 30 ? 'text-destructive' : 'text-muted-foreground'}`} />
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* RESULT PHASE */}
              {gamePhase === 'result' && currentQuestion && (
                <div className="space-y-6">
                  {/* Question recap */}
                  <QuestionCard
                    question={currentQuestion}
                    showCorrectAnswer={true}
                    selectedOption={confirmedAnswer || undefined}
                    confirmedAnswer={confirmedAnswer || undefined}
                    disabled={true}
                  />

                  {/* Bot votes display */}
                  <div className="space-y-4">
                    <h3 className="font-orbitron text-lg text-center">Votos da IA</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {botVotes.map((vote, i) => {
                        const bot = BOTS.find(b => b.id === vote.botId);
                        return (
                          <motion.div
                            key={vote.botId}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.3 }}
                            className={`p-4 rounded-lg border-2 text-center ${
                              vote.vote === 'believe' 
                                ? 'bg-success/10 border-success/50' 
                                : 'bg-destructive/10 border-destructive/50'
                            }`}
                          >
                            <span className="text-3xl">{bot?.avatar}</span>
                            <p className="font-orbitron text-xs mt-2">{bot?.nickname}</p>
                            <p className={`font-bold text-sm mt-1 ${
                              vote.vote === 'believe' ? 'text-success' : 'text-destructive'
                            }`}>
                              {vote.vote === 'believe' ? 'CLARO ✓' : 'BLEFE ✗'}
                            </p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Result summary */}
                  <div className="p-4 rounded-lg bg-secondary/50 border border-border/50 text-center">
                    {confirmedAnswer === currentQuestion.correct_option ? (
                      <p className="text-success font-orbitron">✓ Parabéns! Você Acertou!</p>
                    ) : botVotes.filter(v => v.vote === 'believe').length > 0 ? (
                      <p className="text-gold font-orbitron">
                        🎭 Blefe bem-sucedido! {botVotes.filter(v => v.vote === 'believe').length} IA(s) acreditaram!
                      </p>
                    ) : (
                      <p className="text-muted-foreground font-orbitron">Resposta incorreta, mas você sobreviveu!</p>
                    )}
                  </div>

                  {/* Next round button */}
                  <div className="flex gap-4">
                    {hasGuaranteedPrize && (
                      <GoldButton 
                        variant="outline" 
                        onClick={() => setShowCashOutDialog(true)}
                        className="flex-1"
                      >
                        <Trophy className="w-5 h-5 mr-2" />
                        CASH OUT
                      </GoldButton>
                    )}
                    <GoldButton onClick={nextRound} className={hasGuaranteedPrize ? 'flex-1' : 'w-full'} size="lg">
                      <Play className="w-5 h-5 mr-2" />
                      Próxima Rodada ({currentRound + 1}/15)
                    </GoldButton>
                  </div>
                </div>
              )}

              {/* ELIMINATED PHASE */}
              {gamePhase === 'eliminated' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-6 p-8 bg-gradient-to-b from-destructive/20 via-destructive/10 to-background border-2 border-destructive/50 rounded-xl relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--destructive)/0.3)_0%,_transparent_70%)]" />
                  
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center relative z-10"
                  >
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ repeat: 3, duration: 0.3 }}
                    >
                      <Skull className="w-24 h-24 mx-auto text-destructive" />
                    </motion.div>
                    <h2 className="font-orbitron text-3xl text-destructive mt-4">ELIMINADO</h2>
                  </motion.div>

                  {aiTaunt && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="p-4 bg-destructive/20 border border-destructive/50 rounded-lg text-center relative z-10"
                    >
                      <BotIcon className="w-6 h-6 mx-auto text-destructive mb-2" />
                      <p className="text-destructive/90 italic">"{aiTaunt}"</p>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="relative z-10 space-y-4"
                  >
                    <p className="text-center text-muted-foreground">
                      Você sobreviveu até a rodada {currentRound}.
                      {hasGuaranteedPrize && safeAmount > 0 && (
                        <span className="block mt-2 text-gold">
                          Carta Bônus ativada! Você salvou {safeAmount.toLocaleString()} BluffCoins.
                        </span>
                      )}
                    </p>
                    
                    <div className="flex flex-col gap-3 pt-4">
                      <GoldButton 
                        onClick={() => {
                          // Reset game
                          setGamePhase('nickname');
                          setCurrentRound(0);
                          setAccumulatedPrize(0);
                          setBluffcoins(INITIAL_BLUFFCOINS);
                          setHasGuaranteedPrize(false);
                          setSafeAmount(0);
                          setHasImmunityCard(false);
                          setImmunityCardUsed(false);
                          setUsedQuestionIds(new Set());
                        }} 
                        className="w-full" 
                        size="lg"
                      >
                        <Play className="w-5 h-5 mr-2" />
                        TENTAR NOVAMENTE
                      </GoldButton>
                      <GoldButton variant="outline" onClick={() => navigate('/')} className="w-full">
                        <Home className="w-5 h-5 mr-2" />
                        Voltar ao Início
                      </GoldButton>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* VICTORY PHASE */}
              {gamePhase === 'victory' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6 text-center py-8"
                >
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Trophy className="w-24 h-24 mx-auto text-gold" />
                  </motion.div>
                  
                  <h2 className="font-orbitron text-3xl text-gold">
                    {currentRound === MAX_ROUNDS ? 'VITÓRIA TOTAL!' : 'CASH OUT!'}
                  </h2>
                  
                  <p className="text-2xl font-orbitron text-gold">
                    {accumulatedPrize.toLocaleString()} BluffCoins
                  </p>
                  
                  <p className="text-muted-foreground">
                    {currentRound === MAX_ROUNDS 
                      ? 'Você completou todas as 15 rodadas contra a IA!'
                      : `Você saiu com lucro na rodada ${currentRound}!`
                    }
                  </p>

                  <div className="flex flex-col gap-3 pt-4">
                    <GoldButton 
                      onClick={() => {
                        setGamePhase('nickname');
                        setCurrentRound(0);
                        setAccumulatedPrize(0);
                        setBluffcoins(INITIAL_BLUFFCOINS);
                        setHasGuaranteedPrize(false);
                        setSafeAmount(0);
                        setHasImmunityCard(false);
                        setImmunityCardUsed(false);
                        setUsedQuestionIds(new Set());
                        setShowMoneyRain(false);
                      }} 
                      className="w-full" 
                      size="lg"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      JOGAR NOVAMENTE
                    </GoldButton>
                    <GoldButton variant="outline" onClick={() => navigate('/')} className="w-full">
                      <Home className="w-5 h-5 mr-2" />
                      Voltar ao Início
                    </GoldButton>
                  </div>
                </motion.div>
              )}
            </LuxuryCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Round Progress */}
            <RoundProgress
              currentRound={currentRound}
              accumulatedPrize={accumulatedPrize}
              hasGuaranteedPrize={hasGuaranteedPrize}
              safeAmount={safeAmount}
              isHost={true}
              hasImmunityCard={hasImmunityCard}
              immunityCardUsed={immunityCardUsed}
            />

            {/* Bonus Cards Panel */}
            <BonusCardsPanel
              hasGuaranteedPrize={hasGuaranteedPrize}
              safeAmount={safeAmount}
              hasImmunityCard={hasImmunityCard}
              immunityCardUsed={immunityCardUsed}
            />

            {/* Bots info */}
            <LuxuryCard className="p-4">
              <h3 className="font-orbitron text-sm text-destructive mb-3 flex items-center gap-2">
                <BotIcon className="w-4 h-4" />
                OPONENTES IA
              </h3>
              <div className="space-y-2">
                {BOTS.map((bot) => (
                  <div key={bot.id} className="flex items-center gap-3 p-2 rounded bg-secondary/30">
                    <span className="text-xl">{bot.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-orbitron text-xs truncate">{bot.nickname}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{bot.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </LuxuryCard>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showMycroft && currentQuestion && (
          <MycroftPanel 
            question={currentQuestion} 
            variant="bluff"
            isVisible={showMycroft}
            onClose={() => setShowMycroft(false)}
          />
        )}
      </AnimatePresence>

      <BluffFeedback 
        phrase={bluffFeedback?.phrase || ''} 
        description={bluffFeedback?.description || ''} 
        visible={!!bluffFeedback} 
      />

      <BonusCardUnlock 
        show={showBonusUnlock} 
        safeAmount={safeAmount}
        onComplete={() => setShowBonusUnlock(false)}
      />

      <ImmunityCardUnlock 
        show={showImmunityUnlock} 
        onComplete={() => setShowImmunityUnlock(false)} 
      />

      <ImmunitySavedOverlay 
        show={showImmunitySaved} 
        onComplete={() => setShowImmunitySaved(false)} 
      />

      <CashOutDialog
        show={showCashOutDialog}
        currentRound={currentRound}
        maxRounds={MAX_ROUNDS}
        accumulatedPrize={accumulatedPrize}
        potentialPrize={PRIZE_LADDER.reduce((a, b) => a + b, 0)}
        onConfirm={handleCashOut}
        onCancel={() => setShowCashOutDialog(false)}
      />

      <MoneyRain show={showMoneyRain} amount={accumulatedPrize} />

      {/* Briefcase Modals */}
      <MysteryBriefcaseModal
        show={showBriefcaseModal}
        onOpenBriefcase={handleOpenBriefcase}
        onRefuse={handleRefuseBriefcase}
      />

      <BriefcaseRevealModal
        show={showBriefcaseReveal}
        prizeAmount={briefcasePrize}
        onContinue={handleBriefcaseRevealComplete}
      />
    </div>
  );
}
