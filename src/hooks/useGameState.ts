import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameState, Room, Player, Question, Vote, RoomStatus } from '@/types/game';
import { getOrCreateSessionId } from '@/lib/gameUtils';

export function useGameState(roomId: string | null) {
  const [gameState, setGameState] = useState<GameState>({
    room: null,
    players: [],
    currentQuestion: null,
    currentPlayer: null,
    myPlayer: null,
    votes: [],
  });
  const [loading, setLoading] = useState(true);
  const sessionId = getOrCreateSessionId();

  // Fetch initial game state
  const fetchGameState = useCallback(async () => {
    if (!roomId) return;

    try {
      // Fetch room
      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('id', roomId)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!room) return;

      // Fetch players
      const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });

      if (playersError) throw playersError;

      // Find my player
      const myPlayer = players?.find(p => p.session_id === sessionId) || null;

      // Fetch current question if exists
      let currentQuestion: Question | null = null;
      if (room.current_question_id) {
        const { data: question } = await supabase
          .from('questions')
          .select('*')
          .eq('id', room.current_question_id)
          .maybeSingle();
        currentQuestion = question as Question | null;
      }

      // Determine current player
      const currentPlayer = players?.[room.current_player_index] || null;

      // Fetch votes for current question
      let votes: Vote[] = [];
      if (room.current_question_id) {
        const { data: votesData } = await supabase
          .from('votes')
          .select('*')
          .eq('room_id', roomId)
          .eq('question_id', room.current_question_id);
        votes = (votesData as Vote[]) || [];
      }

      setGameState({
        room: room as Room,
        players: (players as Player[]) || [],
        currentQuestion,
        currentPlayer: currentPlayer as Player | null,
        myPlayer: myPlayer as Player | null,
        votes,
      });
    } catch (error) {
      console.error('Error fetching game state:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId, sessionId]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!roomId) return;

    fetchGameState();

    // Subscribe to room changes
    const roomChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        () => {
          fetchGameState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchGameState();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'votes',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchGameState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, fetchGameState]);

  // Update room status
  const updateRoomStatus = async (status: RoomStatus, questionId?: string) => {
    if (!roomId) return;

    const updates: Partial<Room> = { current_status: status };
    if (questionId !== undefined) {
      updates.current_question_id = questionId;
    }

    await supabase.from('rooms').update(updates).eq('id', roomId);
  };

  // Update current player index
  const nextPlayer = async () => {
    if (!roomId || !gameState.room) return;
    
    const nextIndex = (gameState.room.current_player_index + 1) % gameState.players.length;
    await supabase.from('rooms').update({ current_player_index: nextIndex }).eq('id', roomId);
  };

  // Submit vote
  const submitVote = async (voteType: 'believe' | 'doubt') => {
    if (!roomId || !gameState.myPlayer || !gameState.currentQuestion) {
      console.error('Cannot submit vote: missing required data', { roomId, myPlayer: gameState.myPlayer, currentQuestion: gameState.currentQuestion });
      return false;
    }

    // Check if already voted
    const existingVote = gameState.votes.find(v => v.player_id === gameState.myPlayer?.id);
    if (existingVote) {
      console.log('Already voted');
      return true;
    }

    console.log('Submitting vote:', { voteType, roomId, questionId: gameState.currentQuestion.id, playerId: gameState.myPlayer.id });

    const { error } = await supabase.from('votes').insert({
      room_id: roomId,
      question_id: gameState.currentQuestion.id,
      player_id: gameState.myPlayer.id,
      vote_type: voteType,
    });

    if (error) {
      console.error('Error submitting vote:', error);
      return false;
    }

    console.log('Vote submitted successfully');
    return true;
  };

  // Update player score
  const updateScore = async (playerId: string, points: number) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    await supabase
      .from('players')
      .update({ score: player.score + points })
      .eq('id', playerId);
  };

  // Update player bluffcoins
  const updateBluffcoins = async (playerId: string, amount: number) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    const newBalance = player.bluffcoins + amount;
    if (newBalance < 0) return false; // Not enough coins

    await supabase
      .from('players')
      .update({ bluffcoins: newBalance })
      .eq('id', playerId);
    
    return true;
  };

  // Check if player has enough bluffcoins
  const hasEnoughCoins = (amount: number) => {
    return (gameState.myPlayer?.bluffcoins || 0) >= amount;
  };

  return {
    gameState,
    loading,
    updateRoomStatus,
    nextPlayer,
    submitVote,
    updateScore,
    updateBluffcoins,
    hasEnoughCoins,
    refetch: fetchGameState,
  };
}
