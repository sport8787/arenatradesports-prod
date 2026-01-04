import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { VoiceMetrics, startForensicsSession } from '@/services/audioForensicsService';
import { useSoloRankings } from '@/hooks/useSoloRankings';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuestionHistory } from '@/hooks/useQuestionHistory';
import { useQuestionAudioPreloader } from '@/hooks/useQuestionAudioPreloader';
import { useDialogManager } from '@/hooks/useDialogManager';
import { getOrCreateSessionId } from '@/lib/gameUtils';
import { Question } from '@/types/game';
import { BOTS, Bot, BotVote, calculateBotVotes, getRandomTaunt, ShadowPlayer, generateShadowPlayers, analyzeVoiceForVoting, VoiceAnalysisResult } from '@/types/bot';
import { VotingSimulation } from '@/components/game/VotingSimulation';
import { VoteReveal } from '@/components/game/VoteReveal';
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
import { GoldenParticles } from '@/components/game/GoldenParticles';
import { HorusTerminal } from '@/components/HorusTerminal';
import { BalanceHeader } from '@/components/game/BalanceHeader';
import { CoinVaultAnimation } from '@/components/game/CoinVaultAnimation';
import { useEconomy } from '@/hooks/useEconomy';
import { Input } from '@/components/ui/input';
import { Play, Bot as BotIcon, Loader2, Home, Lock, Unlock, Trophy, Cpu, Brain, Zap, Skull, Flame, Coins, MessageCircle, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
// HÓRUS 2.0 + NarrativeEngine + Central Audio Queue
import { 
  playHorus2Audio, 
  stopHorus2Audio,
  hasLocalAudioForMoment
} from '@/services/horus2Engine';
import { clearAllAudio } from '@/services/centralAudioQueue';
import { NarrativeProvider, useNarrative } from '@/contexts/NarrativeContext';
import { getNarrativeEngine, resetNarrativeEngine, NarrativeChoice } from '@/services/narrativeEngine';
import NarrativeChoiceModal from '@/components/game/NarrativeChoiceModal';
import NarrativeOverlay from '@/components/game/NarrativeOverlay';
import PressureEffects from '@/components/game/PressureEffects';
import NarrativeDisplay from '@/components/game/NarrativeDisplay';
import CinematicEvent from '@/components/game/CinematicEvent';
import { getActPhraseText, getSilentObserverPhrase } from '@/data/horusActPhrases';
import { getCartaBonusAudio } from '@/services/horusLocalAudio';
import { backgroundMusic } from '@/services/backgroundMusicService';
import { 
  createInitialPsychologyState, 
  updatePsychologyState, 
  checkAndTriggerDialogue,
  PlayerPsychologyState,
  DialogueType
} from '@/services/horusPsychologyService';
import { 
  resetPressureState, 
  setPressureRound, 
  checkAndTriggerBomb,
  getPressureConfig 
} from '@/services/pressureTimerService';
import PressureTimer from '@/components/game/PressureTimer';
import { 
  checkAndTriggerSilentObserver, 
  resetSilentObserver 
} from '@/services/silentObserverService';
import { 
  checkAndTriggerCognitiveRupture, 
  resetCognitiveRupture 
} from '@/services/cognitiveRuptureService';

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

// IMPORTANT: 'bribe_offer' must come BEFORE 'voting_simulation' to prevent spoilers
type GamePhase = 'nickname' | 'briefcase' | 'question' | 'recording' | 'bribe_offer' | 'voting_simulation' | 'vote_reveal' | 'analyzing' | 'result' | 'eliminated' | 'victory';

// Wrapper component that provides NarrativeContext
export default function SinglePlayerRoom() {
  return (
    <NarrativeProvider enabled={true}>
      <SinglePlayerRoomContent />
    </NarrativeProvider>
  );
}

function SinglePlayerRoomContent() {
  const navigate = useNavigate();
  const { playChips, playSuspense, playFanfare, playReveal, playGameOver, playCashRegister, playCardUnlock, playShieldActivate, preloadSounds } = useSoundEffects();
  const { myRanking, getOrCreateSoloRanking, updateSoloRankingStats } = useSoloRankings();
  const { profile, isAuthenticated, loading: authLoading, addBluffCoins, updateProfile, refetchProfile } = useAuth();
  const economy = useEconomy();
  const [showCoinVault, setShowCoinVault] = useState(false);
  const [coinVaultAmount, setCoinVaultAmount] = useState(0);
  
  // NarrativeEngine integration
  const narrative = useNarrative();

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

  // Shadow Players (humanized bots)
  const [shadowPlayers, setShadowPlayers] = useState<ShadowPlayer[]>([]);
  const [botVotes, setBotVotes] = useState<BotVote[]>([]);
  const [analyzingProgress, setAnalyzingProgress] = useState(0);
  const [aiTaunt, setAiTaunt] = useState<string | null>(null);
  
  // Game phase for economy
  const [currentGamePhase, setCurrentGamePhase] = useState<1 | 2 | 3>(1);

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
  
  // Narrative Choice checkpoint (rodada 13)
  const [showNarrativeChoice, setShowNarrativeChoice] = useState(false);
  const narrativeEngineRef = useRef(getNarrativeEngine(displayName));
  
  // CinematicEvent states
  const [showCinematicEvent, setShowCinematicEvent] = useState(false);
  const [cinematicEventType, setCinematicEventType] = useState<'blefe_perfeito' | 'carta_bonus' | 'evento_oculto' | 'climax' | 'epic_moment'>('epic_moment');
  const [cinematicTitle, setCinematicTitle] = useState('');
  const [cinematicSubtitle, setCinematicSubtitle] = useState('');
  const [cinematicAudioPath, setCinematicAudioPath] = useState<string | undefined>(undefined);
  const [cinematicCardType, setCinematicCardType] = useState<'porto_seguro' | 'imunidade'>('porto_seguro');
  
  // Voice forensics metrics
  const [voiceMetrics, setVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [hasRecordedAudio, setHasRecordedAudio] = useState(false);
  const [voiceAnalysis, setVoiceAnalysis] = useState<VoiceAnalysisResult | null>(null);
  
  // Horus Bribe phase states - limita a 2 ofertas por partida, só a partir da rodada 3
  const [bribeOffersCount, setBribeOffersCount] = useState(0);
  const MAX_BRIBE_OFFERS = 2;
  const MAX_BRIBE_ROUND = 8; // Só oferece até rodada 8
  const [showWaxSealBreaking, setShowWaxSealBreaking] = useState(false);
  const [showContractTearing, setShowContractTearing] = useState(false);
  const [showGoldenParticles, setShowGoldenParticles] = useState(false);
  const [isHorusListening, setIsHorusListening] = useState(false);
  const [horusPhrase, setHorusPhrase] = useState<string | null>(null);
  const [pendingResultData, setPendingResultData] = useState<{
    playerAnsweredCorrectly: boolean;
    votes: BotVote[];
    believeVotes: number;
    doubtVotes: number;
    shouldEliminate: boolean;
  } | null>(null);

  // HorusTerminal visibility state
  const [showHorusTerminal, setShowHorusTerminal] = useState(false);
  const [lastAction, setLastAction] = useState<string>("Iniciando partida");
  
  // Psychology dialogue system
  const [psychologyState, setPsychologyState] = useState<PlayerPsychologyState>(() => 
    createInitialPsychologyState(profile?.username || 'Jogador')
  );
  const [psychologyPhrase, setPsychologyPhrase] = useState<string | null>(null);

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
  // Cleanup all audio on unmount - uses centralized queue
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
      // Central audio queue cleanup (stops all audio and clears queue)
      clearAllAudio();
      // Stop background music when leaving the game
      backgroundMusic.stop();
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
      clearAllAudio();
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
    
    // BORDÕES DESATIVADOS: Hórus só fala em momentos narrativos específicos
    // Não há mais taunt aleatório após 20 segundos
  }, [gamePhase, currentQuestionId]);

  // Redirect to auth if not authenticated and not guest
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !isGuest) {
      navigate('/auth');
    }
  }, [isAuthenticated, authLoading, navigate, isGuest]);

  // Load shadow players from sessionStorage (set by FakeLobby)
  useEffect(() => {
    const storedPlayers = sessionStorage.getItem('horusShadowPlayers');
    const storedPhase = sessionStorage.getItem('gamePhase');
    
    if (storedPlayers) {
      try {
        const parsed = JSON.parse(storedPlayers) as ShadowPlayer[];
        setShadowPlayers(parsed);
        sessionStorage.removeItem('horusShadowPlayers');
      } catch (e) {
        // Fallback to generated players
        setShadowPlayers(generateShadowPlayers(3));
      }
    } else if (shadowPlayers.length === 0) {
      // Generate default shadow players if none stored
      setShadowPlayers(generateShadowPlayers(3));
    }
    
    if (storedPhase) {
      const phase = parseInt(storedPhase) as 1 | 2 | 3;
      if (phase >= 1 && phase <= 3) {
        setCurrentGamePhase(phase);
      }
      sessionStorage.removeItem('gamePhase');
    }
  }, []);

  const startGame = async () => {
    // Guest users don't have a profile; allow them to play without persistence.
    const nickname = isGuest ? guestNickname : profile?.username;

    if (!nickname) {
      toast({ title: 'Erro ao iniciar', description: 'Não foi possível definir seu nickname.', variant: 'destructive' });
      return;
    }

    if (!isGuest && !profile) {
      toast({ title: 'Erro ao carregar perfil', variant: 'destructive' });
      return;
    }

    // Check and deduct NT cost for phase 2/3
    const phaseConfig = economy.getPhaseConfig(currentGamePhase);
    if (phaseConfig && phaseConfig.ntCost > 0) {
      if (economy.ntBalance < phaseConfig.ntCost) {
        toast({ 
          title: '⚡ Saldo de NT insuficiente', 
          description: `Você precisa de ${phaseConfig.ntCost} NT para este desafio.`,
          variant: 'destructive' 
        });
        return;
      }
      
      // Deduct NT cost
      const success = await economy.spendNT(phaseConfig.ntCost);
      if (!success) {
        toast({ 
          title: 'Erro ao processar pagamento', 
          description: 'Tente novamente.',
          variant: 'destructive' 
        });
        return;
      }
      
      // Show toast for NT consumption
      toast({ 
        title: `⚡ -${phaseConfig.ntCost} NT consumidos`, 
        description: 'Custo de entrada debitado.' 
      });
    }

    // Create/update solo ranking
    await getOrCreateSoloRanking(nickname);

    // Reset NarrativeEngine, Silent Observer, Ruptura Cognitiva e Pressure Timer para nova partida
    resetNarrativeEngine();
    resetSilentObserver();
    resetCognitiveRupture();
    resetPressureState();
    narrativeEngineRef.current = getNarrativeEngine(nickname);

    // Start first round directly (opening plays on login now)
    setCurrentRound(1);
    setPressureRound(1);
    setAccumulatedPrize(0);
    await selectNextQuestion();
    startForensicsSession(); // Start tracking response latency
    
    // ÁUDIO DA RODADA 1 REMOVIDO DAQUI
    // O áudio agora toca APÓS o jogador responder (handleVictoryReveal ou handleWaxSealBreakingComplete)
    
    setGamePhase('question');
  };
  
  // Persist BC to profile using economy hook (only for authenticated non-guest users)
  const persistWinnings = async (amount: number, isVictory: boolean = false) => {
    // Don't persist for guests
    if (isGuest) {
      toast({ title: 'Modo Convidado', description: 'BleffCoins não foram salvos. Faça login para guardar seu progresso!' });
      return;
    }
    if (!profile || amount <= 0) return;
    
    try {
      console.log(`[BANK] Processando depósito de: ${amount} BC...`);
      
      // Use economy hook for BC update (uses RPC internally)
      const success = await economy.addBC(amount);
      
      if (!success) {
        throw new Error('Failed to add BC');
      }
      
      // Update matches_played and wins separately
      await updateProfile({ 
        matches_played: profile.matches_played + 1,
        wins: isVictory ? profile.wins + 1 : profile.wins
      });
      
      // Force refetch profile to update UI immediately
      await refetchProfile?.();
      await economy.refreshBalances();
      
      console.log('[BANK] Depósito BC confirmado!');
      
      // Show coin vault animation
      setCoinVaultAmount(amount);
      setShowCoinVault(true);
      
      // Show toast for BC addition
      toast({ 
        title: `💎 +${amount.toLocaleString()} BC adicionados ao seu cofre`, 
        description: isVictory ? 'Vitória confirmada!' : 'Prêmio salvo!'
      });
    } catch (error) {
      console.error('[BANK ERROR] Falha ao depositar BC:', error);
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
    setHasRecordedAudio(false);
    setVoiceMetrics(null);
    setVoiceAnalysis(null);

    // Preload audio DISABLED to prevent ElevenLabs credit consumption
    // Audio will only be generated at the exact moment of question display
  };

  const confirmAnswer = () => {
    if (!selectedAnswer) return;
    setConfirmedAnswer(selectedAnswer);
    setShowAnswer(true);
    playReveal();
    
    // Update lastAction for HorusTerminal
    const isCorrect = selectedAnswer === currentQuestion?.correct_option;
    setLastAction(isCorrect ? "Acertou a pergunta" : "Errou a pergunta");
    
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

  const submitAudio = (withAudio: boolean = false) => {
    // Analyze voice metrics for voting influence
    const analysis = analyzeVoiceForVoting(voiceMetrics, withAudio && hasRecordedAudio);
    setVoiceAnalysis(analysis);
    
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
      
      // Skip bribe offer - go to voting simulation
      startVotingSimulation();
      return;
    }
    
    // Increment bribe offer counter
    setBribeOffersCount(prev => prev + 1);
    console.log(`[Hórus Offer] Showing offer #${bribeOffersCount + 1} at round ${currentRound}`);
    
    // Show Horus bribe offer BEFORE voting phase
    setGamePhase('bribe_offer');
    playSuspense();
    // CORREÇÃO: Não inicia listening automaticamente - aguarda clique em "Ouvir Acordo"
    setIsHorusListening(false);
    setHorusPhrase(null);
    setLastAction("Recebendo proposta do Hórus");
  };
  
  // Start voting simulation with delay
  const startVotingSimulation = () => {
    setGamePhase('voting_simulation');
    playSuspense();
    setLastAction("Aguardando votos dos desafiantes");
  };
  
  // Called when voting simulation completes - calculate and show votes
  const handleVotingSimulationComplete = () => {
    if (!currentQuestion || !confirmedAnswer) return;
    
    const playerAnsweredCorrectly = confirmedAnswer === currentQuestion.correct_option;
    // Use shadow players for voting with voice analysis influence
    const votes = calculateBotVotes(
      playerAnsweredCorrectly, 
      shadowPlayers.length > 0 ? shadowPlayers : undefined,
      voiceAnalysis || undefined
    );
    setBotVotes(votes);
    
    // Move to vote reveal phase
    setGamePhase('vote_reveal');
  };
  
  // Called when vote reveal completes - process results
  const handleVoteRevealComplete = () => {
    processResults();
  };
  
  // Called when player makes a decision on the bribe offer
  const proceedToAnalysis = () => {
    // After bribe decision, go to voting simulation
    startVotingSimulation();
  };

  // processResults is now called AFTER the vote reveal
  // Votes are already calculated in handleVotingSimulationComplete
  const processResults = async () => {
    if (!currentQuestion || !confirmedAnswer) return;

    const playerAnsweredCorrectly = confirmedAnswer === currentQuestion.correct_option;
    // Votes were already set in handleVotingSimulationComplete
    const votes = botVotes;

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
    
    // Now we go directly to result handling since votes are already revealed
    if (playerAnsweredCorrectly) {
      // Player answered correctly - victory reveal
      handleVictoryReveal(playerAnsweredCorrectly, believeVotes, shouldEliminate);
    } else {
      // Player got it wrong - show wax seal then result
      setShowWaxSealBreaking(true);
    }
  };

  // Handle direct victory reveal (when player answered correctly)
  const handleVictoryReveal = async (
    playerAnsweredCorrectly: boolean,
    believeVotes: number,
    shouldEliminate: boolean
  ) => {
    // NarrativeEngine: Advance round with result
    narrative.advanceRound(playerAnsweredCorrectly);
    
    // Update psychology state
    setPsychologyState(prev => updatePsychologyState(prev, playerAnsweredCorrectly, false));
    
    // Get act-specific phrase
    const actPhrase = getActPhraseText(narrative.currentAct.id, 'correct');
    
    // HÓRUS 2.0: Play local victory audio with act phrase
    playHorus2Audio('victory', actPhrase || undefined);
    
    // Check for recognition dialogue (3+ consecutive correct)
    const updatedState = updatePsychologyState(psychologyState, playerAnsweredCorrectly, false);
    
    // 👁️ SILENT OBSERVER EVENT: Check for 5 consecutive correct answers
    if (updatedState.consecutiveCorrect === 5) {
      setTimeout(async () => {
        const result = await checkAndTriggerSilentObserver(
          updatedState.consecutiveCorrect,
          displayName,
          () => {
            // After audio completes, show the cinematic
            console.log('[SilentObserver] Audio complete, showing cinematic');
          }
        );
        
        if (result.triggered) {
          // Show cinematic event with the phrase
          setCinematicEventType('evento_oculto');
          setCinematicTitle('');
          setCinematicSubtitle(result.phrase);
          setShowCinematicEvent(true);
          
          toast({
            title: '👁️ O Observador Silencioso',
            description: 'Algo maior está observando você...',
          });
        }
      }, 2500);
    }
    // DIÁLOGOS DE RECONHECIMENTO DESATIVADOS: Hórus só fala no Observador Silencioso (5 acertos)
    
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


  // Handle when player clicks "Ouvir Acordo" - starts audio playback
  const handleHorusListen = async () => {
    setIsHorusListening(true);
    setHorusPhrase('Seu destino já está selado, mas eu tenho um acordo...');
    
    // Play Horus's bribe audio when player clicks listen
    playHorus2Audio('acordo', undefined, () => {
      // Audio finished - choices will appear automatically via component timer
      console.log('[Hórus Offer] Audio complete');
    });
  };

  // Handle when player accepts Horus bribe in bribe_offer phase (cash out before seeing result)
  const handleHorusAcceptBribe = async () => {
    stopHorus2Audio();
    setLastAction("Aceitou o acordo do Hórus");
    // Show golden particles first for impact
    setShowGoldenParticles(true);
    // Show contract tearing animation after a brief delay
    setTimeout(() => {
      setShowContractTearing(true);
    }, 500);
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
    setLastAction("Rejeitou o acordo - enfrentando o júri");
    
    // Player rejected the offer - now proceed to analyzing phase
    proceedToAnalysis();
  };

  // Called when wax seal breaking animation completes
  const handleWaxSealBreakingComplete = async () => {
    setShowWaxSealBreaking(false);
    
    if (!pendingResultData) return;
    
    const { playerAnsweredCorrectly, believeVotes, shouldEliminate } = pendingResultData;
    
    // Update psychology state for error tracking
    const updatedPsychState = updatePsychologyState(psychologyState, playerAnsweredCorrectly, !playerAnsweredCorrectly && believeVotes > 0);
    setPsychologyState(updatedPsychState);
    
    // 🧠 RUPTURA COGNITIVA: Dispara após 3 erros consecutivos
    if (updatedPsychState.consecutiveWrong === 3) {
      setTimeout(async () => {
        const result = await checkAndTriggerCognitiveRupture(
          updatedPsychState.consecutiveWrong,
          displayName,
          () => {
            console.log('[CognitiveRupture] Audio complete, showing cinematic');
          }
        );
        
        if (result.triggered) {
          // Show cinematic event with the phrase
          setCinematicEventType('evento_oculto');
          setCinematicTitle('');
          setCinematicSubtitle(result.phrase);
          setShowCinematicEvent(true);
        }
      }, 1500);
    }
    
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
        
        // Update psychology state for provocation
        const elimState = { 
          ...psychologyState, 
          wasEliminatedByBluff: true, 
          currentRound, 
          currentValue: accumulatedPrize 
        };
        setPsychologyState(elimState);
        
        // Trigger provocation dialogue
        setTimeout(async () => {
          await checkAndTriggerDialogue(
            elimState,
            (phrase, type) => {
              if (type === 'provocacao') {
                setAiTaunt(phrase); // Use the psychology phrase as taunt
              }
            }
          );
        }, 1500);
        
        // Show AI taunt and eliminate
        if (!aiTaunt) {
          setAiTaunt(getRandomTaunt());
        }
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
        
        // Trigger CinematicEvent for Blefe Perfeito!
        setCinematicEventType('blefe_perfeito');
        setCinematicTitle('BLEFE PERFEITO!');
        setCinematicSubtitle('Todos caíram na sua lábia...');
        setCinematicAudioPath('/audio/horus/blefe_perfeito.mp3');
        setShowCinematicEvent(true);
      } else {
        reward = HOST_WRONG_PARTIAL_BLUFF;
        toast({ title: `+${HOST_WRONG_PARTIAL_BLUFF} BluffCoins`, description: 'Blefe parcial!' });
      }
      
      // Show bluff feedback (only if not showing cinematic)
      const unlockingBonusCard = (!hasGuaranteedPrize && believeVotes >= 2) || (!hasImmunityCard && believeVotes >= 3);
      if (!unlockingBonusCard && believeVotes < 3) {
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

    // Check for bonus card unlocks with CinematicEvent
    if (!hasGuaranteedPrize && !playerAnsweredCorrectly && believeVotes >= 2) {
      setHasGuaranteedPrize(true);
      setSafeAmount(roundPrize);
      setNewlyUnlockedCard('guaranteed');
      setTimeout(() => {
        // Show CinematicEvent for Carta Bônus Porto Seguro
        setCinematicEventType('carta_bonus');
        setCinematicCardType('porto_seguro');
        setCinematicTitle('CARTA BÔNUS DESBLOQUEADA!');
        setCinematicSubtitle('Porto Seguro: Você salvou seu prêmio!');
        setCinematicAudioPath(getCartaBonusAudio('porto_seguro'));
        setShowCinematicEvent(true);
      }, 1500);
    }

    if (!hasImmunityCard && !playerAnsweredCorrectly && believeVotes >= 3) {
      setHasImmunityCard(true);
      setNewlyUnlockedCard('immunity');
      const delay = (!hasGuaranteedPrize && believeVotes >= 2) ? 6000 : 1500;
      setTimeout(() => {
        // Show CinematicEvent for Carta Bônus Imunidade
        setCinematicEventType('carta_bonus');
        setCinematicCardType('imunidade');
        setCinematicTitle('CARTA IMUNIDADE DESBLOQUEADA!');
        setCinematicSubtitle('Você ganhou uma segunda chance!');
        setCinematicAudioPath(getCartaBonusAudio('imunidade'));
        setShowCinematicEvent(true);
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
    
    // Check for narrative checkpoint at round 13
    const checkpointChoice = narrativeEngineRef.current.getCheckpointChoice(nextRoundNum, accumulatedPrize);
    if (checkpointChoice) {
      // Show narrative choice modal before proceeding
      setShowNarrativeChoice(true);
      return;
    }
    
    await proceedToNextRound(nextRoundNum);
  };
  
  // Handle narrative choice - player cashes out
  const handleNarrativeChoiceCashOut = async () => {
    setShowNarrativeChoice(false);
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
    
    toast({ title: '🏆 VITÓRIA ESTRATÉGICA!', description: `Você saiu com ${accumulatedPrize.toLocaleString()} BluffCoins!` });
    setGamePhase('victory');
  };
  
  // Handle narrative choice - player continues
  const handleNarrativeChoiceContinue = async () => {
    setShowNarrativeChoice(false);
    
    // Advance NarrativeEngine
    narrativeEngineRef.current.advanceRound(true);
    
    // Play dramatic climax audio
    playHorus2Audio('all_in');
    
    await proceedToNextRound(13);
  };
  
  // Shared logic for proceeding to next round
  const proceedToNextRound = async (nextRoundNum: number) => {
    setCurrentRound(nextRoundNum);
    setPressureRound(nextRoundNum); // Atualizar sistema de pressão
    await selectNextQuestion();
    setNewlyUnlockedCard(null);
    
    // Update NarrativeEngine state
    narrativeEngineRef.current.advanceRound(true);
    
    // Update psychology state with new round
    setPsychologyState(prev => ({
      ...prev,
      currentRound: nextRoundNum,
      currentValue: PRIZE_LADDER[nextRoundNum - 1] || 0,
    }));
    
    // Get pressure config for this round
    const pressureConfig = getPressureConfig(nextRoundNum);
    
    // DIÁLOGOS ALEATÓRIOS DESATIVADOS: Hórus só fala em gatilhos narrativos específicos
    // Áudio de transição também removido para evitar sobreposição
    
    // Start background music after Round 2 completes (beginning of Round 3)
    // This marks the transition to Ato II
    if (nextRoundNum === 3 && !backgroundMusic.getIsPlaying()) {
      backgroundMusic.start('trial');
    }
    
    // Update background music act and pressure for tension evolution
    if (backgroundMusic.getIsPlaying()) {
      backgroundMusic.setAct(narrative.currentAct.id);
      backgroundMusic.setPressure(pressureConfig.pressureLevel);
    }
    
    // Check for bomb event (Evento de Ruptura) - rodadas 6-10
    if (pressureConfig.canBomb) {
      const bombTriggered = checkAndTriggerBomb(nextRoundNum);
      if (bombTriggered) {
        // Flash visual will be handled by PressureEffects component
        toast({
          title: '💥 RUPTURA COGNITIVA',
          description: 'Foco, vendedor. O sistema te testando.',
          variant: 'destructive',
        });
      }
    }
    
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

  // Nickname entry screen - show Shadow Players
  if (gamePhase === 'nickname') {
    const displayPlayers = shadowPlayers.length > 0 ? shadowPlayers : generateShadowPlayers(3);
    const phaseConfig = economy.getPhaseConfig(currentGamePhase);
    const phaseLabel = currentGamePhase === 1 ? 'Aquecimento' : currentGamePhase === 2 ? 'Desafio' : 'Extremo';
    
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LuxuryCard className="w-full max-w-md space-y-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Zap className="w-8 h-8 text-primary" />
            <h2 className="font-orbitron text-2xl text-primary">DESAFIE O HÓRUS</h2>
          </div>
          
          <div className="text-sm text-muted-foreground">
            <span className="text-primary font-orbitron">{phaseLabel}</span> • {phaseConfig?.rounds || 5} Rodadas
          </div>

          {/* Shadow Players display */}
          <div className="flex justify-center gap-4 py-4">
            {displayPlayers.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border/50"
              >
                <span className="text-3xl">{player.avatar}</span>
                <span className="font-orbitron text-xs text-foreground">{player.nickname}</span>
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              </motion.div>
            ))}
          </div>

          <div className="py-3 px-4 rounded-lg bg-primary/10 border border-primary/30">
            <p className="text-sm text-muted-foreground">Jogando como:</p>
            <p className="font-orbitron text-lg text-primary font-bold">{displayName}</p>
            {isGuest && <p className="text-xs text-destructive/80 mt-1">Modo convidado - moedas não serão salvas</p>}
          </div>

          {/* Phase rewards info */}
          {phaseConfig && (
            <div className="py-3 px-4 rounded-lg bg-success/10 border border-success/30">
              <p className="text-sm text-success font-orbitron">
                Prêmio ao vencer: {phaseConfig.bcReward.toLocaleString()} BC
                {phaseConfig.bonusReward > 0 && ` + ${phaseConfig.bonusReward} bônus`}
              </p>
              {phaseConfig.ntCost > 0 && (
                <p className={`text-xs mt-1 ${economy.ntBalance >= phaseConfig.ntCost ? 'text-muted-foreground' : 'text-destructive'}`}>
                  Custo: {phaseConfig.ntCost} NT 
                  {economy.ntBalance < phaseConfig.ntCost && ' (saldo insuficiente)'}
                </p>
              )}
            </div>
          )}

          {/* NT Balance display */}
          <div className="py-2 px-4 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center gap-2">
            <span className="text-primary">⚡</span>
            <span className="text-sm text-primary font-orbitron">{economy.ntBalance} NT disponíveis</span>
          </div>
          
          <GoldButton 
            onClick={startGame} 
            className="w-full" 
            size="lg"
            disabled={phaseConfig && phaseConfig.ntCost > 0 && economy.ntBalance < phaseConfig.ntCost}
          >
            <Play className="w-5 h-5 mr-2" />
            {phaseConfig && phaseConfig.ntCost > 0 && economy.ntBalance < phaseConfig.ntCost 
              ? 'NT INSUFICIENTE' 
              : 'INICIAR DESAFIO'}
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
    <>
      {/* Balance Header */}
      <BalanceHeader
        ntBalance={economy.ntBalance}
        bcBalance={economy.bcBalance}
        score={accumulatedPrize}
        showScore={true}
      />

      {/* Coin Vault Animation */}
      {showCoinVault && (
        <CoinVaultAnimation
          amount={coinVaultAmount}
          onComplete={() => setShowCoinVault(false)}
        />
      )}

      {/* NarrativeEngine: Pressure Effects Overlay */}
      <PressureEffects
        pressureLevel={narrative.pressureLevel}
        enableBeeps={narrative.currentAct.enableBeeps && gamePhase === 'question'}
        enableBomb={narrative.currentAct.enableBombEvent && gamePhase === 'question' && !narrative.state.bombEventTriggered}
      />
      
      {/* Psychology Dialogue Overlay */}
      <AnimatePresence>
        {psychologyPhrase && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md"
          >
            <div className="bg-card/95 backdrop-blur-sm border border-primary/50 rounded-lg px-6 py-4 shadow-lg shadow-primary/20">
              <p className="text-foreground font-orbitron text-sm text-center italic">
                "{psychologyPhrase}"
              </p>
              <p className="text-primary text-xs text-center mt-1">— Hórus</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-screen p-2 md:p-8 pt-12 md:pt-16">
        <div className="max-w-4xl mx-auto space-y-3 md:space-y-6">
        {/* Role Banner */}
        <RoleBanner isHost={true} />

        {/* Header - COMPACTO MOBILE */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="p-1.5 md:p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
              title="Voltar ao Início"
            >
              <Home className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </button>
            <div>
              <h1 className="font-orbitron text-sm md:text-xl text-primary flex items-center gap-1.5 md:gap-2">
                <Zap className="w-4 h-4 md:w-5 md:h-5" />
                DESAFIE O HÓRUS
              </h1>
              <div className="flex items-center gap-1.5 md:gap-2">
                <p className="text-[10px] md:text-xs text-muted-foreground">{displayName}</p>
                {/* NarrativeEngine: Show current act */}
                <NarrativeDisplay
                  currentAct={narrative.currentAct}
                  round={currentRound}
                  silentObserverActive={narrative.state.silentObserverActive}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <BluffCoinDisplay amount={bluffcoins} size="sm" />
            {/* Shadow Player avatars */}
            <div className="flex -space-x-1.5 md:-space-x-2">
              {(shadowPlayers.length > 0 ? shadowPlayers : BOTS).map((player) => (
                <div 
                  key={player.id}
                  className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] md:text-sm"
                  title={player.nickname}
                >
                  {player.avatar}
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
                <div className="space-y-3 md:space-y-6">
                  {/* Pressure Timer */}
                  <div className="flex justify-center">
                    <PressureTimer
                      round={currentRound}
                      isActive={gamePhase === 'question' && !confirmedAnswer}
                      onComplete={() => {
                        // Timeout: forçar confirmação se nenhuma resposta selecionada
                        if (!confirmedAnswer && selectedAnswer) {
                          confirmAnswer();
                        } else if (!confirmedAnswer && !selectedAnswer) {
                          // Sem resposta: selecionar aleatória e confirmar
                          const options: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
                          const randomAnswer = options[Math.floor(Math.random() * options.length)];
                          setSelectedAnswer(randomAnswer);
                          setTimeout(() => {
                            setConfirmedAnswer(randomAnswer);
                            setShowAnswer(true);
                            playReveal();
                            if (currentRound === MAX_ROUNDS) {
                              setTimeout(() => processRound15Results(), 1500);
                            } else {
                              setGamePhase('recording');
                            }
                          }, 100);
                        }
                      }}
                      onTick={(secondsLeft) => {
                        // Verificar evento de bomba entre rodadas 6-10
                        // Dispara apenas uma vez, em momento aleatório
                        if (secondsLeft === Math.floor(getPressureConfig(currentRound).timerDuration * 0.6)) {
                          const triggered = checkAndTriggerBomb(currentRound);
                          if (triggered) {
                            narrative.triggerBomb();
                          }
                        }
                      }}
                    />
                  </div>

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
                  
                  <div className="space-y-2 md:space-y-4">
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
                    <AudioRecorder 
                      roomId="solo-mode"
                      onRecordingComplete={(audioUrl, metrics) => {
                        setVoiceMetrics(metrics);
                        setHasRecordedAudio(true);
                      }}
                    />

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
                      <GoldButton onClick={() => submitAudio(hasRecordedAudio)} className="flex-1">
                        <Brain className="w-5 h-5 mr-2" />
                        ENVIAR PARA A MESA
                      </GoldButton>
                    </div>
                  </div>
                </div>
              )}

              {/* VOTING SIMULATION PHASE - Shadow Players deliberating */}
              {gamePhase === 'voting_simulation' && (
                <LuxuryCard>
                  <VotingSimulation
                    shadowPlayers={shadowPlayers.length > 0 ? shadowPlayers : generateShadowPlayers(3)}
                    onComplete={handleVotingSimulationComplete}
                  />
                </LuxuryCard>
              )}

              {/* VOTE REVEAL PHASE - Dramatic one-by-one reveal */}
              {gamePhase === 'vote_reveal' && (
                <LuxuryCard>
                  <VoteReveal
                    votes={botVotes}
                    shadowPlayers={shadowPlayers.length > 0 ? shadowPlayers : generateShadowPlayers(3)}
                    onComplete={handleVoteRevealComplete}
                    revealIntervalMs={1200}
                  />
                </LuxuryCard>
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
                      ANALISANDO VOTOS DOS JOGADORES...
                    </h3>
                    
                    <p className="text-muted-foreground text-sm">
                      Aguardando decisão da mesa
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

                  {/* Shadow Player voting indicators */}
                  <div className="flex justify-center gap-6">
                    {(shadowPlayers.length > 0 ? shadowPlayers : BOTS).map((player, i) => (
                      <motion.div
                        key={player.id}
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: analyzingProgress > (i + 1) * 30 ? 1 : 0.5 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="text-3xl">{player.avatar}</div>
                        <span className="text-xs text-muted-foreground">{player.nickname}</span>
                        <motion.div
                          animate={{ scale: analyzingProgress > (i + 1) * 30 ? [1, 1.2, 1] : 1 }}
                          transition={{ repeat: Infinity, duration: 0.5 }}
                        >
                          <Zap className={`w-4 h-4 ${analyzingProgress > (i + 1) * 30 ? 'text-primary' : 'text-muted-foreground'}`} />
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

                  {/* Votes display */}
                  <div className="space-y-4">
                    <h3 className="font-orbitron text-lg text-center">Votos dos Jogadores</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {botVotes.map((vote, i) => {
                        const player = shadowPlayers.find(p => p.id === vote.botId) || BOTS.find(b => b.id === vote.botId);
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
                            <span className="text-3xl">{player?.avatar}</span>
                            <p className="font-orbitron text-xs mt-2">{vote.botName}</p>
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
                        🎭 Blefe bem-sucedido! {botVotes.filter(v => v.vote === 'believe').length} jogador(es) acreditaram!
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

            {/* Horus Terminal Toggle Button - Always visible during game */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <GoldButton 
                onClick={() => setShowHorusTerminal(!showHorusTerminal)}
                className="w-full"
                variant={showHorusTerminal ? "primary" : "outline"}
              >
                {showHorusTerminal ? (
                  <><X className="w-4 h-4 mr-2" /> Fechar Terminal Hórus</>
                ) : (
                  <><MessageCircle className="w-4 h-4 mr-2" /> Falar com Hórus</>
                )}
              </GoldButton>
            </motion.div>

            {/* Horus Terminal */}
            <AnimatePresence>
              {showHorusTerminal && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 400 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <HorusTerminal />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
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

      {/* Golden Particles - when player accepts Horus agreement */}
      <GoldenParticles 
        isActive={showGoldenParticles}
        onComplete={() => setShowGoldenParticles(false)}
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
      
      {/* CinematicEvent - Epic moments with black bars */}
      <CinematicEvent
        show={showCinematicEvent}
        type={cinematicEventType}
        title={cinematicTitle}
        subtitle={cinematicSubtitle}
        audioPath={cinematicAudioPath}
        cardType={cinematicCardType}
        duration={cinematicEventType === 'blefe_perfeito' ? 5000 : 4000}
        onComplete={() => setShowCinematicEvent(false)}
      />
      
      {/* Narrative Choice Modal - Checkpoint at round 13 */}
      <NarrativeChoiceModal
        isOpen={showNarrativeChoice}
        playerName={displayName}
        currentBC={accumulatedPrize}
        onCashOut={handleNarrativeChoiceCashOut}
        onContinue={handleNarrativeChoiceContinue}
      />
      </div>
    </>
  );
}
