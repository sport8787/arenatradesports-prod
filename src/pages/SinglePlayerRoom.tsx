import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { VoiceMetrics, startForensicsSession } from '@/services/audioForensicsService';
import { useSoloRankings } from '@/hooks/useSoloRankings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuestionHistory } from '@/hooks/useQuestionHistory';
// HÓRUS 2.0: useHorusNarration removido - agora usa horus2Engine
import { useQuestionAudioPreloader } from '@/hooks/useQuestionAudioPreloader';
import { useDialogManager } from '@/hooks/useDialogManager';
// HÓRUS 2.0: useAtomicNarrationTrigger removido - agora usa lastNarrationId
import { getOrCreateSessionId } from '@/lib/gameUtils';
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
import HorusPostVoteBribe from '@/components/game/HorusPostVoteBribe';
import WaxSealBreaking from '@/components/game/WaxSealBreaking';
import ContractTearing from '@/components/game/ContractTearing';
import { Input } from '@/components/ui/input';
import { Play, Bot as BotIcon, Loader2, Home, Lock, Unlock, Trophy, Cpu, Brain, Zap, Skull, Flame, Coins } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { stopGlobalAudio } from '@/services/globalAudioContext';
// HÓRUS 2.0: Agora usa horus2Engine como sistema principal
import { 
  playHorus2Audio, 
  stopHorus2Audio,
  hasLocalAudioForMoment
} from '@/services/horus2Engine';
// Note: horusLocalAudio imports removed - now using horus2Engine exclusively

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

// Generate weighted random briefcase prize - Casa sempre ganha
// NÍVEL 1 (Lixo): 70% - 500 a 5.000 BC
// NÍVEL 2 (Trocado): 25% - 10.000 a 40.000 BC
// NÍVEL 3 (Sorte): 4.5% - 50.000 a 100.000 BC
// NÍVEL 4 (Jackpot Raro): 0.5% - 250.000 BC fixo
const generateBriefcasePrize = (): number => {
  const random = Math.random();
  
  // NÍVEL 1 - Lixo (70%): Frustrar quem não teve coragem
  if (random < 0.70) {
    return Math.floor(Math.random() * 4501) + 500; // 500-5.000 BC
  }
  
  // NÍVEL 2 - Trocado (25%): Pagar o custo da passagem
  if (random < 0.95) {
    return Math.floor(Math.random() * 30001) + 10000; // 10.000-40.000 BC
  }
  
  // NÍVEL 3 - Sorte (4.5%): Prêmio razoável, longe do milhão
  if (random < 0.995) {
    return Math.floor(Math.random() * 50001) + 50000; // 50.000-100.000 BC
  }
  
  // NÍVEL 4 - Jackpot Raro (0.5%): O milagre, 1 em 200
  return 250000; // 250.000 BC fixo
};

// IMPORTANT: 'bribe_offer' must come BEFORE 'analyzing' to prevent spoilers
type GamePhase = 'nickname' | 'briefcase' | 'question' | 'recording' | 'bribe_offer' | 'analyzing' | 'result' | 'eliminated' | 'victory';

export default function SinglePlayerRoom() {
  const navigate = useNavigate();
  const { playChips, playSuspense, playFanfare, playReveal, playGameOver, playCashRegister, playCardUnlock, playShieldActivate, preloadSounds } = useSoundEffects();
  const { myRanking, getOrCreateSoloRanking, updateSoloRankingStats } = useSoloRankings();
  const { profile, isAuthenticated, loading: authLoading, addBluffCoins, updateProfile, refetchProfile } = useAuth();

  // Só considera convidado se NÃO estiver autenticado (evita bloquear salvamento após login)
  const isGuest = !isAuthenticated && sessionStorage.getItem('guestMode') === 'true';
  const savedGuestNickname = sessionStorage.getItem('guestNickname');
  const [guestNickname] = useState(() => savedGuestNickname || `Convidado${Math.floor(Math.random() * 9999)}`);
  const displayName = isGuest ? guestNickname : profile?.username || 'Jogador';
  
  // Use question history hook with user's profile ID
  const { questions, loading: questionsLoading, getNextQuestion, registerQuestionUsed, resetHistory } = useQuestionHistory(profile?.user_id);
  
  const [gamePhase, setGamePhase] = useState<GamePhase>('nickname');
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
  
  // Voice forensics metrics
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  
  // Horus Bribe phase states - limita a 2 ofertas por partida, só a partir da rodada 3
  const [bribeOffersCount, setBribeOffersCount] = useState(0);
  const MAX_BRIBE_OFFERS = 2;
  const MAX_BRIBE_ROUND = 8; // Só oferece até rodada 8
  const [showWaxSealBreaking, setShowWaxSealBreaking] = useState(false);
  const [showContractTearing, setShowContractTearing] = useState(false);
  const [isHorusListening, setIsHorusListening] = useState(false);
  const [horusPhrase, setHorusPhrase] = useState<string | null>(null);
  const [pendingResultData, setPendingResultData] = useState<{
    playerAnsweredCorrectly: boolean;
    votes: BotVote[];
    believeVotes: number;
    doubtVotes: number;
    shouldEliminate: boolean;
  } | null>(null);

  // HÓRUS 2.0: Hook legado removido, agora usa horus2Engine diretamente

  // Dialog manager for question_read narration
  const { 
    speak: speakPersona, 
    stopSpeaking, 
    clearQueue,
  } = useDialogManager({
    canPlayAudio: true,
    gameMode: 'single',
  });

  // HÓRUS 2.0: Ref para controle de narração
  const lastNarrationIdRef = useRef<string | null>(null);
  const questionReadTimeoutRef = useRef<number | null>(null);
  const thinkingTauntTimeoutRef = useRef<number | null>(null);
  const questionStartTimeRef = useRef<number | null>(null);

  // Keep latest references without forcing the narration effect to re-run on every render
  const currentQuestionRef = useRef<Question | null>(null);
  const speakPersonaRef = useRef(speakPersona);
  const stopSpeakingRef = useRef(stopSpeaking);
  const clearQueueRef = useRef(clearQueue);
  const playRevealRef = useRef(playReveal);

  useEffect(() => {
    currentQuestionRef.current = currentQuestion;
    speakPersonaRef.current = speakPersona;
    stopSpeakingRef.current = stopSpeaking;
    clearQueueRef.current = clearQueue;
    playRevealRef.current = playReveal;
  }, [currentQuestion, speakPersona, stopSpeaking, clearQueue, playReveal]);

  const sessionId = getOrCreateSessionId();

  // Question audio preloader DISABLED to prevent ElevenLabs credit consumption
  // Audio will only be generated at the exact moment of question display
  // const { preloadUpcomingQuestions } = useQuestionAudioPreloader({ enabled: false, preloadCount: 0 });

  // NOTE: Removed automatic SFX preloading to prevent ElevenLabs credit consumption on room entry
  // Sounds will be generated on-demand when needed.
  // Cleanup Horus audio on unmount
  useEffect(() => {
    return () => {
      if (questionReadTimeoutRef.current) {
        clearTimeout(questionReadTimeoutRef.current);
        questionReadTimeoutRef.current = null;
      }
      if (thinkingTauntTimeoutRef.current) {
        clearTimeout(thinkingTauntTimeoutRef.current);
        thinkingTauntTimeoutRef.current = null;
      }
      clearQueueRef.current();
      stopSpeakingRef.current();
      stopGlobalAudio();
      stopHorus2Audio();
    };
  }, []);

  const currentQuestionId = currentQuestion?.id ?? null;

  // HÓRUS 2.0: Question narration trigger (simplified)
  useEffect(() => {
    if (questionReadTimeoutRef.current) {
      clearTimeout(questionReadTimeoutRef.current);
      questionReadTimeoutRef.current = null;
    }
    if (thinkingTauntTimeoutRef.current) {
      clearTimeout(thinkingTauntTimeoutRef.current);
      thinkingTauntTimeoutRef.current = null;
    }

    if (gamePhase !== 'question') {
      clearQueueRef.current();
      stopSpeakingRef.current();
      stopGlobalAudio();
      questionStartTimeRef.current = null;
      return;
    }

    if (!currentQuestionId) return;
    
    // HÓRUS 2.0: Prevent duplicate narration
    const narrationId = `question_${currentQuestionId}`;
    if (lastNarrationIdRef.current === narrationId) return;
    lastNarrationIdRef.current = narrationId;
    
    // Track when question started for timeout detection
    questionStartTimeRef.current = Date.now();

    playRevealRef.current();

    questionReadTimeoutRef.current = window.setTimeout(() => {
      const q = currentQuestionRef.current;
      if (!q || q.id !== currentQuestionId) return;

      playHorus2Audio('question_read', q.question_text);
    }, 800);
    
    // HÓRUS 2.0: Bordão after 20 seconds if player hasn't answered
    thinkingTauntTimeoutRef.current = window.setTimeout(() => {
      // Only play if still in question phase
      if (gamePhase === 'question' && !confirmedAnswer) {
        playHorus2Audio('thinking_taunt');
      }
    }, 20000);
  }, [gamePhase, currentQuestionId, confirmedAnswer]);

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

    // Start first round directly (opening plays on login now)
    setCurrentRound(1);
    setAccumulatedPrize(0);
    await selectNextQuestion();
    startForensicsSession(); // Start tracking response latency
    setGamePhase('question');
  };
  
  // Persist bluffcoins to profile using atomic RPC (only for authenticated non-guest users)
  const persistWinnings = async (amount: number, isVictory: boolean = false) => {
    // Don't persist for guests
    if (isGuest) {
      toast({ title: 'Modo Convidado', description: 'BluffCoins não foram salvos. Faça login para guardar seu progresso!' });
      return;
    }
    if (!profile || amount <= 0) return;
    
    try {
      console.log(`[BANK] Processando depósito de: ${amount} BluffCoins...`);
      
      // Use atomic RPC function for secure balance update
      const { error: rpcError } = await supabase.rpc('increment_bluffcoins', {
        p_user_id: profile.user_id,
        p_amount: amount
      });
      
      if (rpcError) {
        console.error('[BANK ERROR] RPC failed:', rpcError);
        throw rpcError;
      }
      
      // Update matches_played and wins separately
      await updateProfile({ 
        matches_played: profile.matches_played + 1,
        wins: isVictory ? profile.wins + 1 : profile.wins
      });
      
      // Force refetch profile to update UI immediately
      await refetchProfile?.();
      
      const newBalance = profile.bluff_coins + amount;
      console.log('[BANK] Depósito confirmado! Novo saldo estimado:', newBalance);
      
      toast({ 
        title: 'Depósito Confirmado! 💰', 
        description: `${amount.toLocaleString()} BluffCoins foram adicionados à sua carteira.` 
      });
    } catch (error) {
      console.error('[BANK ERROR] Falha ao depositar:', error);
      toast({ 
        title: 'Erro de Conexão', 
        description: 'Seu saldo será sincronizado na próxima reconexão.',
        variant: 'destructive'
      });
    }
  };

  const selectNextQuestion = async () => {
    // Use intelligent question selection with history - pass current round for difficulty filtering
    const nextRound = currentRound + 1;
    let nextQ = getNextQuestion(nextRound);
    
    // If null, all questions exhausted - reset and get fresh
    if (!nextQ) {
      await resetHistory();
      // After reset, get first question from full pool filtered by difficulty
      nextQ = getNextQuestion(nextRound);
      if (!nextQ && questions.length > 0) {
        const randomIndex = Math.floor(Math.random() * questions.length);
        nextQ = questions[randomIndex];
      }
    }
    
    if (nextQ) {
      setCurrentQuestion(nextQ);
      // Register this question as used
      await registerQuestionUsed(nextQ.id);
    }
    
    // Reset states
    setSelectedAnswer(null);
    setConfirmedAnswer(null);
    setShowAnswer(false);
    setMycroftUsed(false);
    setBotVotes([]);
    setAiTaunt(null);
    setAnalyzingProgress(0);

    // Preload audio DISABLED to prevent ElevenLabs credit consumption
    // Audio will only be generated at the exact moment of question display
  };

  const confirmAnswer = () => {
    if (!selectedAnswer) return;
    setConfirmedAnswer(selectedAnswer);
    setShowAnswer(true);
    playReveal();
    
    // NOTE: Mycroft audio removed from here - it was playing at wrong time
    // Now we only play audio after jury analysis is complete
    
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
      
      // Play the special victory audio for 1 million
      stopHorus2Audio();
      const victoryAudio = new Audio('/audio/horus/victory_1m.mp3');
      victoryAudio.play().catch(console.error);
      playFanfare();
      
      // Persist winnings to profile
      await persistWinnings(FINAL_ROUND_PRIZE, true);
      
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
        await persistWinnings(finalPrize, false);
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
    // Check if player answered correctly BEFORE showing bribe offer
    // Bribe only makes sense if player got it WRONG (they need a way out)
    const playerAnsweredCorrectly = confirmedAnswer === currentQuestion?.correct_option;
    
    // Regras do Acordo de Ouro:
    // 1. Só aparece a partir da rodada 3
    // 2. Só aparece até a rodada 8
    // 3. Máximo de 2 ofertas por partida
    // 4. Só aparece se o jogador ERROU a pergunta
    const shouldOfferBribe = 
      !playerAnsweredCorrectly && 
      currentRound >= 3 && 
      currentRound <= MAX_BRIBE_ROUND && 
      bribeOffersCount < MAX_BRIBE_OFFERS &&
      accumulatedPrize > 0;
    
    if (!shouldOfferBribe) {
      // Log why we skipped
      const skipReason = playerAnsweredCorrectly 
        ? 'player answered correctly'
        : currentRound < 3 
          ? `round ${currentRound} < 3`
          : currentRound > MAX_BRIBE_ROUND
            ? `round ${currentRound} > ${MAX_BRIBE_ROUND}`
            : bribeOffersCount >= MAX_BRIBE_OFFERS
              ? `offers exhausted (${bribeOffersCount}/${MAX_BRIBE_OFFERS})`
              : 'no accumulated prize';
      console.log('[Hórus Offer] Skipped -', skipReason);
      
      // Skip bribe offer - go directly to analysis
      proceedToAnalysis();
      return;
    }
    
    // Increment bribe offer counter
    setBribeOffersCount(prev => prev + 1);
    console.log(`[Hórus Offer] Showing offer #${bribeOffersCount + 1} at round ${currentRound}`);
    
    // Show Horus bribe offer BEFORE analyzing phase
    setGamePhase('bribe_offer');
    playSuspense();
    setIsHorusListening(true);
    setHorusPhrase('Seu destino já está selado, mas eu tenho um acordo...');
    
    // Play Horus's bribe audio immediately
    playHorus2Audio('acordo', undefined, () => {
      // Audio finished - keep listening state but allow choices
      setIsHorusListening(false);
    });
  };
  
  // Called when player makes a decision on the bribe offer
  const proceedToAnalysis = () => {
    setGamePhase('analyzing');
    
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

  // processResults is now called AFTER the bribe decision
  // The bribe decision happens in the bribe_offer phase, not here
  const processResults = async () => {
    if (!currentQuestion || !confirmedAnswer) return;

    const playerAnsweredCorrectly = confirmedAnswer === currentQuestion.correct_option;
    const votes = calculateBotVotes(playerAnsweredCorrectly);
    setBotVotes(votes);

    const believeVotes = votes.filter(v => v.vote === 'believe').length;
    const doubtVotes = votes.filter(v => v.vote === 'doubt').length;

    // Check elimination: wrong answer + all bots voted BLEFE
    const shouldEliminate = !playerAnsweredCorrectly && doubtVotes === 3;

    // Store pending result data for post-reveal processing
    setPendingResultData({
      playerAnsweredCorrectly,
      votes,
      believeVotes,
      doubtVotes,
      shouldEliminate,
    });
    
    // Now we go directly to result handling since bribe was already offered
    if (playerAnsweredCorrectly) {
      // Player answered correctly - victory reveal
      handleVictoryReveal(playerAnsweredCorrectly, believeVotes, shouldEliminate);
    } else {
      // Player rejected the bribe and got it wrong - show wax seal then result
      setShowWaxSealBreaking(true);
    }
  };

  // Handle direct victory reveal (when player answered correctly)
  const handleVictoryReveal = async (
    playerAnsweredCorrectly: boolean,
    believeVotes: number,
    shouldEliminate: boolean
  ) => {
    // HÓRUS 2.0: Play local victory audio
    playHorus2Audio('victory');
    
    // Calculate rewards
    let reward = HOST_CORRECT_ANSWER;
    toast({ title: `+${HOST_CORRECT_ANSWER} BluffCoins`, description: 'Resposta correta!' });

    setBluffcoins(prev => prev + reward);
    
    // Prize is NOT cumulative - it REPLACES the previous value
    const roundPrize = PRIZE_LADDER[currentRound - 1];
    setAccumulatedPrize(roundPrize);

    setGamePhase('result');
    playReveal();
    setTimeout(() => playFanfare(), 800);
    setPendingResultData(null);
  };


  // Handle when player listens to Horus proposal - audio already started in submitAudio
  const handleHorusListen = async () => {
    // Audio is already playing from submitAudio, this is for the component callback
    setIsHorusListening(true);
    setHorusPhrase('Seu destino já está selado, mas eu tenho um acordo...');
  };

  // Handle when player accepts Horus bribe in bribe_offer phase (cash out before seeing result)
  const handleHorusAcceptBribe = async () => {
    stopHorus2Audio();
    
    // Show contract tearing animation
    setShowContractTearing(true);
  };

  // Called when contract tearing animation completes
  const handleContractTearingComplete = async () => {
    setShowContractTearing(false);
    setPendingResultData(null);
    
    setShowMoneyRain(true);
    playCashRegister();
    
    // Persist winnings to profile
    await persistWinnings(accumulatedPrize, true);
    
    // Update ranking
    if (myRanking) {
      updateSoloRankingStats({ 
        addGame: true, 
        addWin: true,
        setBestRound: currentRound,
        addPoints: accumulatedPrize 
      });
    }
    
    toast({ title: '💰 ACORDO DE OURO ACEITO!', description: `Você saiu com ${accumulatedPrize.toLocaleString()} BluffCoins!` });
    setGamePhase('victory');
  };

  // Handle when player rejects Horus bribe (proceed to jury analysis)
  const handleHorusRejectBribe = async () => {
    stopHorus2Audio();
    
    // Player rejected the offer - now proceed to analyzing phase
    proceedToAnalysis();
  };

  // Called when wax seal breaking animation completes
  const handleWaxSealBreakingComplete = async () => {
    setShowWaxSealBreaking(false);
    
    if (!pendingResultData) return;
    
    const { playerAnsweredCorrectly, believeVotes, shouldEliminate } = pendingResultData;
    
    if (shouldEliminate) {
      // Player is about to be eliminated - play the mockery
      if (currentRound === MAX_ROUNDS) {
        // HÓRUS 2.0: All-in loss audio
        playHorus2Audio('all_in_loss');
        
        // Zero the balance immediately for All-in
        setAccumulatedPrize(0);
        setBluffcoins(0);
        
        playGameOver();
        setGamePhase('eliminated');
      } else if (hasImmunityCard && !immunityCardUsed) {
        // Immunity saves the player
        setImmunityCardUsed(true);
        setShowImmunitySaved(true);
        playShieldActivate();
        setGamePhase('result');
        playReveal();
      } else {
        // HÓRUS 2.0: Play elimination audio
        playHorus2Audio('elimination');
        
        // Show AI taunt and eliminate
        setAiTaunt(getRandomTaunt());
        playGameOver();
        
        // Persist safe amount if any
        const finalPrize = hasGuaranteedPrize ? safeAmount : 0;
        if (finalPrize > 0) {
          await persistWinnings(finalPrize, false);
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
      }
      setPendingResultData(null);
      return;
    }
    
    // Calculate rewards (player survived even though they were bluffing)
    let reward = 0;
    
    if (playerAnsweredCorrectly) {
      reward = HOST_CORRECT_ANSWER;
      // HÓRUS 2.0: Play victory audio for correct answer
      playHorus2Audio('correct_answer');
      toast({ title: `+${HOST_CORRECT_ANSWER} BluffCoins`, description: 'Resposta correta!' });
    } else if (believeVotes > 0) {
      // Bluff successful
      // HÓRUS 2.0: Play bluff success audio
      playHorus2Audio('bluff_success');
      
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

    setGamePhase('result');
    playReveal();
    setTimeout(() => playFanfare(), 800);
    setPendingResultData(null);
  };

  const nextRound = async () => {
    if (currentRound >= MAX_ROUNDS) return;
    
    const nextRoundNum = currentRound + 1;
    setCurrentRound(nextRoundNum);
    await selectNextQuestion();
    setNewlyUnlockedCard(null);
    
    // HÓRUS 2.0: Play round transition bordão (always play between rounds)
    playHorus2Audio('round_transition');
    
    // Show briefcase modal before round 15
    if (nextRoundNum === MAX_ROUNDS) {
      setShowBriefcaseModal(true);
    } else {
      startForensicsSession();
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
    await persistWinnings(prize, true);
    
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
    startForensicsSession();
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
    await persistWinnings(accumulatedPrize, true);
    
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
                    autoNarrate={false}
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
                    autoNarrate={false}
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

              {/* BRIBE OFFER PHASE - Horus makes his offer before jury votes */}
              {gamePhase === 'bribe_offer' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="space-y-8 py-12"
                >
                  <div className="text-center space-y-4">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.1, 1],
                        opacity: [0.7, 1, 0.7]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-gold/30 to-amber-600/20 flex items-center justify-center border-2 border-gold/50"
                    >
                      <Coins className="w-10 h-10 text-gold" />
                    </motion.div>
                    
                    <h3 className="font-orbitron text-xl text-gold animate-pulse">
                      HÓRUS TEM UMA PROPOSTA...
                    </h3>
                    
                    <p className="text-muted-foreground text-sm">
                      O mestre do jogo quer negociar seu destino
                    </p>
                  </div>
                </motion.div>
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
                    autoNarrate={false}
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
                          resetHistory();
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
                        resetHistory();
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
        potentialPrize={PRIZE_LADDER[PRIZE_LADDER.length - 1]}
        onConfirm={handleCashOut}
        onCancel={() => setShowCashOutDialog(false)}
      />

      <MoneyRain show={showMoneyRain} amount={accumulatedPrize} />

      {/* Horus Bribe Offer - shown during bribe_offer phase BEFORE results */}
      <HorusPostVoteBribe
        isVisible={gamePhase === 'bribe_offer'}
        totalBluffCoins={accumulatedPrize > 0 ? accumulatedPrize : null}
        onAcceptBribe={handleHorusAcceptBribe}
        onRejectBribe={handleHorusRejectBribe}
        onListenProposal={handleHorusListen}
        isListening={isHorusListening}
        isLoading={false}
        currentPhrase={horusPhrase}
        isAllIn={currentRound === MAX_ROUNDS}
        playerGotCorrect={false}
      />

      {/* Wax Seal Breaking Animation - when player rejects Horus offer */}
      <WaxSealBreaking
        isVisible={showWaxSealBreaking}
        onAnimationComplete={handleWaxSealBreakingComplete}
      />

      {/* Contract Tearing Animation - when player accepts Horus offer */}
      <ContractTearing
        isVisible={showContractTearing}
        prizeAmount={accumulatedPrize}
        onAnimationComplete={handleContractTearingComplete}
      />

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
