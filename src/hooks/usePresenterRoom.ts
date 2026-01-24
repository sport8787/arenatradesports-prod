/**
 * Hook para gerenciar sala do Modo Apresentador
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Question } from '@/types/game';

export type PresenterEventType = 
  | 'show_question'
  | 'hide_question'
  | 'start_timer'
  | 'stop_timer'
  | 'reveal_answer'
  | 'start_voting'
  | 'end_voting'
  | 'enable_justification'
  | 'play_audio'
  | 'player_joined'
  | 'player_left'
  | 'game_start'
  | 'game_end'
  | 'next_round'
  | 'show_scores'
  | 'jury_vote'
  | 'mycroft_analysis'
  | 'voice_metrics'
  | 'release_mycroft'; // Presenter releases Mycroft analysis to jury

interface PresenterEvent {
  type: PresenterEventType;
  data?: Record<string, unknown>;
  timestamp: number;
}

interface Player {
  id: string;
  nickname: string;
  role: 'presenter' | 'player' | 'jury';
  score: number;
  isOnline: boolean;
}

export interface JuryVote {
  playerId: string;
  nickname: string;
  voteType: 'believe' | 'doubt';
  timestamp: number;
}

interface MycroftPendingAnalysis {
  verdict: string;
  confidence: number;
  forensicDetails: string;
  metrics?: Record<string, unknown>;
  videoUrl?: string;
  facialAnalysis?: {
    overallFacialSuspicion: number;
    eyeGaze: string;
    microExpressions: string[];
    pnlReasoning: string;
  };
}

interface RoomState {
  currentQuestion: Question | null;
  currentRound: number;
  timerActive: boolean;
  timerType: 'response' | 'voting' | null;
  timerDuration: number;
  showingAnswer: boolean;
  votingActive: boolean;
  justificationEnabled: boolean;
  players: Player[];
  isGameStarted: boolean;
  juryVotes: JuryVote[];
  pendingMycroftAnalysis: MycroftPendingAnalysis | null;
  mycroftReleased: boolean;
}

export function usePresenterRoom(roomId: string | undefined, isPresenter: boolean = false) {
  const [roomState, setRoomState] = useState<RoomState>({
    currentQuestion: null,
    currentRound: 1,
    timerActive: false,
    timerType: null,
    timerDuration: 0,
    showingAnswer: false,
    votingActive: false,
    justificationEnabled: false,
    players: [],
    isGameStarted: false,
    juryVotes: [],
    pendingMycroftAnalysis: null,
    mycroftReleased: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Broadcast evento para todos os jogadores
  const broadcastEvent = useCallback(async (event: PresenterEvent) => {
    if (!roomId || !channelRef.current) return;

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'presenter_control',
        payload: event
      });

      // Também salvar no banco para histórico
      await supabase.from('room_events').insert([{
        room_id: roomId,
        event_type: event.type,
        event_data: event.data ? JSON.parse(JSON.stringify(event.data)) : null
      }]);
    } catch (err) {
      console.error('[PresenterRoom] Error broadcasting event:', err);
    }
  }, [roomId]);

  // Ações do apresentador
  const showQuestion = useCallback(async (question: Question) => {
    setRoomState(prev => ({ ...prev, currentQuestion: question, showingAnswer: false }));
    await broadcastEvent({
      type: 'show_question',
      data: { question },
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const hideQuestion = useCallback(async () => {
    setRoomState(prev => ({ ...prev, currentQuestion: null }));
    await broadcastEvent({
      type: 'hide_question',
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const startTimer = useCallback(async (type: 'response' | 'voting', duration: number) => {
    setRoomState(prev => ({
      ...prev,
      timerActive: true,
      timerType: type,
      timerDuration: duration
    }));
    await broadcastEvent({
      type: 'start_timer',
      data: { timerType: type, duration },
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const stopTimer = useCallback(async () => {
    setRoomState(prev => ({
      ...prev,
      timerActive: false,
      timerType: null,
      timerDuration: 0
    }));
    await broadcastEvent({
      type: 'stop_timer',
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const revealAnswer = useCallback(async () => {
    setRoomState(prev => ({ ...prev, showingAnswer: true }));
    await broadcastEvent({
      type: 'reveal_answer',
      data: { answer: roomState.currentQuestion?.correct_option },
      timestamp: Date.now()
    });
  }, [broadcastEvent, roomState.currentQuestion]);

  const startVoting = useCallback(async () => {
    // Limpa votos anteriores ao iniciar nova votação (no banco e em memória)
    if (roomId && roomState.currentQuestion) {
      await supabase
        .from('votes')
        .delete()
        .eq('room_id', roomId)
        .eq('question_id', roomState.currentQuestion.id);
    }
    setRoomState(prev => ({ ...prev, votingActive: true, juryVotes: [] }));
    await broadcastEvent({
      type: 'start_voting',
      timestamp: Date.now()
    });
  }, [broadcastEvent, roomId, roomState.currentQuestion]);

  const endVoting = useCallback(async () => {
    // When voting ends we also stop any active voting timer to avoid lingering countdown in the UI
    setRoomState(prev => ({
      ...prev,
      votingActive: false,
      timerActive: false,
      timerType: null,
      timerDuration: 0
    }));
    await broadcastEvent({
      type: 'end_voting',
      timestamp: Date.now()
    });

    // Explicitly stop timer on all clients as well
    await broadcastEvent({
      type: 'stop_timer',
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const enableJustification = useCallback(async () => {
    setRoomState(prev => ({ ...prev, justificationEnabled: true }));
    await broadcastEvent({
      type: 'enable_justification',
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const playAudio = useCallback(async (audioId: string, audioFile: string) => {
    await broadcastEvent({
      type: 'play_audio',
      data: { 
        audioId, 
        audioFile,
        playAt: Date.now() + 300 // 300ms buffer for sync
      },
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const nextRound = useCallback(async () => {
    setRoomState(prev => ({
      ...prev,
      currentRound: prev.currentRound + 1,
      currentQuestion: null,
      showingAnswer: false,
      votingActive: false,
      justificationEnabled: false,
      timerActive: false,
      juryVotes: [],
      pendingMycroftAnalysis: null,
      mycroftReleased: false
    }));
    await broadcastEvent({
      type: 'next_round',
      data: { round: roomState.currentRound + 1 },
      timestamp: Date.now()
    });
  }, [broadcastEvent, roomState.currentRound]);

  // Store Mycroft analysis received from player (presenter only)
  const storePendingMycroft = useCallback((analysis: MycroftPendingAnalysis) => {
    setRoomState(prev => ({
      ...prev,
      pendingMycroftAnalysis: analysis,
      mycroftReleased: false
    }));
  }, []);

  // Release Mycroft analysis to jury
  const releaseMycroft = useCallback(async () => {
    if (!roomState.pendingMycroftAnalysis) return;
    
    console.log('[usePresenterRoom] 🔬 Releasing Mycroft to jury with metrics:', roomState.pendingMycroftAnalysis.metrics);
    console.log('[usePresenterRoom] 📹 Video URL:', roomState.pendingMycroftAnalysis.videoUrl);
    console.log('[usePresenterRoom] 🎭 Facial analysis:', roomState.pendingMycroftAnalysis.facialAnalysis);
    
    setRoomState(prev => ({ ...prev, mycroftReleased: true }));
    await broadcastEvent({
      type: 'release_mycroft',
      data: {
        verdict: roomState.pendingMycroftAnalysis.verdict,
        confidence: roomState.pendingMycroftAnalysis.confidence,
        forensicDetails: roomState.pendingMycroftAnalysis.forensicDetails,
        // Send as BOTH 'metrics' and 'voiceMetrics' for compatibility
        metrics: roomState.pendingMycroftAnalysis.metrics,
        voiceMetrics: roomState.pendingMycroftAnalysis.metrics,
        // NEW: Include video URL and facial analysis for jury to view
        videoUrl: roomState.pendingMycroftAnalysis.videoUrl,
        facialAnalysis: roomState.pendingMycroftAnalysis.facialAnalysis
      },
      timestamp: Date.now()
    });
  }, [broadcastEvent, roomState.pendingMycroftAnalysis]);

  const startGame = useCallback(async (question?: Question) => {
    setRoomState(prev => ({ 
      ...prev, 
      isGameStarted: true,
      currentQuestion: question || null,
      showingAnswer: false
    }));
    await broadcastEvent({
      type: 'game_start',
      data: question ? { question } : undefined,
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const showScores = useCallback(async () => {
    await broadcastEvent({
      type: 'show_scores',
      data: { players: roomState.players },
      timestamp: Date.now()
    });
  }, [broadcastEvent, roomState.players]);

  // Carregar jogadores da sala
  const loadPlayers = useCallback(async () => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId);

    if (!error && data) {
      setRoomState(prev => ({
        ...prev,
        players: data.map(p => ({
          id: p.id,
          nickname: p.nickname,
          role: (p.role as 'presenter' | 'player' | 'jury') || 'player',
          score: p.score,
          isOnline: true
        }))
      }));
    }
  }, [roomId]);

  // Carregar votos do banco para a questão atual
  const loadVotes = useCallback(async (questionId: string) => {
    if (!roomId) return;

    const { data, error } = await supabase
      .from('votes')
      .select('*, players!votes_player_id_fkey(nickname)')
      .eq('room_id', roomId)
      .eq('question_id', questionId);

    if (!error && data) {
      const juryVotes: JuryVote[] = data.map(v => ({
        playerId: v.player_id,
        nickname: (v.players as { nickname: string } | null)?.nickname || 'Jogador',
        voteType: v.vote_type as 'believe' | 'doubt',
        timestamp: new Date(v.created_at).getTime()
      }));
      setRoomState(prev => ({ ...prev, juryVotes }));
    }
  }, [roomId]);

  // Salvar voto no banco
  const saveVote = useCallback(async (vote: JuryVote, questionId: string) => {
    if (!roomId) return;

    // Upsert: remove voto anterior do mesmo jogador e insere novo
    await supabase
      .from('votes')
      .delete()
      .eq('room_id', roomId)
      .eq('question_id', questionId)
      .eq('player_id', vote.playerId);

    await supabase
      .from('votes')
      .insert({
        room_id: roomId,
        question_id: questionId,
        player_id: vote.playerId,
        vote_type: vote.voteType
      });
  }, [roomId]);

  // Setup realtime channel
  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    // Timeout de segurança: mesmo que a subscrição demore, libera o loading
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      console.log('[PresenterRoom] Loading timeout - releasing UI');
    }, 3000);

    const channel = supabase.channel(`presenter:${roomId}`)
      .on('broadcast', { event: 'presenter_control' }, (payload) => {
        const event = payload.payload as PresenterEvent;
        
        // All users receive jury votes for real-time counter
        if (event.type === 'jury_vote') {
          const voteData = event.data as unknown as JuryVote;
          const questionId = (event.data as { questionId?: string })?.questionId;
          if (voteData?.playerId && voteData?.voteType) {
            setRoomState(prev => ({
              ...prev,
              juryVotes: [
                ...prev.juryVotes.filter(v => v.playerId !== voteData.playerId),
                voteData
              ]
            }));
            // Persistir voto no banco (qualquer cliente pode fazer isso, mas o presenter faz a gestão principal)
            if (isPresenter && questionId) {
              saveVote(voteData, questionId);
            }
          }
          // Continue processing for presenter-specific logic if needed
          if (isPresenter) return;
        }
        
        // Atualizar estado baseado no evento recebido (para jogadores)
        if (!isPresenter) {
          switch (event.type) {
            case 'show_question':
              setRoomState(prev => ({
                ...prev,
                currentQuestion: event.data?.question as Question,
                showingAnswer: false
              }));
              break;
            case 'hide_question':
              setRoomState(prev => ({ ...prev, currentQuestion: null }));
              break;
            case 'start_timer':
              setRoomState(prev => ({
                ...prev,
                timerActive: true,
                timerType: event.data?.timerType as 'response' | 'voting',
                timerDuration: event.data?.duration as number
              }));
              break;
            case 'stop_timer':
              setRoomState(prev => ({
                ...prev,
                timerActive: false,
                timerType: null
              }));
              break;
            case 'reveal_answer':
              setRoomState(prev => ({ ...prev, showingAnswer: true }));
              break;
            case 'start_voting':
              setRoomState(prev => ({ ...prev, votingActive: true }));
              break;
            case 'end_voting':
              setRoomState(prev => ({ ...prev, votingActive: false }));
              break;
            case 'enable_justification':
              setRoomState(prev => ({ ...prev, justificationEnabled: true }));
              break;
            case 'next_round':
              setRoomState(prev => ({
                ...prev,
                currentRound: event.data?.round as number,
                currentQuestion: null,
                showingAnswer: false,
                votingActive: false,
                justificationEnabled: false,
                pendingMycroftAnalysis: null,
                mycroftReleased: false
              }));
              break;
            case 'release_mycroft':
              setRoomState(prev => ({ 
                ...prev, 
                mycroftReleased: true,
                pendingMycroftAnalysis: {
                  verdict: event.data?.verdict as string,
                  confidence: event.data?.confidence as number,
                  forensicDetails: event.data?.forensicDetails as string,
                  metrics: event.data?.metrics as Record<string, unknown>,
                  videoUrl: event.data?.videoUrl as string | undefined,
                  facialAnalysis: event.data?.facialAnalysis as {
                    overallFacialSuspicion: number;
                    eyeGaze: string;
                    microExpressions: string[];
                    pnlReasoning: string;
                  } | undefined
                }
              }));
              break;
            case 'game_start':
              setRoomState(prev => ({ 
                ...prev, 
                isGameStarted: true,
                currentQuestion: event.data?.question as Question || prev.currentQuestion,
                showingAnswer: false
              }));
              break;
          }
        }
      })
      .on('presence', { event: 'sync' }, () => {
        loadPlayers();
      })
      .subscribe((status) => {
        console.log('[PresenterRoom] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          clearTimeout(loadingTimeout);
          setLoading(false);
          loadPlayers();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(loadingTimeout);
          setLoading(false);
          setError('Erro ao conectar à sala');
        }
      });

    channelRef.current = channel;

    return () => {
      clearTimeout(loadingTimeout);
      supabase.removeChannel(channel);
    };
  }, [roomId, isPresenter, loadPlayers, saveVote]);

  // Carregar votos quando a questão muda (para recuperar estado após reload)
  useEffect(() => {
    if (roomState.currentQuestion?.id && roomId) {
      loadVotes(roomState.currentQuestion.id);
    }
  }, [roomState.currentQuestion?.id, roomId, loadVotes]);

  return {
    roomState,
    loading,
    error,
    channelRef, // Expor ref do canal para PlayerScreen poder fazer broadcast
    // Ações do apresentador
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
    loadPlayers,
    loadVotes,
    saveVote,
    storePendingMycroft,
    releaseMycroft
  };
}
