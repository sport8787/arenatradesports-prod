/**
 * Tela do Jogador - Interface simplificada para jogadores no Modo Apresentador
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, Check, HelpCircle, 
  Loader2, Home, Users, Trophy, Wifi, WifiOff, Volume2, VolumeX
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePresenterRoom, PresenterEventType } from '@/hooks/usePresenterRoom';
import { getOrCreateSessionId } from '@/lib/gameUtils';
import { Button } from '@/components/ui/button';
import GoldButton from '@/components/game/GoldButton';
import RoundBackground from '@/components/game/RoundBackground';
import LiveVoteCounter from '@/components/game/LiveVoteCounter';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import cartaClaro from '@/assets/carta_claro.png';
import cartaBlefe from '@/assets/carta_blefe.png';
import PresenterModeRecorder from '@/components/game/PresenterModeRecorder';
import { processRecordedAudio, MycroftAnalysisResult } from '@/services/presenterAudioService';

interface JuryVote {
  playerId: string;
  nickname: string;
  voteType: 'believe' | 'doubt';
  timestamp: number;
}

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
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [mycroftAnalysis, setMycroftAnalysis] = useState<MycroftAnalysisResult | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [juryVotes, setJuryVotes] = useState<JuryVote[]>([]);
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
        setPlayerId(data.id);
      }
    };

    loadPlayer();
  }, [roomId]);

  // Listen for audio broadcasts and Mycroft analysis from presenter
  // Nota: Usamos o canal existente do usePresenterRoom para evitar duplicação
  // Este efeito adiciona handlers extras para áudio e análise Mycroft
  useEffect(() => {
    if (!roomId) return;

    // Criar canal separado apenas para handlers de áudio (o usePresenterRoom já gerencia o estado)
    const audioChannel = supabase.channel(`player-audio:${roomId}`)
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

        // Receive Mycroft analysis ONLY when presenter releases it (release_mycroft event)
        if (event.type === 'release_mycroft' && event.data && role === 'jury') {
          console.log('[PlayerScreen] 🔬 Mycroft analysis RELEASED by presenter:', event.data);
          setMycroftAnalysis({
            verdict: event.data.verdict as string,
            confidence: event.data.confidence as number,
            forensicDetails: event.data.forensicDetails as string
          });
          toast({
            title: '🔬 Análise Forense do Mycroft',
            description: 'O apresentador liberou a análise de voz!'
          });
        }

        // Listen for jury votes to show live counter to all players
        if (event.type === 'jury_vote' && event.data) {
          const voteData = event.data as unknown as JuryVote;
          if (voteData?.playerId && voteData?.voteType) {
            console.log('[PlayerScreen] 🗳️ Jury vote received:', voteData);
            setJuryVotes(prev => [
              ...prev.filter(v => v.playerId !== voteData.playerId),
              voteData
            ]);
          }
        }

        // Clear votes on new voting round
        if (event.type === 'start_voting') {
          setJuryVotes([]);
        }

        // Clear votes on next round
        if (event.type === 'next_round') {
          setJuryVotes([]);
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = audioChannel;

    return () => {
      supabase.removeChannel(audioChannel);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [roomId, isMuted, role]);

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
    setMycroftAnalysis(null); // Clear previous analysis
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
    
    const voteData = {
      playerId,
      nickname,
      voteType,
      timestamp: Date.now()
    };

    // Also add to local state immediately for UI feedback
    setJuryVotes(prev => [
      ...prev.filter(v => v.playerId !== playerId),
      voteData
    ]);
    
    // Broadcast voto para o apresentador E outros jogadores via canal
    if (channelRef.current && playerId) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'presenter_control',
        payload: {
          type: 'jury_vote',
          data: voteData,
          timestamp: Date.now()
        }
      });
    }
    
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
            "px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2",
            role === 'jury' 
              ? "bg-purple-900/50 text-purple-300 border border-purple-500/50"
              : "bg-gold/20 text-gold border border-gold/50"
          )}>
            {role === 'jury' ? (
              <>👨‍⚖️ Jurado</>
            ) : (
              <>🎯 Jogador Principal</>
            )}
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

            {/* Options (for players - Jogador Principal) */}
            {role === 'player' && !roomState.showingAnswer && (
              <div className="space-y-3">
                {/* Banner indicando que é o Jogador Principal */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-gold/10 border border-gold/30 rounded-xl mb-4"
                >
                  <span className="text-xl">🎯</span>
                  <div>
                    <p className="text-sm font-semibold text-gold">Você é o Jogador Principal</p>
                    <p className="text-xs text-muted-foreground">
                      {hasAnswered 
                        ? "A resposta correta está destacada. Convença o júri!" 
                        : "Selecione sua resposta abaixo"}
                    </p>
                  </div>
                </motion.div>

                {['A', 'B', 'C', 'D'].map((option) => {
                  const optionKey = `option_${option.toLowerCase()}` as keyof typeof roomState.currentQuestion;
                  const optionText = roomState.currentQuestion?.[optionKey];
                  const isCorrect = roomState.currentQuestion?.correct_option === option;
                  // Só mostra a resposta correta APÓS o jogador confirmar
                  const showCorrectHighlight = hasAnswered && isCorrect;
                  
                  return (
                    <motion.button
                      key={option}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectAnswer(option)}
                      disabled={hasAnswered}
                      className={cn(
                        "w-full p-4 rounded-xl text-left transition-all relative",
                        "border-2",
                        selectedAnswer === option
                          ? "border-gold bg-gold/20"
                          : showCorrectHighlight
                          ? "border-emerald-500/50 bg-emerald-900/20"
                          : "border-border/50 bg-background/30 hover:border-gold/50",
                        hasAnswered && "opacity-80"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-bold mr-2",
                          showCorrectHighlight ? "text-emerald-400" : "text-gold"
                        )}>
                          {option}.
                        </span>
                        <span className="flex-1">{optionText}</span>
                        {showCorrectHighlight && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full border border-emerald-500/30">
                            ✓ Correta
                          </span>
                        )}
                      </div>
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
                    className="space-y-4 mt-4"
                  >
                    <div className="text-center p-4 rounded-xl bg-success/20 border border-success">
                      <Check className="w-8 h-8 text-success mx-auto mb-2" />
                      <p className="font-medium text-success">Resposta Enviada!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {roomState.justificationEnabled 
                          ? 'Grave sua justificativa para o júri!' 
                          : 'Aguarde o apresentador liberar a gravação...'}
                      </p>
                    </div>
                    
                    {/* Gravador de Justificativa - só aparece quando liberado */}
                    {roomState.justificationEnabled && (
                      <>
                        <PresenterModeRecorder
                          onRecordingComplete={async (blob, durationMs, voiceMetrics) => {
                            setRecordedAudioBlob(blob);
                            setIsProcessingAudio(true);
                            
                            try {
                              const result = await processRecordedAudio(
                                blob,
                                voiceMetrics, // Pass REAL voice metrics
                                roomId || '',
                                playerId,
                                roomState.currentRound,
                                roomState.currentQuestion?.question_text || '',
                                roomState.currentQuestion?.correct_option || '',
                                selectedAnswer || ''
                              );
                              
                              if (result.analysis) {
                                setMycroftAnalysis(result.analysis);
                                
                                // Broadcast voice metrics AND Mycroft analysis TO PRESENTER ONLY
                                // The presenter will decide when to release the analysis to the jury
                                if (channelRef.current) {
                                  await channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'presenter_control',
                                    payload: {
                                      type: 'voice_metrics',
                                      data: {
                                        metrics: result.metrics,
                                        playerName: nickname
                                      },
                                      timestamp: Date.now()
                                    }
                                  });
                                  console.log('[PlayerScreen] 📊 Voice metrics sent to presenter');
                                  
                                  // Send Mycroft analysis to PRESENTER (not directly to jury)
                                  await channelRef.current.send({
                                    type: 'broadcast',
                                    event: 'presenter_control',
                                    payload: {
                                      type: 'mycroft_analysis',
                                      data: {
                                        verdict: result.analysis.verdict,
                                        confidence: result.analysis.confidence,
                                        forensicDetails: result.analysis.forensicDetails,
                                        metrics: result.metrics
                                      },
                                      timestamp: Date.now()
                                    }
                                  });
                                  console.log('[PlayerScreen] 📡 Mycroft analysis sent to PRESENTER (awaiting release)');
                                }
                                
                                toast({
                                  title: '🔬 Análise Pronta',
                                  description: 'Aguarde o apresentador liberar para o júri'
                                });
                              }
                            } catch (err) {
                              console.error('[PlayerScreen] Audio processing error:', err);
                            } finally {
                              setIsProcessingAudio(false);
                            }
                          }}
                          disabled={isProcessingAudio}
                        />
                        
                        {isProcessingAudio && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2 p-3 bg-purple-900/20 border border-purple-500/30 rounded-xl"
                          >
                            <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                            <span className="text-sm text-purple-300">Mycroft analisando voz...</span>
                          </motion.div>
                        )}
                      </>
                    )}
                    
                    {/* Live Vote Counter for Main Player - shows during voting */}
                    {roomState.votingActive && (
                      <div className="mt-4">
                        <LiveVoteCounter
                          votes={juryVotes}
                          totalJuryMembers={roomState.players.filter(p => p.role === 'jury').length}
                          showDetails={false}
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}

            {/* Options display for jury - mostra alternativas mas NÃO mostra qual é correta */}
            {role === 'jury' && !roomState.showingAnswer && (
              <div className="space-y-4">
                {/* Banner indicando que é Júri */}
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 bg-purple-900/20 border border-purple-500/30 rounded-xl mb-4"
                >
                  <span className="text-xl">👨‍⚖️</span>
                  <div>
                    <p className="text-sm font-semibold text-purple-300">Você é do Júri</p>
                    <p className="text-xs text-muted-foreground">
                      Observe as alternativas e avalie se o jogador está blefando
                    </p>
                  </div>
                </motion.div>

                {/* Mostra as alternativas para o júri (sem destacar a correta) */}
                {['A', 'B', 'C', 'D'].map((option) => {
                  const optionKey = `option_${option.toLowerCase()}` as keyof typeof roomState.currentQuestion;
                  const optionText = roomState.currentQuestion?.[optionKey];
                  
                  return (
                    <div
                      key={option}
                      className="w-full p-4 rounded-xl text-left border-2 border-border/50 bg-background/30"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold mr-2 text-muted-foreground">
                          {option}.
                        </span>
                        <span className="flex-1">{optionText}</span>
                      </div>
                    </div>
                  );
                })}

                {/* Mycroft Forensic Analysis Panel - ONLY for jury */}
                {mycroftAnalysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="p-4 rounded-xl bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-500/50 shadow-lg shadow-purple-500/20"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/30 flex items-center justify-center">
                        <span className="text-lg">🔬</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-purple-300 text-sm">ANÁLISE FORENSE MYCROFT</h4>
                        <p className="text-xs text-purple-400/80">Biometria vocal detectada</p>
                      </div>
                      <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
                        <span className="text-xs text-purple-300 font-mono">
                          {Math.round(mycroftAnalysis.confidence * 100)}% confiança
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-foreground/90 leading-relaxed">
                        {mycroftAnalysis.verdict}
                      </p>
                      
                      {mycroftAnalysis.forensicDetails && (
                        <div className="mt-3 p-3 rounded-lg bg-background/30 border border-purple-500/20">
                          <p className="text-xs text-purple-300/80 font-mono">
                            {mycroftAnalysis.forensicDetails}
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Área de votação com cards visuais */}
                {roomState.votingActive && (
                  <div className="space-y-4 mt-6">
                    <p className="text-center text-muted-foreground font-medium">
                      O jogador está mentindo ou falando a verdade?
                    </p>
                    
                    <div className="flex justify-center gap-6">
                      {/* Card CLARO */}
                      <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: hasVoted ? 1 : 1.05, y: hasVoted ? 0 : -10 }}
                        whileTap={{ scale: hasVoted ? 1 : 0.95 }}
                        onClick={() => !hasVoted && handleVote('believe')}
                        disabled={hasVoted}
                        className={cn(
                          'relative transition-all duration-300',
                          hasVoted && vote !== 'believe' && 'opacity-30 scale-90',
                          hasVoted && vote === 'believe' && 'ring-4 ring-success ring-offset-4 ring-offset-background rounded-2xl'
                        )}
                      >
                        <img 
                          src={cartaClaro} 
                          alt="CLARO - Acreditar" 
                          className="w-32 h-48 object-cover rounded-xl shadow-lg"
                        />
                        {hasVoted && vote === 'believe' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                            <Loader2 className="w-8 h-8 animate-spin text-success" />
                          </div>
                        )}
                        <p className="text-xs text-center mt-2 text-success font-medium">Acreditar</p>
                      </motion.button>

                      {/* Card BLEFE */}
                      <motion.button
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        whileHover={{ scale: hasVoted ? 1 : 1.05, y: hasVoted ? 0 : -10 }}
                        whileTap={{ scale: hasVoted ? 1 : 0.95 }}
                        onClick={() => !hasVoted && handleVote('doubt')}
                        disabled={hasVoted}
                        className={cn(
                          'relative transition-all duration-300',
                          hasVoted && vote !== 'doubt' && 'opacity-30 scale-90',
                          hasVoted && vote === 'doubt' && 'ring-4 ring-destructive ring-offset-4 ring-offset-background rounded-2xl'
                        )}
                      >
                        <img 
                          src={cartaBlefe} 
                          alt="BLEFE - Duvidar" 
                          className="w-32 h-48 object-cover rounded-xl shadow-lg"
                        />
                        {hasVoted && vote === 'doubt' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                            <Loader2 className="w-8 h-8 animate-spin text-destructive" />
                          </div>
                        )}
                        <p className="text-xs text-center mt-2 text-destructive font-medium">Duvidar</p>
                      </motion.button>
                    </div>

                    {hasVoted && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mt-4"
                      >
                        <p className="text-sm text-muted-foreground">
                          Voto registrado! Aguarde o resultado...
                        </p>
                      </motion.div>
                    )}

                    {/* Live Vote Counter for Jury */}
                    <div className="mt-4">
                      <LiveVoteCounter
                        votes={juryVotes}
                        totalJuryMembers={roomState.players.filter(p => p.role === 'jury').length}
                        showDetails={false}
                        compact={true}
                      />
                    </div>
                  </div>
                )}

                {/* Aguardando votação abrir */}
                {!roomState.votingActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center p-4 rounded-xl bg-muted/20 border border-border/50 mt-4"
                  >
                    <HelpCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Aguarde o jogador principal responder...
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
