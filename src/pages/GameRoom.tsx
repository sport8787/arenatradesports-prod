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
import { Input } from '@/components/ui/input';
import { Play, Copy, Check, Bot, Loader2, Volume2, Home, Lock, Unlock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

// BluffCoin costs
const MYCROFT_COST = 200;
const DOUBT_COST = 100;

// BluffCoin rewards - Host
const HOST_CORRECT_ANSWER = 100;
const HOST_WRONG_PARTIAL_BLUFF = 200; // At least 1 jury voted CLARO
const HOST_WRONG_FULL_BLUFF = 300;    // All jury voted CLARO

// BluffCoin rewards - Jury
const JURY_CORRECT_READING = 50;

export default function GameRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { gameState, loading, updateRoomStatus, submitVote, updateBluffcoins, hasEnoughCoins } = useGameState(roomId || null);
  const { playChips, playSuspense, playFanfare, playReveal, playTick, playTimeUp, playVote, preloadSounds } = useSoundEffects();
  const { getOrCreateRanking, updateRankingStats, myRanking } = useRankings();
  
  const [nickname, setNickname] = useState('');
  const [copied, setCopied] = useState(false);
  const [showMycroft, setShowMycroft] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [confirmedAnswer, setConfirmedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [mycroftUsed, setMycroftUsed] = useState(false);
  const rankingUpdatedRef = useRef<string | null>(null);
  const coinsUpdatedRef = useRef<string | null>(null);
  const prevVoteCountRef = useRef<number>(0);

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

  // Handler for auto-reveal when all jurors have voted (called from VoteCounter)
  const handleAllVoted = async () => {
    if (!isRoomHost) return;
    await updateRoomStatus('result');
    setTimeout(() => playChips(), 500);
  };

  // Play sounds on status changes and update rankings
  useEffect(() => {
    const currentStatus = gameState.room?.current_status;
    if (prevStatus !== currentStatus && currentStatus) {
      if (currentStatus === 'voting' && prevStatus === 'question') {
        playSuspense();
      } else if (currentStatus === 'result' && prevStatus === 'voting') {
        playReveal();
        setTimeout(() => playFanfare(), 800);
        
        // Update rankings when result is shown
        const questionId = gameState.currentQuestion?.id;
        if (questionId && rankingUpdatedRef.current !== questionId && myRanking) {
          rankingUpdatedRef.current = questionId;
          updateRankingsForResult();
        }
      }
      setPrevStatus(currentStatus);
    }
  }, [gameState.room?.current_status, prevStatus, playSuspense, playReveal, playFanfare]);

  // Update rankings and bluffcoins based on result
  const updateRankingsForResult = async () => {
    if (!gameState.myPlayer || !myRanking) return;

    const questionId = gameState.currentQuestion?.id;
    if (!questionId || coinsUpdatedRef.current === questionId) return;
    coinsUpdatedRef.current = questionId;

    const myVote = gameState.votes.find(v => v.player_id === gameState.myPlayer?.id);
    const playerGotCorrect = confirmedAnswer === gameState.currentQuestion?.correct_option;
    
    // Get jury votes
    const juryVotes = gameState.votes;
    const believeVotes = juryVotes.filter(v => v.vote_type === 'believe').length;
    const totalJuryVotes = juryVotes.length;
    
    // HOST/PLAYER REWARDS
    if (isCurrentPlayer) {
      // +100 for correct answer
      if (playerGotCorrect) {
        await updateBluffcoins(gameState.myPlayer.id, HOST_CORRECT_ANSWER);
        toast({ title: `+${HOST_CORRECT_ANSWER} BluffCoins`, description: 'Resposta correta!' });
      }
      
      // Bluff rewards (only for WRONG answers where jury believed)
      if (!playerGotCorrect && believeVotes > 0) {
        if (believeVotes === totalJuryVotes && totalJuryVotes > 0) {
          // All jury voted CLARO - full bluff success
          await updateBluffcoins(gameState.myPlayer.id, HOST_WRONG_FULL_BLUFF);
          await updateRankingStats({ addPoints: 100, addSuccessfulBluff: true });
          toast({ title: `+${HOST_WRONG_FULL_BLUFF} BluffCoins`, description: 'Blefe perfeito! Todos acreditaram!' });
        } else {
          // At least 1 jury voted CLARO - partial bluff
          await updateBluffcoins(gameState.myPlayer.id, HOST_WRONG_PARTIAL_BLUFF);
          await updateRankingStats({ addPoints: 50, addSuccessfulBluff: true });
          toast({ title: `+${HOST_WRONG_PARTIAL_BLUFF} BluffCoins`, description: 'Blefe parcial!' });
        }
      }
    } 
    // JURY REWARDS
    else if (myVote) {
      // Correct reading: (wrong answer + voted BLEFE) OR (correct answer + voted CLARO)
      const correctReading = 
        (!playerGotCorrect && myVote.vote_type === 'doubt') || 
        (playerGotCorrect && myVote.vote_type === 'believe');
      
      if (correctReading) {
        await updateBluffcoins(gameState.myPlayer.id, JURY_CORRECT_READING);
        await updateRankingStats({
          addPoints: 30,
          addBluffDetected: myVote.vote_type === 'doubt',
        });
        toast({ title: `+${JURY_CORRECT_READING} BluffCoins`, description: 'Leitura correta!' });
      } else {
        await updateRankingStats({ addTimesFooled: true });
      }
    }
  };

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

  const startGame = async () => {
    if (!roomId || questions.length === 0) return;
    if (!isRoomHost) return;

    const q = questions[questionIndex];
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

    const nextIdx = (questionIndex + 1) % questions.length;
    setQuestionIndex(nextIdx);

    // Reset answer states for next question
    setSelectedAnswer(null);
    setConfirmedAnswer(null);
    setShowAnswer(false);
    setMycroftUsed(false);
    prevVoteCountRef.current = 0; // Reset vote counter for sound notification

    const hostIndex = Math.max(
      0,
      gameState.players.findIndex((p) => p.session_id === gameState.room?.host_id)
    );

    await supabase
      .from('rooms')
      .update({
        current_status: 'question',
        current_question_id: questions[nextIdx]?.id,
        current_player_index: hostIndex,
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
                      />
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
                    wasBluffSuccessful={gameState.votes.filter(v => v.vote_type === 'believe').length > 0}
                    confirmedAnswer={confirmedAnswer}
                  />
                  {isRoomHost ? (
                    <GoldButton onClick={nextQuestion} className="w-full" size="lg">
                      Próxima Rodada
                    </GoldButton>
                  ) : (
                    <WaitingMessage type="nextRound" />
                  )}
                </div>
              )}
            </LuxuryCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
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
    </div>
  );
}
