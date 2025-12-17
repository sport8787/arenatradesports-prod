import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useRankings } from '@/hooks/useRankings';
import { getOrCreateSessionId } from '@/lib/gameUtils';
import { Question } from '@/types/game';
import LuxuryCard from '@/components/game/LuxuryCard';
import GoldButton from '@/components/game/GoldButton';
import PlayerAvatar from '@/components/game/PlayerAvatar';
import QuestionCard from '@/components/game/QuestionCard';
import MycroftPanel from '@/components/game/MycroftPanel';
import VotingPanel from '@/components/game/VotingPanel';
import ResultsPanel from '@/components/game/ResultsPanel';
import Scoreboard from '@/components/game/Scoreboard';
import BluffCoinDisplay, { BluffCoinCost } from '@/components/game/BluffCoinDisplay';
import RoleBanner from '@/components/game/RoleBanner';
import WaitingMessage from '@/components/game/WaitingMessage';
import VoteCounter from '@/components/game/VoteCounter';
import EliminationAnimation from '@/components/game/EliminationAnimation';
import BluffFeedback from '@/components/game/BluffFeedback';
import LieDetectorPanel from '@/components/game/LieDetectorPanel';
import RoundProgress, { PRIZE_LADDER } from '@/components/game/RoundProgress';
import BonusCardUnlock from '@/components/game/BonusCardUnlock';
import CashOutDialog from '@/components/game/CashOutDialog';
import MoneyRain from '@/components/game/MoneyRain';
import ConquestAchievement from '@/components/game/ConquestAchievement';
import CaughtStamp from '@/components/game/CaughtStamp';
import AudioRecorder from '@/components/game/AudioRecorder';
import AudioPlayer from '@/components/game/AudioPlayer';
import ImmunityCardUnlock from '@/components/game/ImmunityCardUnlock';
import ImmunitySavedOverlay from '@/components/game/ImmunitySavedOverlay';
import BonusCardsPanel from '@/components/game/BonusCardsPanel';
import { Input } from '@/components/ui/input';
import { Play, Copy, Check, Bot, Loader2, Volume2, Home, Lock, Unlock, Trophy, Banknote, MessageCircle, Link } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// BluffCoin costs
const MYCROFT_COST = 200;
const DOUBT_COST = 100;
const DETECTOR_COST = 150;

// BluffCoin rewards - Host
const HOST_CORRECT_ANSWER = 100;
const HOST_WRONG_PARTIAL_BLUFF = 200; // At least 1 jury voted CLARO
const HOST_WRONG_FULL_BLUFF = 300;    // All jury voted CLARO

// BluffCoin rewards - Jury
const JURY_CORRECT_READING = 50;

// Game progression constants
const MAX_ROUNDS = 15;
const INITIAL_BLUFFCOINS = 1000;

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
  'Enganar bobo é esporte olímpico? Porque você ganhou Ouro. 🥇',
  'Se candidatar a político, ganha no primeiro turno. 🗳️',
];

export default function GameRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { gameState, loading, updateRoomStatus, submitVote, updateBluffcoins, hasEnoughCoins } = useGameState(roomId || null);
  const { playChips, playSuspense, playFanfare, playReveal, playTick, playTimeUp, playVote, playCoinDrop, playGameOver, playCashRegister, playScanner, playDataBeep, playTyping, playCardUnlock, playShieldActivate, preloadSounds } = useSoundEffects();
  const { getOrCreateRanking, updateRankingStats, myRanking } = useRankings();
  
  const [nickname, setNickname] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showMycroft, setShowMycroft] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set());
  const [hostEliminated, setHostEliminated] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [confirmedAnswer, setConfirmedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mycroftUsed, setMycroftUsed] = useState(false);
  const [detectorUsed, setDetectorUsed] = useState(false);
  const [showDetector, setShowDetector] = useState(false);
  const rankingUpdatedRef = useRef<string | null>(null);
  const coinsUpdatedRef = useRef<string | null>(null);
  const prevVoteCountRef = useRef<number>(0);
  const prevAudioUrlRef = useRef<string | null>(null);
  const [bluffFeedback, setBluffFeedback] = useState<{ phrase: string; description: string } | null>(null);

  // Round progression state
  const [currentRound, setCurrentRound] = useState(0);
  const [accumulatedPrize, setAccumulatedPrize] = useState(0);
  const [hasGuaranteedPrize, setHasGuaranteedPrize] = useState(false);
  const [safeAmount, setSafeAmount] = useState(0);
  const [showBonusUnlock, setShowBonusUnlock] = useState(false);
  const [showCashOutDialog, setShowCashOutDialog] = useState(false);
  const [newlyUnlockedCard, setNewlyUnlockedCard] = useState<'guaranteed' | 'immunity' | null>(null);
  const [showMoneyRain, setShowMoneyRain] = useState(false);
  
  // Immunity card state
  const [hasImmunityCard, setHasImmunityCard] = useState(false);
  const [immunityCardUsed, setImmunityCardUsed] = useState(false);
  const [showImmunityUnlock, setShowImmunityUnlock] = useState(false);
  const [showImmunitySaved, setShowImmunitySaved] = useState(false);
  
  // Succession state
  const [showConquest, setShowConquest] = useState(false);
  const [showCaughtStamp, setShowCaughtStamp] = useState(false);
  const [eliminatedHostName, setEliminatedHostName] = useState('');
  const [successionInProgress, setSuccessionInProgress] = useState(false);

  const sessionId = getOrCreateSessionId();
  const isRoomHost = gameState.room?.host_id === sessionId;
  const isCurrentPlayer = isRoomHost;
  const hasVoted = gameState.votes.some(v => v.player_id === gameState.myPlayer?.id);

  // Preload sounds when component mounts
  useEffect(() => {
    preloadSounds();
  }, [preloadSounds]);

  // Play vote notification sound for host when new votes come in
  useEffect(() => {
    const currentVoteCount = gameState.votes.filter(
      v => v.question_id === gameState.currentQuestion?.id
    ).length;
    
    // Only play sound for host during discussion phase when votes increase
    if (
      isRoomHost && 
      gameState.room?.current_status === 'discussion' &&
      currentVoteCount > prevVoteCountRef.current &&
      prevVoteCountRef.current > 0 // Don't play on initial load
    ) {
      playVote();
    }
    
    prevVoteCountRef.current = currentVoteCount;
  }, [gameState.votes, gameState.currentQuestion?.id, gameState.room?.current_status, isRoomHost, playVote]);

  // Play notification sound for jury when host finishes recording audio
  useEffect(() => {
    const currentAudioUrl = gameState.room?.current_audio_url;
    
    // Play sound only for jury members when audio URL changes from null to a value
    if (
      !isRoomHost && 
      gameState.room?.current_status === 'discussion' &&
      currentAudioUrl && 
      !prevAudioUrlRef.current
    ) {
      playVote();
    }
    
    prevAudioUrlRef.current = currentAudioUrl || null;
  }, [gameState.room?.current_audio_url, gameState.room?.current_status, isRoomHost, playVote]);

  // Handler for auto-reveal when all jurors have voted (called from VoteCounter)
  const handleAllVoted = async () => {
    if (!isRoomHost) return;
    await updateRoomStatus('result');
    setTimeout(() => playChips(), 500);
  };

  // Play sounds on status changes and update rankings
  useEffect(() => {
    const currentStatus = gameState.room?.current_status;

    if (!currentStatus || prevStatus === currentStatus) return;

    if (currentStatus === 'voting' && prevStatus === 'question') {
      playSuspense();
    }

    // Entering results can happen from discussion (auto / manual) OR voting.
    // We must award BluffCoins and update rankings in both cases.
    if (currentStatus === 'result') {
      playReveal();
      setTimeout(() => playFanfare(), 800);

      const questionId = gameState.currentQuestion?.id;
      if (questionId && rankingUpdatedRef.current !== questionId) {
        rankingUpdatedRef.current = questionId;
        updateRankingsForResult();
      }
    }

    setPrevStatus(currentStatus);
  }, [
    gameState.room?.current_status,
    gameState.currentQuestion?.id,
    prevStatus,
    playSuspense,
    playReveal,
    playFanfare,
  ]);

  // Play game over sound when host is eliminated
  useEffect(() => {
    if (hostEliminated) {
      playGameOver();
    }
  }, [hostEliminated, playGameOver]);

  // Update rankings and bluffcoins based on result
  // HOST is responsible for updating ALL players' bluffcoins to avoid race conditions
  const updateRankingsForResult = async () => {
    const questionId = gameState.currentQuestion?.id;
    if (!questionId || coinsUpdatedRef.current === questionId) return;
    coinsUpdatedRef.current = questionId;

    const playerGotCorrect = confirmedAnswer === gameState.currentQuestion?.correct_option;
    
    // Get jury votes
    const juryVotes = gameState.votes;
    const believeVotes = juryVotes.filter(v => v.vote_type === 'believe').length;
    const doubtVotes = juryVotes.filter(v => v.vote_type === 'doubt').length;
    const totalJuryVotes = juryVotes.length;
    
    // Check for host elimination: wrong answer + ALL jury voted BLEFE
    const shouldEliminate = !playerGotCorrect && doubtVotes === totalJuryVotes && totalJuryVotes > 0;
    
    if (shouldEliminate) {
      // Check if immunity card can save the player (not on round 15, and card not used yet)
      if (hasImmunityCard && !immunityCardUsed && currentRound !== MAX_ROUNDS) {
        // Use immunity card - player is saved!
        setImmunityCardUsed(true);
        setShowImmunitySaved(true);
        playShieldActivate(); // Shield activation sound when immunity saves player
        // Don't eliminate - player survives this round
      } else {
        // Check if there are challengers to take over
        const challengers = gameState.players.filter(p => p.session_id !== gameState.room?.host_id);
        
        if (challengers.length > 0) {
          // Show dramatic "PEGO NO PULO!" stamp before succession
          setShowCaughtStamp(true);
          // Succession will be triggered when stamp animation completes
        } else {
          // No challengers - original game over behavior
          setHostEliminated(true);
          if (!hasGuaranteedPrize) {
            setAccumulatedPrize(0);
            toast({ title: 'ELIMINADO!', description: 'Você perdeu todo o prêmio acumulado.', variant: 'destructive' });
          } else if (safeAmount > 0) {
            setAccumulatedPrize(safeAmount);
            toast({ title: 'ELIMINADO!', description: `Carta Bônus ativada! Você salvou ${safeAmount.toLocaleString()} BluffCoins.` });
          }
        }
      }
    } else if (playerGotCorrect || believeVotes > 0) {
      // Round won - accumulate prize (if not eliminated)
      if (currentRound > 0 && currentRound <= MAX_ROUNDS) {
        const roundPrize = PRIZE_LADDER[currentRound - 1];
        const newAccumulated = accumulatedPrize + roundPrize;
        setAccumulatedPrize(newAccumulated);
        
        // Unlock Guaranteed Prize card if host convinced 2+ jury members to vote CLARO
        if (!hasGuaranteedPrize && !playerGotCorrect && believeVotes >= 2) {
          console.log('[BonusCard] Unlocking Guaranteed Prize card - believeVotes:', believeVotes);
          setHasGuaranteedPrize(true);
          setSafeAmount(newAccumulated);
          setNewlyUnlockedCard('guaranteed');
          // Delay showing the unlock animation slightly so results panel shows first
          setTimeout(() => {
            setShowBonusUnlock(true);
            playCardUnlock();
          }, 1500);
        }
        
        // Unlock Immunity card if host convinced 3+ jury members to vote CLARO
        if (!hasImmunityCard && !playerGotCorrect && believeVotes >= 3) {
          console.log('[BonusCard] Unlocking Immunity card - believeVotes:', believeVotes);
          setHasImmunityCard(true);
          setNewlyUnlockedCard('immunity');
          // Show immunity unlock after bonus unlock (if both trigger) or immediately
          const delay = (!hasGuaranteedPrize && believeVotes >= 2) ? 5000 : 1500;
          setTimeout(() => {
            setShowImmunityUnlock(true);
            playShieldActivate();
          }, delay);
        }
        
        // Check if game completed (all 15 rounds)
        if (currentRound === MAX_ROUNDS) {
          setGameCompleted(true);
          playFanfare();
          toast({ title: '🏆 VITÓRIA TOTAL!', description: `Você conquistou ${newAccumulated.toLocaleString()} BluffCoins!` });
        }
      }
    }
    
    // Only the HOST updates all bluffcoins and detective scores to avoid race conditions
    if (isCurrentPlayer) {
      const hostPlayer = gameState.players.find(p => p.session_id === gameState.room?.host_id);
      
      if (hostPlayer) {
        // HOST REWARDS
        if (playerGotCorrect) {
          await updateBluffcoins(hostPlayer.id, HOST_CORRECT_ANSWER);
        }
        
        // Bluff rewards (only for WRONG answers where jury believed)
        if (!playerGotCorrect && believeVotes > 0) {
          if (believeVotes === totalJuryVotes && totalJuryVotes > 0) {
            await updateBluffcoins(hostPlayer.id, HOST_WRONG_FULL_BLUFF);
          } else {
            await updateBluffcoins(hostPlayer.id, HOST_WRONG_PARTIAL_BLUFF);
          }
        }
      }
      
      // JURY REWARDS + DETECTIVE SCORE UPDATES - Host updates all jury members
      for (const vote of juryVotes) {
        const correctReading = 
          (!playerGotCorrect && vote.vote_type === 'doubt') || 
          (playerGotCorrect && vote.vote_type === 'believe');
        
        if (correctReading) {
          await updateBluffcoins(vote.player_id, JURY_CORRECT_READING);
          
          // Update detective score for correct reading (+1 point)
          const juryPlayer = gameState.players.find(p => p.id === vote.player_id);
          if (juryPlayer) {
            await supabase
              .from('players')
              .update({ detective_score: (juryPlayer.detective_score || 0) + 1 })
              .eq('id', vote.player_id);
          }
        }
      }
    }
    
    // Each player updates their own rankings and shows toasts (local to their session)
    if (gameState.myPlayer && myRanking) {
      const myVote = gameState.votes.find(v => v.player_id === gameState.myPlayer?.id);
      
      if (isCurrentPlayer) {
        // Host ranking updates and toasts - points match BluffCoins earned
        if (playerGotCorrect) {
          await updateRankingStats({ addPoints: HOST_CORRECT_ANSWER });
          toast({ title: `+${HOST_CORRECT_ANSWER} BluffCoins`, description: 'Resposta correta!' });
        }
        if (!playerGotCorrect && believeVotes > 0) {
          // Check if a bonus card is being unlocked - if so, skip bluff feedback
          const unlockingBonusCard = 
            (!hasGuaranteedPrize && believeVotes >= 2) || 
            (!hasImmunityCard && believeVotes >= 3);
          
          // Only show bluff feedback if NO bonus card is being unlocked
          if (!unlockingBonusCard) {
            const randomPhrase = BLUFF_PHRASES[Math.floor(Math.random() * BLUFF_PHRASES.length)];
            const description = believeVotes === totalJuryVotes ? 'Blefe PERFEITO!' : `${believeVotes} caíram no blefe!`;
            
            setTimeout(() => {
              playCashRegister();
              setBluffFeedback({ phrase: randomPhrase, description });
              // Auto-hide after 3 seconds
              setTimeout(() => setBluffFeedback(null), 3000);
            }, 1200);
          }
          
          if (believeVotes === totalJuryVotes && totalJuryVotes > 0) {
            await updateRankingStats({ addPoints: HOST_WRONG_FULL_BLUFF, addSuccessfulBluff: true });
            toast({ title: `+${HOST_WRONG_FULL_BLUFF} BluffCoins`, description: 'Blefe perfeito! Todos acreditaram!' });
          } else {
            await updateRankingStats({ addPoints: HOST_WRONG_PARTIAL_BLUFF, addSuccessfulBluff: true });
            toast({ title: `+${HOST_WRONG_PARTIAL_BLUFF} BluffCoins`, description: 'Blefe parcial!' });
          }
        }
      } else if (myVote) {
        // Jury ranking updates and toasts - points match BluffCoins earned
        const correctReading = 
          (!playerGotCorrect && myVote.vote_type === 'doubt') || 
          (playerGotCorrect && myVote.vote_type === 'believe');
        
        if (correctReading) {
          await updateRankingStats({
            addPoints: JURY_CORRECT_READING,
            addBluffDetected: myVote.vote_type === 'doubt',
          });
          toast({ title: `+${JURY_CORRECT_READING} BluffCoins`, description: 'Leitura correta!' });
        } else {
          await updateRankingStats({ addTimesFooled: true });
        }
      }
    }
  };

  // SUCCESSION PROTOCOL - King of the Hill
  const handleSuccession = async () => {
    if (!roomId || successionInProgress) return;
    setSuccessionInProgress(true);

    const currentHost = gameState.players.find(p => p.session_id === gameState.room?.host_id);
    const challengers = gameState.players.filter(p => p.session_id !== gameState.room?.host_id);
    
    if (challengers.length === 0 || !currentHost) {
      setHostEliminated(true);
      setSuccessionInProgress(false);
      return;
    }

    // Find best challenger: highest detective_score, tiebreak by earliest vote (fastest response)
    const sortedChallengers = [...challengers].sort((a, b) => {
      const scoreA = a.detective_score || 0;
      const scoreB = b.detective_score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Tiebreak: earliest created_at (first to join = fastest responder assumption)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const newHost = sortedChallengers[0];
    const eliminatedName = currentHost.nickname;

    // Store eliminated host name for conquest popup
    setEliminatedHostName(eliminatedName);

    // Toast for everyone: succession announcement
    toast({ 
      title: '👑 SUCESSÃO!', 
      description: `${eliminatedName} foi eliminado! ${newHost.nickname} assumiu a maleta.` 
    });

    // Update room host_id
    await supabase
      .from('rooms')
      .update({ host_id: newHost.session_id })
      .eq('id', roomId);

    // Update player is_host flags
    await supabase
      .from('players')
      .update({ is_host: false })
      .eq('id', currentHost.id);

    await supabase
      .from('players')
      .update({ is_host: true, bluffcoins: INITIAL_BLUFFCOINS })
      .eq('id', newHost.id);

    // Reset detective scores for new round
    await supabase
      .from('players')
      .update({ detective_score: 0 })
      .eq('room_id', roomId);

    // Reset game state for new host
    setCurrentRound(0);
    setAccumulatedPrize(0);
    setHasGuaranteedPrize(false);
    setSafeAmount(0);
    setHasImmunityCard(false);
    setImmunityCardUsed(false);
    setSelectedAnswer(null);
    setConfirmedAnswer(null);
    setShowAnswer(false);
    setMycroftUsed(false);
    setDetectorUsed(false);
    setHostEliminated(false);

    // Show conquest achievement to new host
    if (newHost.session_id === sessionId) {
      setShowConquest(true);
    }

    // Play fanfare for the new host
    playFanfare();
    
    setSuccessionInProgress(false);

    // Return to lobby to start fresh round
    await supabase
      .from('rooms')
      .update({ current_status: 'lobby', current_question_id: null })
      .eq('id', roomId);
  };

  // Monitor host bluffcoins for succession trigger
  useEffect(() => {
    if (!gameState.room || !isRoomHost || successionInProgress) return;
    
    const hostPlayer = gameState.players.find(p => p.session_id === gameState.room?.host_id);
    if (hostPlayer && hostPlayer.bluffcoins <= 0) {
      const challengers = gameState.players.filter(p => p.session_id !== gameState.room?.host_id);
      if (challengers.length > 0) {
        handleSuccession();
      } else {
        setHostEliminated(true);
        toast({ title: 'ELIMINADO!', description: 'Saldo zerado! Fim de jogo.', variant: 'destructive' });
      }
    }
  }, [gameState.players, gameState.room?.host_id, isRoomHost, successionInProgress]);

  useEffect(() => {
    supabase.from('questions').select('*').then(({ data }) => {
      if (data) setQuestions(data as Question[]);
    });
  }, []);

  const joinAsPlayer = async () => {
    if (!nickname || !roomId) return;

    const isHostForThisRoom = gameState.room?.host_id === sessionId;

    // Create/update ranking entry
    await getOrCreateRanking(nickname);

    await supabase.from('players').insert({
      room_id: roomId,
      nickname,
      session_id: sessionId,
      is_host: !!isHostForThisRoom,
    });
  };

  const copyPin = () => {
    navigator.clipboard.writeText(gameState.room?.pin || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const pin = gameState.room?.pin || '';
    const message = `🎯 Vem pro O BLEFADOR MILIONÁRIO!\n\n📌 PIN da sala: ${pin}\n\n🔗 Entre pelo app: ${window.location.origin}\n\nAnalise, deduza e conquiste! 💰`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
    toast({ title: 'Link copiado!' });
  };

  const startGame = async () => {
    if (!roomId || questions.length === 0) return;
    if (!isRoomHost) return;

    // Reset game progression state
    setCurrentRound(1);
    setAccumulatedPrize(0);
    setGameCompleted(false);
    setHostEliminated(false);

    // Select random question that hasn't been used
    const availableQuestions = questions.filter(q => !usedQuestionIds.has(q.id));
    if (availableQuestions.length === 0) {
      // Reset if all questions used
      setUsedQuestionIds(new Set());
      return startGame();
    }
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const q = availableQuestions[randomIndex];
    setUsedQuestionIds(prev => new Set([...prev, q.id]));

    const hostIndex = Math.max(
      0,
      gameState.players.findIndex((p) => p.session_id === gameState.room?.host_id)
    );

    await supabase
      .from('rooms')
      .update({
        current_status: 'question',
        current_question_id: q.id,
        current_player_index: hostIndex,
        current_audio_url: null, // Clear any previous audio
      })
      .eq('id', roomId);
  };

  const goToVoting = async () => {
    if (!isRoomHost) return;
    // From discussion, go to voting (transition state before results)
    await updateRoomStatus('voting');
  };

  const goToResults = async () => {
    await updateRoomStatus('result');
    setTimeout(() => playChips(), 500);
  };

  const confirmAnswer = async () => {
    if (!isRoomHost) return;
    if (!selectedAnswer) return;
    setConfirmedAnswer(selectedAnswer);
    setShowAnswer(true);
    playReveal();
    // Update room status to discussion so jury can vote
    await updateRoomStatus('discussion');
  };

  const activateMycroft = async () => {
    if (!gameState.myPlayer || !hasEnoughCoins(MYCROFT_COST)) {
      toast({ title: 'BluffCoins insuficientes', variant: 'destructive' });
      return;
    }
    await updateBluffcoins(gameState.myPlayer.id, -MYCROFT_COST);
    setMycroftUsed(true);
    setShowMycroft(true);
    playChips();
  };

  const handleVoteWithCost = async (voteType: 'believe' | 'doubt') => {
    console.log('handleVoteWithCost called:', voteType);
    
    if (voteType === 'doubt') {
      if (!gameState.myPlayer || !hasEnoughCoins(DOUBT_COST)) {
        toast({ title: 'BluffCoins insuficientes para duvidar', variant: 'destructive' });
        return;
      }
      const success = await updateBluffcoins(gameState.myPlayer.id, -DOUBT_COST);
      if (!success) {
        toast({ title: 'Erro ao processar BluffCoins', variant: 'destructive' });
        return;
      }
    }
    
    const voteSuccess = await submitVote(voteType);
    if (voteSuccess) {
      playReveal();
      toast({ title: voteType === 'believe' ? 'Você votou: CLARO' : 'Você votou: BLEFE' });
    } else {
      toast({ title: 'Erro ao registrar voto', variant: 'destructive' });
    }
  };
  
  const showResults = async () => {
    if (!isRoomHost) return;
    await updateRoomStatus('result');
    // Play chips sound when showing results (someone scored)
    setTimeout(() => playChips(), 500);
  };

  const handleTimerTick = (secondsLeft: number) => {
    if (secondsLeft <= 5 && secondsLeft > 0) {
      playTick();
    }
  };

  const handleTimerComplete = () => {
    playTimeUp();
    // Auto-reveal results if host
    if (isRoomHost) {
      setTimeout(() => showResults(), 1000);
    }
  };

  const nextQuestion = async () => {
    if (!roomId) return;
    if (!isRoomHost) return;
    if (gameCompleted) return;

    // Check if max rounds reached
    if (currentRound >= MAX_ROUNDS) {
      setGameCompleted(true);
      return;
    }

    // Increment round
    setCurrentRound(prev => prev + 1);

    // Select random question that hasn't been used
    const availableQuestions = questions.filter(q => !usedQuestionIds.has(q.id));
    if (availableQuestions.length === 0) {
      // Reset if all questions used
      setUsedQuestionIds(new Set());
    }
    const questionsToUse = availableQuestions.length > 0 ? availableQuestions : questions;
    const randomIndex = Math.floor(Math.random() * questionsToUse.length);
    const nextQ = questionsToUse[randomIndex];
    setUsedQuestionIds(prev => new Set([...prev, nextQ.id]));

    // Reset answer states for next question
    setSelectedAnswer(null);
    setConfirmedAnswer(null);
    setShowAnswer(false);
    setMycroftUsed(false);
    setDetectorUsed(false);
    setNewlyUnlockedCard(null);
    prevVoteCountRef.current = 0; // Reset vote counter for sound notification

    const hostIndex = Math.max(
      0,
      gameState.players.findIndex((p) => p.session_id === gameState.room?.host_id)
    );

    await supabase
      .from('rooms')
      .update({
        current_status: 'question',
        current_question_id: nextQ?.id,
        current_player_index: hostIndex,
        current_audio_url: null, // Clear previous audio for new question
      })
      .eq('id', roomId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  // Not joined yet
  if (!gameState.myPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <LuxuryCard className="w-full max-w-md space-y-6 text-center">
          <h2 className="font-orbitron text-2xl text-primary">Entrar na Mesa</h2>
          <div className="pin-display">{gameState.room?.pin}</div>
          <Input
            placeholder="Seu Nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={15}
            className="bg-secondary border-border"
          />
          <GoldButton onClick={joinAsPlayer} className="w-full" size="lg">
            Entrar
          </GoldButton>
        </LuxuryCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Role Banner */}
        <RoleBanner isHost={isRoomHost} />

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
              <h1 className="font-orbitron text-xl text-primary">O BLEFADOR</h1>
              <button onClick={copyPin} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <span className="font-orbitron text-sm">PIN: {gameState.room?.pin}</span>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* BluffCoins Display */}
            <BluffCoinDisplay amount={gameState.myPlayer?.bluffcoins || 0} size="md" />
            <Volume2 className="w-5 h-5 text-mycroft-green animate-pulse" />
            <div className="flex -space-x-2">
              {gameState.players.slice(0, 4).map((p, i) => (
                <PlayerAvatar key={p.id} player={p} index={i} size="sm" showScore={false} />
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="md:col-span-2">
            <LuxuryCard>
              {/* LOBBY */}
              {gameState.room?.current_status === 'lobby' && (
                <div className="space-y-6 text-center">
                  <h2 className="font-orbitron text-2xl">Sala de Espera</h2>
                  <div className="flex flex-wrap justify-center gap-4">
                    {gameState.players.map((p, i) => (
                      <PlayerAvatar key={p.id} player={p} index={i} />
                    ))}
                  </div>
                  {isRoomHost && gameState.players.length >= 2 && (
                    <GoldButton onClick={startGame} size="lg">
                      <Play className="w-5 h-5 mr-2 inline" /> Iniciar Jogo
                    </GoldButton>
                  )}
                  {gameState.players.length < 2 && (
                    <p className="text-muted-foreground">Aguardando jogadores...</p>
                  )}
                  
                  {/* Share Buttons */}
                  {isRoomHost && (
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                      <GoldButton 
                        variant="outline" 
                        onClick={shareWhatsApp}
                        className="bg-[#25D366]/20 border-[#25D366]/50 hover:bg-[#25D366]/30 hover:border-[#25D366]"
                      >
                        <MessageCircle className="w-5 h-5 mr-2 inline text-[#25D366]" />
                        Convidar pelo WhatsApp
                      </GoldButton>
                      <GoldButton 
                        variant="outline" 
                        onClick={copyRoomLink}
                      >
                        {linkCopied ? (
                          <>
                            <Check className="w-5 h-5 mr-2 inline text-success" />
                            Link Copiado!
                          </>
                        ) : (
                          <>
                            <Link className="w-5 h-5 mr-2 inline" />
                            Copiar Link da Sala
                          </>
                        )}
                      </GoldButton>
                    </div>
                  )}
                </div>
              )}

              {/* QUESTION */}
              {gameState.room?.current_status === 'question' && gameState.currentQuestion && (
                <div className="space-y-6">
                  <QuestionCard
                    question={gameState.currentQuestion}
                    showCorrectAnswer={showAnswer}
                    selectedOption={selectedAnswer || undefined}
                    onSelectOption={isCurrentPlayer ? setSelectedAnswer : undefined}
                    confirmedAnswer={confirmedAnswer || undefined}
                    disabled={!isCurrentPlayer}
                  />
                  
                  {isCurrentPlayer && (
                    <div className="space-y-4">
                      {/* Reveal Answer Button */}
                      <GoldButton 
                        onClick={confirmAnswer} 
                        disabled={!selectedAnswer || !!confirmedAnswer}
                        className="w-full"
                        size="lg"
                      >
                        {confirmedAnswer ? (
                          <>
                            <Unlock className="w-5 h-5 mr-2 inline" /> Resposta Revelada
                          </>
                        ) : selectedAnswer ? (
                          <>
                            <Unlock className="w-5 h-5 mr-2 inline" /> Confirmar e Revelar Resposta
                          </>
                        ) : (
                          <>
                            <Lock className="w-5 h-5 mr-2 inline" /> Selecione uma Resposta
                          </>
                        )}
                      </GoldButton>

                      {/* Actions after reveal */}
                      {confirmedAnswer && (
                        <div className="flex gap-4">
                          <GoldButton 
                            variant="outline" 
                            onClick={activateMycroft} 
                            className="flex-1"
                            disabled={mycroftUsed || !hasEnoughCoins(MYCROFT_COST)}
                          >
                            <Bot className="w-5 h-5 mr-2 inline" /> 
                            {mycroftUsed ? 'Mycroft Ativado' : (
                              <>Mycroft <BluffCoinCost amount={MYCROFT_COST} /></>
                            )}
                          </GoldButton>
                          <GoldButton onClick={goToVoting} className="flex-1">
                            Ir para Votação
                          </GoldButton>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!isCurrentPlayer && (
                    <WaitingMessage type="answer" />
                  )}
                </div>
              )}

              {/* DISCUSSION - Jury votes while player can use Mycroft */}
              {gameState.room?.current_status === 'discussion' && gameState.currentQuestion && (
                <div className="space-y-6">
                  {isCurrentPlayer ? (
                    <>
                      <QuestionCard
                        question={gameState.currentQuestion}
                        showCorrectAnswer={true}
                        selectedOption={confirmedAnswer || selectedAnswer || undefined}
                        confirmedAnswer={confirmedAnswer || selectedAnswer || undefined}
                        disabled={true}
                      />
                      <div className="space-y-4">
                        {/* Audio recorder for host */}
                        <AudioRecorder 
                          roomId={roomId || ''} 
                          disabled={false}
                        />
                        
                        {/* Vote counter for host */}
                        <VoteCounter 
                          totalJurors={gameState.players.filter(p => p.session_id !== gameState.room?.host_id).length}
                          votesReceived={gameState.votes.filter(v => v.question_id === gameState.currentQuestion?.id).length}
                          onAllVoted={handleAllVoted}
                          countdownSeconds={3}
                        />
                        <div className="flex gap-4">
                          <GoldButton 
                            variant="outline" 
                            onClick={activateMycroft} 
                            className="flex-1"
                            disabled={mycroftUsed || !hasEnoughCoins(MYCROFT_COST)}
                          >
                            <Bot className="w-5 h-5 mr-2 inline" /> 
                            {mycroftUsed ? 'Mycroft Ativado' : (
                              <>Mycroft <BluffCoinCost amount={MYCROFT_COST} /></>
                            )}
                          </GoldButton>
                          <GoldButton onClick={showResults} className="flex-1">
                            Ver Resultado
                          </GoldButton>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <QuestionCard
                        question={gameState.currentQuestion}
                        showCorrectAnswer={false}
                        disabled={true}
                      />
                      
                      {/* Waiting for host to record audio */}
                      {!gameState.room?.current_audio_url ? (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-6 bg-card/50 border border-border/30 rounded-xl text-center space-y-4"
                        >
                          <div className="flex items-center justify-center gap-3">
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                              className="w-3 h-3 bg-gold rounded-full"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }}
                              className="w-3 h-3 bg-gold rounded-full"
                            />
                            <motion.div
                              animate={{ scale: [1, 1.2, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }}
                              className="w-3 h-3 bg-gold rounded-full"
                            />
                          </div>
                          <div>
                            <p className="font-orbitron text-gold text-lg">🎙️ HOST GRAVANDO...</p>
                            <p className="text-muted-foreground text-sm mt-2">
                              Aguarde {gameState.currentPlayer?.nickname || 'o host'} gravar sua justificativa
                            </p>
                          </div>
                        </motion.div>
                      ) : (
                        <>
                          {/* Audio player for jury to hear host's justification */}
                          <AudioPlayer 
                            audioUrl={gameState.room?.current_audio_url || null}
                            hostName={gameState.currentPlayer?.nickname}
                            autoPlay={true}
                          />
                          {gameState.currentQuestion.mycroft_risk_level && (
                            <MycroftPanel question={gameState.currentQuestion} variant="analytics" isVisible />
                          )}
                          <VotingPanel
                            onVote={handleVoteWithCost}
                            hasVoted={hasVoted}
                            votedFor={gameState.votes.find(v => v.player_id === gameState.myPlayer?.id)?.vote_type as 'believe' | 'doubt' | undefined}
                            onTimerTick={handleTimerTick}
                            onTimerComplete={handleTimerComplete}
                            timerActive={!hasVoted}
                            doubtCost={DOUBT_COST}
                            canAffordDoubt={hasEnoughCoins(DOUBT_COST)}
                            onDetectorClick={() => setShowDetector(true)}
                            detectorCost={DETECTOR_COST}
                            canAffordDetector={hasEnoughCoins(DETECTOR_COST)}
                            hasUsedDetector={detectorUsed}
                          />
                        </>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* VOTING - Waiting for results */}
              {gameState.room?.current_status === 'voting' && gameState.currentQuestion && (
                <div className="space-y-6">
                  <QuestionCard
                    question={gameState.currentQuestion}
                    showCorrectAnswer={true}
                    selectedOption={selectedAnswer || undefined}
                    confirmedAnswer={confirmedAnswer || undefined}
                    disabled={true}
                  />
                  {isRoomHost ? (
                    <div className="text-center py-8">
                      <h3 className="font-orbitron text-xl mb-2">Votação Encerrada</h3>
                      <p className="text-muted-foreground mb-4">Os votos foram computados</p>
                      <GoldButton onClick={showResults}>
                        Revelar Resultado
                      </GoldButton>
                    </div>
                  ) : (
                    <WaitingMessage type="result" />
                  )}
                </div>
              )}

              {/* RESULT */}
              {gameState.room?.current_status === 'result' && gameState.currentQuestion && gameState.currentPlayer && (
                <div className="space-y-6">
                  <ResultsPanel
                    question={gameState.currentQuestion}
                    currentPlayer={gameState.currentPlayer}
                    players={gameState.players}
                    votes={gameState.votes}
                    wasBluffSuccessful={confirmedAnswer !== gameState.currentQuestion?.correct_option && gameState.votes.filter(v => v.vote_type === 'believe').length > 0}
                    confirmedAnswer={confirmedAnswer}
                    onCoinSound={playCoinDrop}
                    showCoinAnimation={!hostEliminated}
                    unlockedCard={newlyUnlockedCard}
                  />
                  
                  {hostEliminated && gameState.currentPlayer ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-6 p-8 bg-gradient-to-b from-destructive/20 via-destructive/10 to-background border-2 border-destructive/50 rounded-xl relative overflow-hidden"
                    >
                      {/* Dramatic background effect */}
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--destructive)/0.3)_0%,_transparent_70%)]" />
                      
                      <EliminationAnimation player={gameState.currentPlayer} />
                      
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 2.5 }}
                        className="relative z-10 space-y-4"
                      >
                        <p className="text-center text-muted-foreground">
                          O host errou a resposta e todos os jurados votaram BLEFE.
                        </p>
                        <p className="text-center text-2xl font-orbitron font-bold text-destructive tracking-widest">
                          FIM DE JOGO
                        </p>
                        
                        <div className="flex flex-col gap-3 pt-4">
                          <GoldButton 
                            onClick={() => {
                              navigate('/');
                              setTimeout(() => {
                                window.location.reload();
                              }, 100);
                            }} 
                            className="w-full" 
                            size="lg"
                          >
                            <Play className="w-5 h-5 mr-2" />
                            INICIAR NOVA PARTIDA
                          </GoldButton>
                          <GoldButton 
                            variant="outline" 
                            onClick={() => navigate('/')} 
                            className="w-full"
                          >
                            <Home className="w-5 h-5 mr-2" />
                            Voltar ao Início
                          </GoldButton>
                        </div>
                      </motion.div>
                    </motion.div>
                  ) : gameCompleted ? (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6 p-8 bg-gradient-to-b from-gold/20 via-gold/10 to-background border-2 border-gold/50 rounded-xl relative overflow-hidden"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(var(--gold)/0.3)_0%,_transparent_70%)]" />
                      
                      <div className="relative z-10 text-center space-y-4">
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', duration: 1 }}
                        >
                          <Trophy className="w-20 h-20 mx-auto text-gold" />
                        </motion.div>
                        
                        <h3 className="font-orbitron text-3xl text-gold font-bold">
                          VITÓRIA TOTAL!
                        </h3>
                        <p className="text-muted-foreground">
                          Você completou todas as 15 rodadas!
                        </p>
                        <div className="bg-gold/20 rounded-lg p-4 border border-gold/30">
                          <p className="text-sm text-muted-foreground">Prêmio Total</p>
                          <p className="font-orbitron text-4xl text-gold font-bold">
                            {accumulatedPrize.toLocaleString()}
                          </p>
                          <p className="text-xs text-gold/70">BluffCoins</p>
                        </div>
                        
                        <div className="flex flex-col gap-3 pt-4">
                          <GoldButton 
                            onClick={() => {
                              navigate('/');
                              setTimeout(() => window.location.reload(), 100);
                            }} 
                            className="w-full" 
                            size="lg"
                          >
                            <Play className="w-5 h-5 mr-2" />
                            JOGAR NOVAMENTE
                          </GoldButton>
                          <GoldButton 
                            variant="outline" 
                            onClick={() => navigate('/mercado-negro')} 
                            className="w-full"
                          >
                            Ver Mercado Negro
                          </GoldButton>
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      {isRoomHost ? (
                        <div className="space-y-3">
                          <GoldButton onClick={nextQuestion} className="w-full" size="lg">
                            {currentRound < MAX_ROUNDS ? `Rodada ${currentRound + 1} de ${MAX_ROUNDS}` : 'Ver Resultado Final'}
                          </GoldButton>
                          
                          {/* Cash Out Button - only enabled after CARTA BÔNUS PRÊMIO GARANTIDO */}
                          {accumulatedPrize > 0 && currentRound < MAX_ROUNDS && (
                            <div className="relative group">
                              <button
                                onClick={() => hasGuaranteedPrize && setShowCashOutDialog(true)}
                                disabled={!hasGuaranteedPrize}
                                className={`w-full py-3 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                                  hasGuaranteedPrize 
                                    ? 'bg-green-600/20 hover:bg-green-600/30 border border-green-500/40 text-green-400 cursor-pointer' 
                                    : 'bg-muted/20 border border-border/30 text-muted-foreground cursor-not-allowed'
                                }`}
                              >
                                <Banknote className="w-5 h-5" />
                                Cash Out ({accumulatedPrize.toLocaleString()} BC)
                                {!hasGuaranteedPrize && <Lock className="w-4 h-4 ml-1" />}
                              </button>
                              
                              {/* Tooltip explaining unlock conditions */}
                              {!hasGuaranteedPrize && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-popover border border-border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                                  <p className="text-xs font-semibold text-foreground mb-2">Como desbloquear:</p>
                                  <div className="space-y-2 text-[11px] text-muted-foreground">
                                    <div className="flex items-start gap-2">
                                      <span className="text-gold">🏆</span>
                                      <div>
                                        <span className="font-medium text-gold">Carta Prêmio Garantido:</span>
                                        <p>Convença 2+ jurados a votar CLARO quando errar</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <span className="text-cyan-400">🛡️</span>
                                      <div>
                                        <span className="font-medium text-cyan-400">Carta Imunidade:</span>
                                        <p>Convença 3+ jurados a votar CLARO quando errar</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full">
                                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-border" />
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <WaitingMessage type="nextRound" />
                      )}
                    </>
                  )}
                </div>
              )}
            </LuxuryCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Round Progress - Show when game is active */}
            {currentRound > 0 && (
              <RoundProgress
                currentRound={currentRound}
                accumulatedPrize={accumulatedPrize}
                hasGuaranteedPrize={hasGuaranteedPrize}
                safeAmount={safeAmount}
                isHost={isRoomHost}
                hasImmunityCard={hasImmunityCard}
                immunityCardUsed={immunityCardUsed}
              />
            )}
            
            {/* Bonus Cards Panel - Show when game is active */}
            {currentRound > 0 && (
              <BonusCardsPanel
                hasGuaranteedPrize={hasGuaranteedPrize}
                safeAmount={safeAmount}
                hasImmunityCard={hasImmunityCard}
                immunityCardUsed={immunityCardUsed}
              />
            )}
            
            <Scoreboard
              players={gameState.players} 
              currentPlayerId={gameState.currentPlayer?.id}
              hostSessionId={gameState.room?.host_id}
            />
          </div>
        </div>
      </div>

      {/* Mycroft Overlay */}
      {gameState.currentQuestion && (
        <MycroftPanel
          question={gameState.currentQuestion}
          variant="bluff"
          isVisible={showMycroft}
          onClose={() => setShowMycroft(false)}
        />
      )}
      
      {/* Bluff Feedback Overlay */}
      <BluffFeedback
        phrase={bluffFeedback?.phrase || ''}
        description={bluffFeedback?.description || ''}
        visible={!!bluffFeedback}
      />

      {/* Lie Detector Overlay */}
      {gameState.currentQuestion && (
        <LieDetectorPanel
          question={gameState.currentQuestion}
          isVisible={showDetector}
          onClose={() => setShowDetector(false)}
          onActivate={async () => {
            if (gameState.myPlayer && hasEnoughCoins(DETECTOR_COST)) {
              await updateBluffcoins(gameState.myPlayer.id, -DETECTOR_COST);
              setDetectorUsed(true);
              playChips();
            }
          }}
          onPlayScanner={playScanner}
          onPlayDataBeep={playDataBeep}
          onPlayTyping={playTyping}
          cost={DETECTOR_COST}
          canAfford={hasEnoughCoins(DETECTOR_COST)}
          hasUsed={detectorUsed}
        />
      )}

      {/* Bonus Card Unlock Animation */}
      <BonusCardUnlock
        show={showBonusUnlock}
        safeAmount={safeAmount}
        onComplete={() => setShowBonusUnlock(false)}
      />

      {/* Cash Out Dialog */}
      <CashOutDialog
        show={showCashOutDialog}
        currentRound={currentRound}
        maxRounds={MAX_ROUNDS}
        accumulatedPrize={accumulatedPrize}
        potentialPrize={PRIZE_LADDER.reduce((a, b) => a + b, 0)}
        onConfirm={async () => {
          setShowCashOutDialog(false);
          setShowMoneyRain(true);
          // Update ranking with cash out prize - ensure ranking exists first
          const playerNickname = gameState?.players?.find(p => p.session_id === getOrCreateSessionId())?.nickname || 'Jogador';
          let ranking = myRanking;
          if (!ranking) {
            ranking = await getOrCreateRanking(playerNickname);
          }
          if (ranking) {
            await updateRankingStats({ addPoints: accumulatedPrize, addGame: true }, ranking);
          }
          playChips();
        }}
        onCancel={() => setShowCashOutDialog(false)}
      />

      {/* Money Rain Animation */}
      <MoneyRain
        show={showMoneyRain}
        amount={accumulatedPrize}
        onComplete={() => {
          setShowMoneyRain(false);
          setGameCompleted(true);
          toast({ 
            title: '💰 CASH OUT!', 
            description: `Você saiu com ${accumulatedPrize.toLocaleString()} BluffCoins!` 
          });
        }}
      />

      {/* Caught Stamp - "PEGO NO PULO!" before succession */}
      <CaughtStamp
        show={showCaughtStamp}
        onComplete={() => {
          setShowCaughtStamp(false);
          handleSuccession();
        }}
      />

      {/* Conquest Achievement - King of the Hill */}
      <ConquestAchievement
        show={showConquest}
        eliminatedHostName={eliminatedHostName}
        onComplete={() => setShowConquest(false)}
      />

      {/* Immunity Card Unlock */}
      <ImmunityCardUnlock
        show={showImmunityUnlock}
        onComplete={() => setShowImmunityUnlock(false)}
      />

      {/* Immunity Saved Overlay */}
      <ImmunitySavedOverlay
        show={showImmunitySaved}
        onComplete={() => setShowImmunitySaved(false)}
      />
    </div>
  );
}
