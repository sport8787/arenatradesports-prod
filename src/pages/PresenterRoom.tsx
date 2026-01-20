/**
 * Tela do Apresentador - Painel de Controle do Modo Apresentador
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipForward, Volume2, VolumeX, Users, 
  MessageCircle, Eye, EyeOff, Timer, Check, Mic, 
  ArrowLeft, Settings, Trophy, Zap, RefreshCw, Copy
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePresenterRoom } from '@/hooks/usePresenterRoom';
import { useAuth } from '@/hooks/useAuth';
import { Question } from '@/types/game';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import GoldButton from '@/components/game/GoldButton';
import QuestionCard from '@/components/game/QuestionCard';
import RoundBackground from '@/components/game/RoundBackground';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Tipos de áudio do Hórus disponíveis
const HORUS_AUDIO_OPTIONS = [
  { id: 'read_question', label: 'Ler Pergunta', icon: '📖' },
  { id: 'provoke', label: 'Provocar Jogador', icon: '😈' },
  { id: 'offer_deal', label: 'Oferecer Acordo', icon: '🤝' },
  { id: 'comment_answer', label: 'Comentar Resposta', icon: '💬' },
  { id: 'tension', label: 'Criar Tensão', icon: '⚡' },
  { id: 'celebrate', label: 'Celebrar', icon: '🎉' },
];

export default function PresenterRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const {
    roomState,
    loading,
    showQuestion,
    hideQuestion,
    startTimer,
    stopTimer,
    revealAnswer,
    startVoting,
    endVoting,
    playAudio,
    nextRound,
    startGame,
    showScores,
    loadPlayers
  } = usePresenterRoom(roomId, true);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(0);
  const [volume, setVolume] = useState([80]);
  const [isMuted, setIsMuted] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [roomPin, setRoomPin] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [localTimer, setLocalTimer] = useState(0);

  // Carregar perguntas
  useEffect(() => {
    const loadQuestions = async () => {
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .limit(15);

      if (!error && data) {
        setQuestions(data.map(q => ({
          id: q.id,
          question_text: q.question_text,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          mycroft_bluff_suggestion: q.mycroft_bluff_suggestion || null,
          mycroft_risk_analysis: q.mycroft_risk_analysis || null,
          mycroft_risk_level: q.mycroft_risk_level || null,
          correct_option: q.correct_option,
          category: q.category,
          difficulty: q.difficulty
        })));
      }
    };

    loadQuestions();
  }, []);

  // Carregar PIN da sala
  useEffect(() => {
    const loadRoom = async () => {
      if (!roomId) return;
      
      const { data } = await supabase
        .from('rooms')
        .select('pin')
        .eq('id', roomId)
        .single();

      if (data) {
        setRoomPin(data.pin);
      }
    };

    loadRoom();
  }, [roomId]);

  // Timer local
  useEffect(() => {
    if (roomState.timerActive && roomState.timerDuration > 0) {
      setLocalTimer(roomState.timerDuration);
      const interval = setInterval(() => {
        setLocalTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            stopTimer();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [roomState.timerActive, roomState.timerDuration, stopTimer]);

  const handleCopyPin = () => {
    navigator.clipboard.writeText(roomPin);
    setCopied(true);
    toast({ title: 'PIN copiado!' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShowQuestion = () => {
    const question = questions[selectedQuestionIndex];
    if (question) {
      showQuestion(question);
    }
  };

  const handleNextQuestion = () => {
    if (selectedQuestionIndex < questions.length - 1) {
      setSelectedQuestionIndex(prev => prev + 1);
      hideQuestion();
    }
  };

  const handlePlayHorusAudio = (audioType: string) => {
    playAudio(audioType, roomState.currentQuestion?.question_text);
    toast({ title: `🦅 Hórus: ${audioType}` });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <RefreshCw className="w-8 h-8 text-gold" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <RoundBackground round={roomState.currentRound} />

      <div className="relative z-10 p-4 pb-32">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-background/50 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">PIN da Sala</p>
              <button
                onClick={handleCopyPin}
                className="flex items-center gap-2 font-orbitron text-2xl font-bold text-gold"
              >
                {roomPin}
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowChat(!showChat)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                showChat ? "bg-primary text-primary-foreground" : "hover:bg-background/50"
              )}
            >
              <MessageCircle className="w-5 h-5" />
            </button>
            <button className="p-2 rounded-lg hover:bg-background/50 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Info Bar */}
        <div className="flex items-center justify-between bg-background/30 backdrop-blur-sm rounded-xl p-3 mb-6 border border-border/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{roomState.players.length}</span>
              <span className="text-sm text-muted-foreground">jogadores</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-gold" />
              <span className="font-semibold">Rodada {roomState.currentRound}</span>
            </div>
          </div>

          {!roomState.isGameStarted ? (
            <GoldButton onClick={startGame} size="sm">
              <Play className="w-4 h-4 mr-2" />
              Iniciar Jogo
            </GoldButton>
          ) : (
            <Button onClick={showScores} variant="outline" size="sm">
              <Trophy className="w-4 h-4 mr-2" />
              Placar
            </Button>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Question Control Panel */}
          <div className="lg:col-span-2 space-y-4">
            {/* Question Selector */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Pergunta {selectedQuestionIndex + 1} de {questions.length}</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedQuestionIndex(prev => Math.max(0, prev - 1))}
                    disabled={selectedQuestionIndex === 0}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextQuestion}
                    disabled={selectedQuestionIndex >= questions.length - 1}
                  >
                    Próxima
                  </Button>
                </div>
              </div>

              {questions[selectedQuestionIndex] && (
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="text-sm text-muted-foreground mb-2">
                    {questions[selectedQuestionIndex].category} • {questions[selectedQuestionIndex].difficulty}
                  </p>
                  <p className="font-medium mb-3">{questions[selectedQuestionIndex].question_text}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className={cn(
                      "p-2 rounded",
                      questions[selectedQuestionIndex].correct_option === 'A' ? "bg-success/20 border border-success" : "bg-muted/50"
                    )}>
                      A: {questions[selectedQuestionIndex].option_a}
                    </div>
                    <div className={cn(
                      "p-2 rounded",
                      questions[selectedQuestionIndex].correct_option === 'B' ? "bg-success/20 border border-success" : "bg-muted/50"
                    )}>
                      B: {questions[selectedQuestionIndex].option_b}
                    </div>
                    <div className={cn(
                      "p-2 rounded",
                      questions[selectedQuestionIndex].correct_option === 'C' ? "bg-success/20 border border-success" : "bg-muted/50"
                    )}>
                      C: {questions[selectedQuestionIndex].option_c}
                    </div>
                    <div className={cn(
                      "p-2 rounded",
                      questions[selectedQuestionIndex].correct_option === 'D' ? "bg-success/20 border border-success" : "bg-muted/50"
                    )}>
                      D: {questions[selectedQuestionIndex].option_d}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Control Buttons */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <h3 className="font-semibold mb-3">Controles</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <GoldButton
                  onClick={handleShowQuestion}
                  disabled={roomState.currentQuestion !== null}
                  className="w-full"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Mostrar
                </GoldButton>
                
                <Button
                  variant="outline"
                  onClick={hideQuestion}
                  disabled={roomState.currentQuestion === null}
                  className="w-full"
                >
                  <EyeOff className="w-4 h-4 mr-2" />
                  Esconder
                </Button>

                <Button
                  variant="outline"
                  onClick={revealAnswer}
                  disabled={!roomState.currentQuestion || roomState.showingAnswer}
                  className="w-full"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Revelar
                </Button>

                <Button
                  variant="outline"
                  onClick={nextRound}
                  className="w-full"
                >
                  <SkipForward className="w-4 h-4 mr-2" />
                  Próxima
                </Button>
              </div>
            </div>

            {/* Timer Controls */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Cronômetro</h3>
                {roomState.timerActive && (
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-gold animate-pulse" />
                    <span className="font-orbitron text-2xl font-bold text-gold">
                      {localTimer}s
                    </span>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <Button
                  onClick={() => startTimer('response', 15)}
                  disabled={roomState.timerActive}
                  variant="outline"
                  className="w-full"
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Resposta (15s)
                </Button>
                
                <Button
                  onClick={() => startTimer('voting', 10)}
                  disabled={roomState.timerActive}
                  variant="outline"
                  className="w-full"
                >
                  <Timer className="w-4 h-4 mr-2" />
                  Votação (10s)
                </Button>

                <Button
                  onClick={stopTimer}
                  disabled={!roomState.timerActive}
                  variant="destructive"
                  className="w-full"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Parar
                </Button>
              </div>
            </div>

            {/* Horus Audio Controls */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-xl">🦅</span>
                  Áudios do Hórus
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </button>
                  <Slider
                    value={volume}
                    onValueChange={setVolume}
                    max={100}
                    step={1}
                    className="w-24"
                    disabled={isMuted}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {HORUS_AUDIO_OPTIONS.map((option) => (
                  <Button
                    key={option.id}
                    variant="outline"
                    onClick={() => handlePlayHorusAudio(option.id)}
                    className="w-full justify-start"
                  >
                    <span className="mr-2">{option.icon}</span>
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Players Panel */}
          <div className="space-y-4">
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Jogadores Conectados
                </h3>
                <button onClick={loadPlayers} className="p-1 hover:bg-muted rounded">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {roomState.players.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    Aguardando jogadores...
                  </p>
                ) : (
                  roomState.players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-2 h-2 rounded-full",
                          player.isOnline ? "bg-success" : "bg-muted"
                        )} />
                        <span className="font-medium">{player.nickname}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          ({player.role})
                        </span>
                      </div>
                      <span className="text-gold font-semibold">{player.score}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Voting Control */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <h3 className="font-semibold mb-3">Votação</h3>
              <div className="grid grid-cols-2 gap-2">
                <GoldButton
                  onClick={startVoting}
                  disabled={roomState.votingActive}
                  className="w-full"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Iniciar
                </GoldButton>
                <Button
                  variant="outline"
                  onClick={endVoting}
                  disabled={!roomState.votingActive}
                  className="w-full"
                >
                  Encerrar
                </Button>
              </div>
              
              {roomState.votingActive && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 p-3 rounded-lg bg-gold/10 border border-gold/30 text-center"
                >
                  <p className="text-sm text-gold font-medium">
                    🗳️ Votação em andamento...
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Chat Sidebar */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 w-80 h-full bg-background/95 backdrop-blur-md border-l border-border z-50 p-4"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Chat Moderado</h3>
              <button onClick={() => setShowChat(false)}>
                <EyeOff className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-sm text-center">Chat em desenvolvimento</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
