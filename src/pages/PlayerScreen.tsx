/**
 * Tela do Jogador - Interface simplificada para jogadores no Modo Apresentador
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Check, HelpCircle, ThumbsUp, ThumbsDown, 
  Loader2, Home, Users, Trophy, Wifi, WifiOff, Volume2, VolumeX
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePresenterRoom, PresenterEventType } from '@/hooks/usePresenterRoom';
import { getOrCreateSessionId } from '@/lib/gameUtils';
import { Button } from '@/components/ui/button';
import GoldButton from '@/components/game/GoldButton';
import RoundBackground from '@/components/game/RoundBackground';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type PlayerRole = 'player' | 'jury';

export default function PlayerScreen() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const {
    roomState,
    loading
  } = usePresenterRoom(roomId, false);

  const [nickname, setNickname] = useState<string>('');
  const [role, setRole] = useState<PlayerRole>('player');
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [vote, setVote] = useState<'believe' | 'doubt' | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [localTimer, setLocalTimer] = useState(0);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Carregar dados do jogador
  useEffect(() => {
    const loadPlayer = async () => {
      if (!roomId) return;

      const sessionId = getOrCreateSessionId();
      const { data } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .eq('session_id', sessionId)
        .single();

      if (data) {
        setNickname(data.nickname);
        setRole((data.role as PlayerRole) || 'player');
      }
    };

    loadPlayer();
  }, [roomId]);

  // Listen for audio broadcasts from presenter
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`presenter:${roomId}`)
      .on('broadcast', { event: 'presenter_control' }, (payload) => {
        const event = payload.payload as { type: PresenterEventType; data?: Record<string, unknown>; timestamp: number };
        
        if (event.type === 'play_audio' && event.data?.audioFile) {
          const audioFile = event.data.audioFile as string;
          const playAt = event.data.playAt as number;
          
          // Calculate delay for sync
          const now = Date.now();
          const delay = Math.max(0, playAt - now);

          console.log(`[PlayerScreen] 🔊 Audio broadcast received: ${audioFile}, playing in ${delay}ms`);

          setTimeout(() => {
            if (isMuted) {
              console.log('[PlayerScreen] Audio muted, skipping playback');
              return;
            }

            // Stop any currently playing audio
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
            }

            const audio = new Audio(audioFile);
            audio.volume = 0.8;
            
            audio.onplay = () => {
              setIsPlayingAudio(true);
            };
            
            audio.onended = () => {
              setIsPlayingAudio(false);
              audioRef.current = null;
            };
            
            audio.onerror = () => {
              console.error('[PlayerScreen] Error playing audio');
              setIsPlayingAudio(false);
            };

            audioRef.current = audio;
            audio.play().catch(err => {
              console.error('[PlayerScreen] Audio play failed:', err);
              // Show toast to user about audio permissions
              toast({
                title: '🔇 Áudio bloqueado',
                description: 'Toque na tela para ativar o áudio',
                variant: 'destructive'
              });
            });
          }, delay);
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [roomId, isMuted]);

  // Timer local sincronizado
  useEffect(() => {
    if (roomState.timerActive && roomState.timerDuration > 0) {
      setLocalTimer(roomState.timerDuration);
      const interval = setInterval(() => {
        setLocalTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setLocalTimer(0);
    }
  }, [roomState.timerActive, roomState.timerDuration]);

  // Reset estados quando muda de pergunta
  useEffect(() => {
    setSelectedAnswer(null);
    setHasAnswered(false);
    setVote(null);
    setHasVoted(false);
  }, [roomState.currentQuestion?.id]);

  const handleSelectAnswer = (option: string) => {
    if (hasAnswered || role !== 'player') return;
    setSelectedAnswer(option);
  };

  const handleConfirmAnswer = async () => {
    if (!selectedAnswer) return;
    setHasAnswered(true);
    toast({ title: '✅ Resposta enviada!' });
  };

  const handleVote = async (voteType: 'believe' | 'doubt') => {
    if (hasVoted || role !== 'jury') return;
    setVote(voteType);
    setHasVoted(true);
    toast({ 
      title: voteType === 'believe' ? '👍 Você acreditou!' : '👎 Você duvidou!' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="w-8 h-8 text-gold" />
        </motion.div>
      </div>
    );
  }

  // Aguardando jogo começar
  if (!roomState.isGameStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <RoundBackground round={1} />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center space-y-6"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-6xl"
          >
            ⏳
          </motion.div>
          
          <h1 className="font-orbitron text-2xl font-bold">
            Aguardando Apresentador...
          </h1>
          
          <p className="text-muted-foreground">
            Olá, <span className="text-gold font-semibold">{nickname}</span>!
          </p>
          <p className="text-sm text-muted-foreground">
            O jogo começará em breve.
          </p>

          <div className="flex items-center justify-center gap-2 text-sm">
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4 text-success" />
                <span className="text-success">Conectado</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-destructive" />
                <span className="text-destructive">Reconectando...</span>
              </>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 pt-4">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {roomState.players.length} jogadores na sala
            </span>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <RoundBackground round={roomState.currentRound} />

      <div className="relative z-10 p-4 pb-24">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded-lg hover:bg-background/50 transition-colors"
          >
            <Home className="w-5 h-5" />
          </button>

          <div className="text-center">
            <p className="text-xs text-muted-foreground">Rodada</p>
            <p className="font-orbitron text-xl font-bold text-gold">
              {roomState.currentRound}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                "p-2 rounded-lg transition-colors",
                isMuted ? "bg-destructive/20" : "hover:bg-background/50"
              )}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-destructive" />
              ) : (
                <Volume2 className={cn(
                  "w-4 h-4",
                  isPlayingAudio ? "text-gold animate-pulse" : "text-muted-foreground"
                )} />
              )}
            </button>
            {isConnected ? (
              <Wifi className="w-4 h-4 text-success" />
            ) : (
              <WifiOff className="w-4 h-4 text-destructive animate-pulse" />
            )}
            <button
              onClick={() => setShowScoreboard(true)}
              className="p-2 rounded-lg hover:bg-background/50 transition-colors"
            >
              <Trophy className="w-5 h-5 text-gold" />
            </button>
          </div>
        </header>

        {/* Timer */}
        <AnimatePresence>
          {roomState.timerActive && localTimer > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                "flex items-center justify-center gap-3 p-3 rounded-xl mb-4",
                localTimer <= 5 ? "bg-destructive/20 border border-destructive" : "bg-gold/20 border border-gold/50"
              )}
            >
              <Clock className={cn(
                "w-5 h-5",
                localTimer <= 5 ? "text-destructive animate-pulse" : "text-gold"
              )} />
              <span className={cn(
                "font-orbitron text-3xl font-bold",
                localTimer <= 5 ? "text-destructive" : "text-gold"
              )}>
                {localTimer}s
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Role Badge */}
        <div className="flex justify-center mb-4">
          <span className={cn(
            "px-4 py-1 rounded-full text-sm font-medium",
            role === 'jury' 
              ? "bg-purple-900/50 text-purple-300 border border-purple-500/50"
              : "bg-primary/20 text-primary border border-primary/50"
          )}>
            {role === 'jury' ? '👨‍⚖️ Jurado' : '🎮 Jogador'}
          </span>
        </div>

        {/* Main Content */}
        {!roomState.currentQuestion ? (
          // Aguardando pergunta
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center min-h-[50vh] text-center"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl mb-4"
            >
              👀
            </motion.div>
            <h2 className="text-xl font-semibold mb-2">Aguardando Apresentador...</h2>
            <p className="text-sm text-muted-foreground">
              A próxima pergunta aparecerá aqui
            </p>
          </motion.div>
        ) : (
          // Pergunta ativa
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Question */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <p className="text-xs text-muted-foreground mb-2">
                {roomState.currentQuestion.category}
              </p>
              <h2 className="text-lg font-medium">
                {roomState.currentQuestion.question_text}
              </h2>
            </div>

            {/* Options (for players) */}
            {role === 'player' && !roomState.showingAnswer && (
              <div className="space-y-3">
                {['A', 'B', 'C', 'D'].map((option) => {
                  const optionKey = `option_${option.toLowerCase()}` as keyof typeof roomState.currentQuestion;
                  const optionText = roomState.currentQuestion?.[optionKey];
                  
                  return (
                    <motion.button
                      key={option}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectAnswer(option)}
                      disabled={hasAnswered}
                      className={cn(
                        "w-full p-4 rounded-xl text-left transition-all",
                        "border-2",
                        selectedAnswer === option
                          ? "border-gold bg-gold/20"
                          : "border-border/50 bg-background/30 hover:border-gold/50",
                        hasAnswered && "opacity-60 cursor-not-allowed"
                      )}
                    >
                      <span className="font-bold text-gold mr-2">{option}.</span>
                      {optionText}
                    </motion.button>
                  );
                })}

                {selectedAnswer && !hasAnswered && (
                  <GoldButton
                    onClick={handleConfirmAnswer}
                    className="w-full"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Confirmar Resposta
                  </GoldButton>
                )}

                {hasAnswered && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center p-4 rounded-xl bg-success/20 border border-success"
                  >
                    <Check className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="font-medium text-success">Resposta Enviada!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aguarde o resultado...
                    </p>
                  </motion.div>
                )}
              </div>
            )}

            {/* Voting (for jury) */}
            {role === 'jury' && roomState.votingActive && !roomState.showingAnswer && (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground">
                  O jogador está mentindo ou falando a verdade?
                </p>
                
                {!hasVoted ? (
                  <div className="grid grid-cols-2 gap-4">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleVote('believe')}
                      className="p-6 rounded-xl bg-success/20 border-2 border-success/50 hover:border-success transition-all"
                    >
                      <ThumbsUp className="w-10 h-10 text-success mx-auto mb-2" />
                      <p className="font-bold text-success">Acreditar</p>
                    </motion.button>
                    
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleVote('doubt')}
                      className="p-6 rounded-xl bg-destructive/20 border-2 border-destructive/50 hover:border-destructive transition-all"
                    >
                      <ThumbsDown className="w-10 h-10 text-destructive mx-auto mb-2" />
                      <p className="font-bold text-destructive">Duvidar</p>
                    </motion.button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "text-center p-4 rounded-xl border-2",
                      vote === 'believe' 
                        ? "bg-success/20 border-success" 
                        : "bg-destructive/20 border-destructive"
                    )}
                  >
                    {vote === 'believe' ? (
                      <ThumbsUp className="w-8 h-8 text-success mx-auto mb-2" />
                    ) : (
                      <ThumbsDown className="w-8 h-8 text-destructive mx-auto mb-2" />
                    )}
                    <p className="font-medium">
                      Você {vote === 'believe' ? 'acreditou' : 'duvidou'}!
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aguarde o resultado...
                    </p>
                  </motion.div>
                )}
              </div>
            )}

            {/* Answer Reveal */}
            {roomState.showingAnswer && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-3"
              >
                {['A', 'B', 'C', 'D'].map((option) => {
                  const optionKey = `option_${option.toLowerCase()}` as keyof typeof roomState.currentQuestion;
                  const optionText = roomState.currentQuestion?.[optionKey];
                  const isCorrect = option === roomState.currentQuestion?.correct_option;
                  
                  return (
                    <div
                      key={option}
                      className={cn(
                        "w-full p-4 rounded-xl border-2",
                        isCorrect
                          ? "border-success bg-success/20"
                          : "border-border/30 bg-background/30"
                      )}
                    >
                      <span className={cn(
                        "font-bold mr-2",
                        isCorrect ? "text-success" : "text-muted-foreground"
                      )}>
                        {option}.
                      </span>
                      {optionText}
                      {isCorrect && (
                        <Check className="inline w-5 h-5 text-success ml-2" />
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </div>

      {/* Scoreboard Modal */}
      <AnimatePresence>
        {showScoreboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScoreboard(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-orbitron text-lg font-bold text-center text-gold mb-4">
                🏆 Placar
              </h3>
              <div className="space-y-2">
                {roomState.players
                  .sort((a, b) => b.score - a.score)
                  .map((player, index) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-background/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                        </span>
                        <span className={cn(
                          "font-medium",
                          player.nickname === nickname && "text-gold"
                        )}>
                          {player.nickname}
                          {player.nickname === nickname && ' (você)'}
                        </span>
                      </div>
                      <span className="text-gold font-bold">{player.score}</span>
                    </div>
                  ))}
              </div>
              <Button
                variant="outline"
                onClick={() => setShowScoreboard(false)}
                className="w-full mt-4"
              >
                Fechar
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
