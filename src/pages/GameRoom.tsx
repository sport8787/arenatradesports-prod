import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
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
import { Input } from '@/components/ui/input';
import { Play, Copy, Check, Bot, Loader2, Volume2, Home, Lock, Unlock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function GameRoom() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isHost = searchParams.get('host') === 'true';
  const { gameState, loading, updateRoomStatus, submitVote } = useGameState(roomId || null);
  const { playChips, playSuspense, playFanfare, playReveal, playTick, playTimeUp, preloadSounds } = useSoundEffects();
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
  const rankingUpdatedRef = useRef<string | null>(null);

  const sessionId = getOrCreateSessionId();
  const isCurrentPlayer = gameState.currentPlayer?.session_id === sessionId;
  const hasVoted = gameState.votes.some(v => v.player_id === gameState.myPlayer?.id);

  // Preload sounds when component mounts
  useEffect(() => {
    preloadSounds();
  }, [preloadSounds]);

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

  // Update rankings based on result
  const updateRankingsForResult = async () => {
    if (!gameState.myPlayer || !myRanking) return;

    const wasBluffSuccessful = gameState.votes.filter(v => v.vote_type === 'believe').length > 0;
    const myVote = gameState.votes.find(v => v.player_id === gameState.myPlayer?.id);
    
    // Current player (bluffer)
    if (isCurrentPlayer) {
      if (wasBluffSuccessful) {
        // Successful bluff: +50 points per fooled player
        const fooledCount = gameState.votes.filter(v => v.vote_type === 'believe').length;
        await updateRankingStats({
          addPoints: 50 * fooledCount,
          addSuccessfulBluff: true,
        });
      }
    } else if (myVote) {
      // Jury member
      if (myVote.vote_type === 'doubt' && !wasBluffSuccessful) {
        // Correctly doubted: +30 points
        await updateRankingStats({
          addPoints: 30,
          addBluffDetected: true,
        });
      } else if (myVote.vote_type === 'believe' && wasBluffSuccessful) {
        // Was fooled: just track it
        await updateRankingStats({
          addTimesFooled: true,
        });
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
    // Create/update ranking entry
    await getOrCreateRanking(nickname);
    await supabase.from('players').insert({
      room_id: roomId,
      nickname,
      session_id: sessionId,
      is_host: isHost,
    });
  };

  const copyPin = () => {
    navigator.clipboard.writeText(gameState.room?.pin || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startGame = async () => {
    if (!roomId || questions.length === 0) return;
    const q = questions[questionIndex];
    await supabase.from('rooms').update({ 
      current_status: 'question', 
      current_question_id: q.id 
    }).eq('id', roomId);
  };

  const goToVoting = () => {
    // Reset answer states when going to voting
    setSelectedAnswer(null);
    setConfirmedAnswer(null);
    setShowAnswer(false);
    updateRoomStatus('voting');
  };

  const confirmAnswer = () => {
    if (!selectedAnswer) return;
    setConfirmedAnswer(selectedAnswer);
    setShowAnswer(true);
    playReveal();
  };
  
  const showResults = async () => {
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
    if (gameState.myPlayer?.is_host) {
      setTimeout(() => showResults(), 1000);
    }
  };

  const nextQuestion = async () => {
    if (!roomId) return;
    const nextIdx = (questionIndex + 1) % questions.length;
    setQuestionIndex(nextIdx);
    // Reset answer states for next question
    setSelectedAnswer(null);
    setConfirmedAnswer(null);
    setShowAnswer(false);
    await supabase.from('rooms').update({
      current_status: 'question',
      current_question_id: questions[nextIdx]?.id,
      current_player_index: (gameState.room?.current_player_index || 0) + 1,
    }).eq('id', roomId);
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
                  {gameState.myPlayer?.is_host && gameState.players.length >= 2 && (
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
                          <GoldButton variant="outline" onClick={() => setShowMycroft(true)} className="flex-1">
                            <Bot className="w-5 h-5 mr-2 inline" /> Mycroft AI
                          </GoldButton>
                          <GoldButton onClick={goToVoting} className="flex-1">
                            Ir para Votação
                          </GoldButton>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!isCurrentPlayer && (
                    <p className="text-center text-muted-foreground">
                      {gameState.currentPlayer?.nickname} está analisando a questão...
                    </p>
                  )}
                </div>
              )}

              {/* VOTING */}
              {gameState.room?.current_status === 'voting' && gameState.currentQuestion && (
                <div className="space-y-6">
                  {!isCurrentPlayer && gameState.currentQuestion.mycroft_risk_level && (
                    <MycroftPanel question={gameState.currentQuestion} variant="analytics" isVisible />
                  )}
                  {isCurrentPlayer ? (
                    <div className="text-center py-8">
                      <h3 className="font-orbitron text-xl mb-2">Aguardando Votos</h3>
                      <p className="text-muted-foreground">O júri está decidindo...</p>
                      {gameState.myPlayer?.is_host && (
                        <GoldButton onClick={showResults} className="mt-4">
                          Revelar Resultado
                        </GoldButton>
                      )}
                    </div>
                  ) : (
                    <VotingPanel
                      onVote={submitVote}
                      hasVoted={hasVoted}
                      votedFor={gameState.votes.find(v => v.player_id === gameState.myPlayer?.id)?.vote_type as 'believe' | 'doubt' | undefined}
                      onTimerTick={handleTimerTick}
                      onTimerComplete={handleTimerComplete}
                      timerActive={gameState.room?.current_status === 'voting'}
                    />
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
                  />
                  {gameState.myPlayer?.is_host && (
                    <GoldButton onClick={nextQuestion} className="w-full" size="lg">
                      Próxima Rodada
                    </GoldButton>
                  )}
                </div>
              )}
            </LuxuryCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Scoreboard players={gameState.players} currentPlayerId={gameState.currentPlayer?.id} />
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
