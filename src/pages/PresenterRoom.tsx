/**
 * Tela do Apresentador - Painel de Controle do Modo Apresentador
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipForward, Volume2, VolumeX, Users, 
  MessageCircle, Eye, EyeOff, Timer, Check, Mic, 
  ArrowLeft, Settings, Trophy, Zap, RefreshCw, Copy, Square
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
import VoiceMetricsPanel from '@/components/game/VoiceMetricsPanel';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { VoiceMetrics } from '@/services/audioForensicsService';

// Categorias de áudio do Hórus com arquivos locais
const HORUS_AUDIO_CATEGORIES = [
  {
    category: 'Abertura',
    icon: '🎬',
    audios: [
      { id: 'abertura', label: 'Abertura 1', file: '/audio/horus/abertura.mp3' },
      { id: 'abertura2', label: 'Abertura 2', file: '/audio/horus/abertura2.mp3' },
      { id: 'abertura3', label: 'Abertura 3', file: '/audio/horus/abertura3.mp3' },
      { id: 'abertura4', label: 'Abertura 4', file: '/audio/horus/abertura4.mp3' },
      { id: 'abertura_completa', label: 'Completa', file: '/audio/horus/abertura_completa.mp3' },
    ]
  },
  {
    category: 'Acordos',
    icon: '🤝',
    audios: [
      { id: 'acordo', label: 'Acordo 1', file: '/audio/horus/acordo.mp3' },
      { id: 'acordo2', label: 'Acordo 2', file: '/audio/horus/acordo2.mp3' },
      { id: 'acordo3', label: 'Acordo 3', file: '/audio/horus/acordo3.mp3' },
      { id: 'acordo4', label: 'Acordo 4', file: '/audio/horus/acordo4.mp3' },
      { id: 'acordo5', label: 'Acordo 5', file: '/audio/horus/acordo5.mp3' },
    ]
  },
  {
    category: 'All-In',
    icon: '🎰',
    audios: [
      { id: 'all_in', label: 'All-In 1', file: '/audio/horus/all_in.mp3' },
      { id: 'all_in_2', label: 'All-In 2', file: '/audio/horus/all_in_2.mp3' },
      { id: 'all_in_3', label: 'All-In 3', file: '/audio/horus/all_in_3.mp3' },
      { id: 'all_in_4', label: 'All-In 4', file: '/audio/horus/all_in_4.mp3' },
    ]
  },
  {
    category: 'Bordões',
    icon: '💬',
    audios: [
      { id: 'bordao_1', label: 'Bordão 1', file: '/audio/horus/bordao_1.mp3' },
      { id: 'bordao_2', label: 'Bordão 2', file: '/audio/horus/bordao_2.mp3' },
      { id: 'bordao_3', label: 'Bordão 3', file: '/audio/horus/bordao_3.mp3' },
      { id: 'bordao_4', label: 'Bordão 4', file: '/audio/horus/bordao_4.mp3' },
      { id: 'bordao_5', label: 'Bordão 5', file: '/audio/horus/bordao_5.mp3' },
      { id: 'bordao_6', label: 'Bordão 6', file: '/audio/horus/bordao_6.mp3' },
      { id: 'provocacao_1', label: 'Provocação', file: '/audio/horus/provocacao_1.mp3' },
    ]
  },
  {
    category: 'Resultados',
    icon: '🏆',
    audios: [
      { id: 'vitoria', label: 'Vitória 1', file: '/audio/horus/vitoria.mp3' },
      { id: 'vitoria2', label: 'Vitória 2', file: '/audio/horus/vitoria2.mp3' },
      { id: 'vitoria3', label: 'Vitória 3', file: '/audio/horus/vitoria3.mp3' },
      { id: 'derrota', label: 'Derrota 1', file: '/audio/horus/derrota.mp3' },
      { id: 'derrota2', label: 'Derrota 2', file: '/audio/horus/derrota2.mp3' },
      { id: 'eliminacao', label: 'Eliminação', file: '/audio/horus/eliminacao.mp3' },
    ]
  },
  {
    category: 'Blefe',
    icon: '🎭',
    audios: [
      { id: 'blefe_perfeito', label: 'Blefe Perfeito 1', file: '/audio/horus/blefe_perfeito.mp3' },
      { id: 'blefe_perfeito_2', label: 'Blefe Perfeito 2', file: '/audio/horus/blefe_perfeito_2.mp3' },
      { id: 'mycroft', label: 'Mycroft 1', file: '/audio/horus/mycroft.mp3' },
      { id: 'mycroft2', label: 'Mycroft 2', file: '/audio/horus/mycroft2.mp3' },
    ]
  },
  {
    category: 'Erros',
    icon: '❌',
    audios: [
      { id: 'erro', label: 'Erro 1', file: '/audio/horus/erro.mp3' },
      { id: 'erro2', label: 'Erro 2', file: '/audio/horus/erro2.mp3' },
      { id: 'erro3', label: 'Erro 3', file: '/audio/horus/erro3.mp3' },
      { id: 'erro_critico_1', label: 'Erro Crítico', file: '/audio/horus/erro_critico_1.mp3' },
    ]
  },
  {
    category: 'Efeitos',
    icon: '⚡',
    audios: [
      { id: 'tic_tac', label: 'Tic Tac', file: '/audio/horus/tic_tac.mp3' },
      { id: 'surpresa', label: 'Surpresa', file: '/audio/horus/surpresa.mp3' },
      { id: 'bomb', label: 'Bomba', file: '/audio/horus/bomb.mp3' },
      { id: 'bip', label: 'Bip', file: '/audio/horus/bip.mp3' },
      { id: 'tema', label: 'Tema', file: '/audio/horus/tema.mp3' },
    ]
  },
  {
    category: 'Rodadas',
    icon: '🔢',
    audios: [
      { id: 'rodada_8', label: 'Rodada 8', file: '/audio/horus/rodada_8.mp3' },
      { id: 'rodada_10', label: 'Rodada 10', file: '/audio/horus/rodada_10.mp3' },
      { id: 'rodada_15', label: 'Rodada 15', file: '/audio/horus/rodada_15.mp3' },
      { id: 'check_point_1', label: 'Checkpoint 1', file: '/audio/horus/check_point_1.mp3' },
      { id: 'check_point_2', label: 'Checkpoint 2', file: '/audio/horus/check_point_2.mp3' },
    ]
  },
  {
    category: 'Bônus',
    icon: '🎁',
    audios: [
      { id: 'carta_bonus_imunidade', label: 'Imunidade', file: '/audio/horus/carta_bonus_imunidade.mp3' },
      { id: 'carta_bonus_porto_seguro', label: 'Porto Seguro', file: '/audio/horus/carta_bonus_porto_seguro.mp3' },
      { id: 'tem_porto_seguro', label: 'Tem Porto Seguro', file: '/audio/horus/tem_porto_seguro.mp3' },
      { id: 'evento_oculto_1', label: 'Evento Oculto 1', file: '/audio/horus/evento_oculto_1.mp3' },
      { id: 'evento_oculto_2', label: 'Evento Oculto 2', file: '/audio/horus/evento_oculto_2.mp3' },
    ]
  },
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
    enableJustification,
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
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [playerVoiceMetrics, setPlayerVoiceMetrics] = useState<VoiceMetrics | null>(null);
  const [metricsPlayerName, setMetricsPlayerName] = useState<string>('Jogador');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Listen for voice metrics from players
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`presenter-metrics:${roomId}`)
      .on('broadcast', { event: 'presenter_control' }, (payload) => {
        const event = payload.payload as { type: string; data?: Record<string, unknown> };
        
        if (event.type === 'voice_metrics' && event.data) {
          const { metrics, playerName } = event.data as { 
            metrics: VoiceMetrics; 
            playerName: string 
          };
          setIsAnalyzing(false);
          setPlayerVoiceMetrics(metrics);
          setMetricsPlayerName(playerName || 'Jogador');
          toast({ title: '📊 Métricas vocais recebidas' });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Reset metrics on new round
  useEffect(() => {
    if (roomState.currentRound) {
      setPlayerVoiceMetrics(null);
      setIsAnalyzing(false);
    }
  }, [roomState.currentRound]);

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

  const handlePlayLocalAudio = (audioId: string, file: string) => {
    // Stop currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (currentlyPlaying === audioId) {
      setCurrentlyPlaying(null);
      return;
    }

    const audio = new Audio(file);
    audio.volume = isMuted ? 0 : volume[0] / 100;
    
    audio.onended = () => {
      setCurrentlyPlaying(null);
      audioRef.current = null;
    };
    
    audio.onerror = () => {
      toast({ title: 'Erro ao carregar áudio', variant: 'destructive' });
      setCurrentlyPlaying(null);
    };

    audioRef.current = audio;
    setCurrentlyPlaying(audioId);
    audio.play().catch(() => {
      toast({ title: 'Erro ao tocar áudio', variant: 'destructive' });
      setCurrentlyPlaying(null);
    });

    // Broadcast to players
    playAudio(audioId, file);
  };

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setCurrentlyPlaying(null);
    }
  };

  // Update volume when slider changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume[0] / 100;
    }
  }, [volume, isMuted]);

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
            <GoldButton 
              onClick={() => {
                const question = questions[selectedQuestionIndex];
                startGame(question || undefined);
              }} 
              size="sm"
            >
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

            {/* Control Buttons - Game Flow */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Fluxo do Jogo</h3>
                <div className="text-xs text-muted-foreground">
                  Siga a ordem: 1 → 2 → 3 → 4 → 5
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                {/* Step 1: Show Question + Start Response Timer */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-gold/20 text-gold text-[10px] font-bold flex items-center justify-center">1</span>
                    Exibir Pergunta
                  </span>
                  <GoldButton
                    onClick={() => {
                      handleShowQuestion();
                      startTimer('response', 30);
                    }}
                    disabled={roomState.currentQuestion !== null}
                    className="w-full text-xs py-2"
                    size="sm"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Iniciar Resposta (30s)
                  </GoldButton>
                </div>
                
                {/* Step 2: Enable Justification */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center">2</span>
                    Justificativa
                  </span>
                  <Button
                    variant="outline"
                    onClick={enableJustification}
                    disabled={!roomState.currentQuestion || roomState.justificationEnabled}
                    className={cn(
                      "w-full text-xs py-2",
                      roomState.justificationEnabled && "border-purple-500/50 bg-purple-500/10"
                    )}
                    size="sm"
                  >
                    <Mic className="w-3 h-3 mr-1" />
                    Liberar Gravação
                  </Button>
                </div>

                {/* Step 3: Start Voting */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold flex items-center justify-center">3</span>
                    Votação do Júri
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      startVoting();
                      startTimer('voting', 30);
                    }}
                    disabled={!roomState.currentQuestion || roomState.votingActive}
                    className={cn(
                      "w-full text-xs py-2",
                      roomState.votingActive && "border-blue-500/50 bg-blue-500/10"
                    )}
                    size="sm"
                  >
                    <Users className="w-3 h-3 mr-1" />
                    Iniciar Votação (30s)
                  </Button>
                </div>

                {/* Step 4: Reveal Answer */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-success/20 text-success text-[10px] font-bold flex items-center justify-center">4</span>
                    Revelar Resposta
                  </span>
                  <Button
                    variant="outline"
                    onClick={revealAnswer}
                    disabled={!roomState.currentQuestion || roomState.showingAnswer}
                    className={cn(
                      "w-full text-xs py-2",
                      roomState.showingAnswer && "border-success/50 bg-success/10"
                    )}
                    size="sm"
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Revelar Resposta
                  </Button>
                </div>

                {/* Step 5: Next Round */}
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-bold flex items-center justify-center">5</span>
                    Próxima Rodada
                  </span>
                  <Button
                    variant="outline"
                    onClick={() => {
                      nextRound();
                      setSelectedQuestionIndex(prev => Math.min(prev + 1, questions.length - 1));
                    }}
                    className="w-full text-xs py-2"
                    size="sm"
                  >
                    <SkipForward className="w-3 h-3 mr-1" />
                    Próxima Rodada
                  </Button>
                </div>
              </div>
              
              {/* Secondary controls */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={hideQuestion}
                  disabled={roomState.currentQuestion === null}
                  className="text-xs"
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  Esconder
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={endVoting}
                  disabled={!roomState.votingActive}
                  className="text-xs"
                >
                  Encerrar Votação
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={stopTimer}
                  disabled={!roomState.timerActive}
                  className="text-xs text-destructive"
                >
                  <Pause className="w-3 h-3 mr-1" />
                  Parar Timer
                </Button>
              </div>
            </div>

            {/* Timer Display */}
            {roomState.timerActive && (
              <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-gold/50">
                <div className="flex items-center justify-center gap-3">
                  <Timer className="w-6 h-6 text-gold animate-pulse" />
                  <span className="font-orbitron text-4xl font-bold text-gold">
                    {localTimer}s
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {roomState.timerType === 'response' ? 'Tempo de Resposta' : 'Tempo de Votação'}
                  </span>
                </div>
              </div>
            )}

            {/* Horus Audio Controls */}
            <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="text-xl">🦅</span>
                  Áudios do Hórus
                </h3>
                <div className="flex items-center gap-3">
                  {currentlyPlaying && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={stopCurrentAudio}
                    >
                      <Square className="w-4 h-4 mr-1" />
                      Parar
                    </Button>
                  )}
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

              <div className="space-y-2 max-h-80 overflow-y-auto">
                {HORUS_AUDIO_CATEGORIES.map((cat) => (
                  <div key={cat.category} className="border border-border/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedCategory(
                        expandedCategory === cat.category ? null : cat.category
                      )}
                      className={cn(
                        "w-full flex items-center justify-between p-3 transition-colors",
                        expandedCategory === cat.category ? "bg-primary/10" : "hover:bg-muted/50"
                      )}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span>{cat.icon}</span>
                        {cat.category}
                        <span className="text-xs text-muted-foreground">({cat.audios.length})</span>
                      </span>
                      <span className={cn(
                        "transition-transform",
                        expandedCategory === cat.category ? "rotate-180" : ""
                      )}>
                        ▼
                      </span>
                    </button>
                    
                    <AnimatePresence>
                      {expandedCategory === cat.category && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-2 gap-1.5 p-2 bg-background/30">
                            {cat.audios.map((audio) => (
                              <Button
                                key={audio.id}
                                variant={currentlyPlaying === audio.id ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePlayLocalAudio(audio.id, audio.file)}
                                className={cn(
                                  "w-full justify-start text-xs",
                                  currentlyPlaying === audio.id && "bg-primary animate-pulse"
                                )}
                              >
                                {currentlyPlaying === audio.id ? (
                                  <Pause className="w-3 h-3 mr-1.5" />
                                ) : (
                                  <Play className="w-3 h-3 mr-1.5" />
                                )}
                                {audio.label}
                              </Button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Players Panel */}
          <div className="space-y-4">
            {/* Voice Metrics Panel */}
            <VoiceMetricsPanel 
              metrics={playerVoiceMetrics}
              playerName={metricsPlayerName}
              isLoading={isAnalyzing}
            />

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
              
              {/* Votos do Júri em tempo real */}
              {roomState.juryVotes.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 space-y-2"
                >
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    Votos recebidos ({roomState.juryVotes.length})
                  </p>
                  <div className="space-y-1.5">
                    {roomState.juryVotes.map((v) => (
                      <div
                        key={v.playerId}
                        className={cn(
                          "flex items-center justify-between p-2 rounded-lg text-sm",
                          v.voteType === 'believe' 
                            ? "bg-success/20 border border-success/30"
                            : "bg-destructive/20 border border-destructive/30"
                        )}
                      >
                        <span className="font-medium">{v.nickname}</span>
                        <span className={cn(
                          "text-xs font-semibold",
                          v.voteType === 'believe' ? "text-success" : "text-destructive"
                        )}>
                          {v.voteType === 'believe' ? '👍 CLARO' : '👎 BLEFE'}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Resumo dos votos */}
                  <div className="flex items-center justify-center gap-4 pt-2 border-t border-border/30 mt-2">
                    <span className="text-success text-sm font-medium">
                      👍 {roomState.juryVotes.filter(v => v.voteType === 'believe').length}
                    </span>
                    <span className="text-muted-foreground">vs</span>
                    <span className="text-destructive text-sm font-medium">
                      👎 {roomState.juryVotes.filter(v => v.voteType === 'doubt').length}
                    </span>
                  </div>
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
