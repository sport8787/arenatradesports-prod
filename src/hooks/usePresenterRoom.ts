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
  | 'voice_metrics'; // Voice metrics for presenter

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

interface JuryVote {
  playerId: string;
  nickname: string;
  voteType: 'believe' | 'doubt';
  timestamp: number;
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
    juryVotes: []
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
    // Limpa votos anteriores ao iniciar nova votação
    setRoomState(prev => ({ ...prev, votingActive: true, juryVotes: [] }));
    await broadcastEvent({
      type: 'start_voting',
      timestamp: Date.now()
    });
  }, [broadcastEvent]);

  const endVoting = useCallback(async () => {
    setRoomState(prev => ({ ...prev, votingActive: false }));
    await broadcastEvent({
      type: 'end_voting',
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
      juryVotes: []
    }));
    await broadcastEvent({
      type: 'next_round',
      data: { round: roomState.currentRound + 1 },
      timestamp: Date.now()
    });
  }, [broadcastEvent, roomState.currentRound]);

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

  // Setup realtime channel
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`presenter:${roomId}`)
      .on('broadcast', { event: 'presenter_control' }, (payload) => {
        const event = payload.payload as PresenterEvent;
        
        // Presenter recebe votos do júri
        if (isPresenter && event.type === 'jury_vote') {
          const voteData = event.data as unknown as JuryVote;
          if (voteData?.playerId && voteData?.voteType) {
            setRoomState(prev => ({
              ...prev,
              juryVotes: [
                ...prev.juryVotes.filter(v => v.playerId !== voteData.playerId),
                voteData
              ]
            }));
          }
          return;
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
                justificationEnabled: false
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
        if (status === 'SUBSCRIBED') {
          setLoading(false);
          loadPlayers();
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isPresenter, loadPlayers]);

  return {
    roomState,
    loading,
    error,
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
    loadPlayers
  };
}
