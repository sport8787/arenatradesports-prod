import { useParams, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useGameState } from '@/hooks/useGameState';
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
import { Play, Copy, Check, Bot, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function GameRoom() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const isHost = searchParams.get('host') === 'true';
  const { gameState, loading, updateRoomStatus, submitVote } = useGameState(roomId || null);
  const [nickname, setNickname] = useState('');
  const [copied, setCopied] = useState(false);
  const [showMycroft, setShowMycroft] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);

  const sessionId = getOrCreateSessionId();
  const isCurrentPlayer = gameState.currentPlayer?.session_id === sessionId;
  const hasVoted = gameState.votes.some(v => v.player_id === gameState.myPlayer?.id);

  useEffect(() => {
    supabase.from('questions').select('*').then(({ data }) => {
      if (data) setQuestions(data as Question[]);
    });
  }, []);

  const joinAsPlayer = async () => {
    if (!nickname || !roomId) return;
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

  const goToVoting = () => updateRoomStatus('voting');
  const showResults = () => updateRoomStatus('result');
  const nextQuestion = async () => {
    if (!roomId) return;
    const nextIdx = (questionIndex + 1) % questions.length;
    setQuestionIndex(nextIdx);
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
          <div>
            <h1 className="font-orbitron text-xl text-primary">O BLEFADOR</h1>
            <button onClick={copyPin} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <span className="font-orbitron text-sm">PIN: {gameState.room?.pin}</span>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex -space-x-2">
            {gameState.players.slice(0, 4).map((p, i) => (
              <PlayerAvatar key={p.id} player={p} index={i} size="sm" showScore={false} />
            ))}
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
                    showCorrectAnswer={isCurrentPlayer}
                  />
                  {isCurrentPlayer && (
                    <div className="flex gap-4">
                      <GoldButton variant="outline" onClick={() => setShowMycroft(true)} className="flex-1">
                        <Bot className="w-5 h-5 mr-2 inline" /> Ativar Mycroft
                      </GoldButton>
                      <GoldButton onClick={goToVoting} className="flex-1">
                        Ir para Votação
                      </GoldButton>
                    </div>
                  )}
                  {!isCurrentPlayer && (
                    <p className="text-center text-muted-foreground">
                      {gameState.currentPlayer?.nickname} está respondendo...
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
