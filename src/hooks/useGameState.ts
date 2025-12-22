import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { GameState, Room, Player, Question, Vote, RoomStatus, GameMode } from '@/types/game';
import { getOrCreateSessionId } from '@/lib/gameUtils';
import { useRealtimeConnection } from './useRealtimeConnection';

// Track state changes to prevent unnecessary audio triggers
interface StateChangeInfo {
  hasChanged: boolean;
  statusChanged: boolean;
  questionChanged: boolean;
}

// Hórus 2.0: Unique narration trigger ID
// Format: `${status}_${questionId}` - only updates when status OR questionId changes
// This prevents audio repetition from player joins or vote updates
export type NarrationId = string | null;

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
  const [lastStateChange, setLastStateChange] = useState<StateChangeInfo>({ 
    hasChanged: false, 
    statusChanged: false, 
    questionChanged: false 
  });
  
  // Hórus 2.0: Single narration trigger ID
  // Only changes when current_status OR current_question_id changes
  const [lastNarrationId, setLastNarrationId] = useState<NarrationId>(null);
  
  const sessionId = getOrCreateSessionId();
  
  // Refs to track previous status/questionId for change detection (audio trigger)
  const prevStatusRef = useRef<RoomStatus | null>(null);
  const prevQuestionIdRef = useRef<string | null>(null);

  // Monitor de mudanças (debug): mostra valor antigo -> novo
  const prevRoomStatusLogRef = useRef<RoomStatus | null>(null);
  const prevRoomQuestionIdLogRef = useRef<string | null>(null);

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

      // Determine current player (host is always the player who responde/blefa)
      const hostPlayer =
        players?.find((p) => p.session_id === room.host_id) || null;

      const currentPlayer =
        hostPlayer || players?.[room.current_player_index] || null;

      // Fetch votes for current question
      let votes: Vote[] = [];
      if (room.current_question_id) {
        const { data: votesData, error: votesError } = await supabase
          .from('votes')
          .select('*')
          .eq('room_id', roomId)
          .eq('question_id', room.current_question_id);
        
        if (votesError) {
          console.error('[GameState] Error fetching votes:', votesError);
        }
        votes = (votesData as Vote[]) || [];
        console.log('[GameState] Fetched votes:', votes.length, 'for question:', room.current_question_id);
      } else {
        console.log('[GameState] No current question ID, skipping vote fetch');
      }

      // Detect if status or question changed (for audio trigger control)
      const statusChanged = prevStatusRef.current !== null && prevStatusRef.current !== room.current_status;
      const questionChanged = prevQuestionIdRef.current !== null && prevQuestionIdRef.current !== room.current_question_id;
      const hasChanged = statusChanged || questionChanged;

      // Hórus 2.0: Generate unique narration ID only when status OR questionId changes
      // PLUS: set an initial narration ID on first fetch.
      const isInitialFetch = prevStatusRef.current === null && prevQuestionIdRef.current === null;
      if (isInitialFetch || statusChanged || questionChanged) {
        const newNarrationId = `${room.current_status}_${room.current_question_id || 'none'}`;
        setLastNarrationId(newNarrationId);
        console.log('[GameState] Narration ID updated:', newNarrationId);
      }

      // Update refs for next comparison
      prevStatusRef.current = room.current_status as RoomStatus;
      prevQuestionIdRef.current = room.current_question_id;

      // Update state change info
      setLastStateChange({ hasChanged, statusChanged, questionChanged });

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

  // Realtime subscriptions configuration
  const subscriptions = useMemo(() => {
    if (!roomId) return [];
    return [
      { table: 'rooms', filter: `id=eq.${roomId}` },
      { table: 'players', filter: `room_id=eq.${roomId}` },
      { table: 'votes', filter: `room_id=eq.${roomId}` },
    ];
  }, [roomId]);

  // Handle realtime messages
  const handleRealtimeMessage = useCallback(() => {
    fetchGameState();
  }, [fetchGameState]);

  // Use the reconnection hook
  const { isConnected, isReconnecting, retryCount, reconnect } = useRealtimeConnection({
    channelName: `room-${roomId}`,
    subscriptions,
    onMessage: handleRealtimeMessage,
    enabled: !!roomId,
  });

  // Initial fetch
  useEffect(() => {
    if (roomId) {
      fetchGameState();
    }
  }, [roomId, fetchGameState]);

  // Monitor de Mudanças: loga sempre que status/pergunta mudarem
  useEffect(() => {
    const room = gameState.room;
    if (!room) return;

    const prevStatus = prevRoomStatusLogRef.current;
    const prevQuestionId = prevRoomQuestionIdLogRef.current;

    const statusChanged = prevStatus !== null && prevStatus !== room.current_status;
    const questionChanged = prevQuestionId !== null && prevQuestionId !== room.current_question_id;

    if (prevStatus === null && prevQuestionId === null) {
      console.log('[Room Monitor] init', {
        status: room.current_status,
        questionId: room.current_question_id,
      });
    } else if (statusChanged || questionChanged) {
      console.log('[Room Monitor] change', {
        status: { from: prevStatus, to: room.current_status },
        questionId: { from: prevQuestionId, to: room.current_question_id },
      });
    }

    prevRoomStatusLogRef.current = room.current_status as RoomStatus;
    prevRoomQuestionIdLogRef.current = room.current_question_id;
  }, [gameState.room?.current_status, gameState.room?.current_question_id]);

  // Update room status
  const updateRoomStatus = async (status: RoomStatus, questionId?: string) => {
    if (!roomId) return;

    // Trava de Status: se não houver mudança real, aborta e não envia nada
    const currentStatus = gameState.room?.current_status ?? null;
    const currentQuestionId = gameState.room?.current_question_id ?? null;

    const statusUnchanged = currentStatus === status;
    const questionUnchanged = questionId === undefined || currentQuestionId === questionId;

    if (statusUnchanged && questionUnchanged) {
      console.log('[updateRoomStatus] noop (sem mudança)', {
        status,
        questionId: questionId ?? currentQuestionId,
      });
      return;
    }

    const updates: Partial<Room> = { current_status: status };
    if (questionId !== undefined) {
      updates.current_question_id = questionId;
    }

    await supabase.from('rooms').update(updates).eq('id', roomId);
  };

  // Update current player index
  const nextPlayer = async () => {
    if (!roomId || !gameState.room) return;

    // Neste modo, o Host (criador da mesa) é sempre o "jogador da vez"
    const hostIndex = gameState.players.findIndex(
      (p) => p.session_id === gameState.room?.host_id
    );
    const indexToKeep = hostIndex >= 0 ? hostIndex : 0;

    await supabase
      .from('rooms')
      .update({ current_player_index: indexToKeep })
      .eq('id', roomId);
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
    if (!player) return false;

    const newBalance = player.bluffcoins + amount;
    if (newBalance < 0) return false; // Not enough coins

    await supabase
      .from('players')
      .update({ bluffcoins: newBalance })
      .eq('id', playerId);
    
    return true;
  };

  // Reset bluffcoins to zero (for All-in loss)
  const resetBluffcoins = async (playerId: string) => {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    await supabase
      .from('players')
      .update({ bluffcoins: 0 })
      .eq('id', playerId);
    
    return true;
  };

  // Check if player should skip bribe (chose correct answer)
  const shouldSkipBribe = (playerAnswer: 'A' | 'B' | 'C' | 'D' | null): boolean => {
    if (!gameState.currentQuestion || !playerAnswer) return false;
    return playerAnswer === gameState.currentQuestion.correct_option;
  };

  // Check if player has enough bluffcoins
  const hasEnoughCoins = (amount: number) => {
    return (gameState.myPlayer?.bluffcoins || 0) >= amount;
  };

  // Update game mode
  const updateGameMode = async (mode: GameMode) => {
    if (!roomId) return;

    await supabase
      .from('rooms')
      .update({ game_mode: mode } as any)
      .eq('id', roomId);
  };

  // Get complete question context for Mycroft analysis
  const getQuestionContext = () => {
    return {
      question: gameState.currentQuestion,
      votes: gameState.votes,
      players: gameState.players,
    };
  };

  // 1. Função para calcular o valor do Acordo de Ouro (Desistência)
  // NOVA LÓGICA: 50% do prêmio acumulado + variação aleatória de ±10% ("humor" da IA)
  const calculateBribeAmount = useCallback((accumulatedPrize: number) => {
    // Fator de Tentação: 50% do prêmio acumulado
    const baseOffer = Math.floor(accumulatedPrize * 0.5);
    
    // Variação da IA: ±10% baseado no "humor" do Hórus
    // Exemplo: Se o prêmio é 8.000, a oferta deve variar entre 3.600 e 4.400
    const variationFactor = 0.1; // 10%
    const randomVariation = (Math.random() * 2 - 1) * variationFactor; // -0.1 a +0.1
    const finalOffer = Math.floor(baseOffer * (1 + randomVariation));
    
    // Mínimo de 100 BluffCoins para garantir que a oferta faça sentido
    return Math.max(finalOffer, 100);
  }, []);

  // 2. Lógica Inteligente de Transição (O Pulo do Gato)
  const checkBribeEligibility = useCallback(async (playerChoice: 'A' | 'B' | 'C' | 'D') => {
    if (!gameState.currentQuestion || !roomId) return;
    
    const isCorrect = playerChoice === gameState.currentQuestion.correct_option;
    
    if (isCorrect) {
      // Se acertou, o destino é a vitória. Pula o acordo e vai direto para o resultado.
      console.log("[Lógica] Jogador acertou. Pulando Acordo de Ouro.");
      await updateRoomStatus('result');
    } else {
      // Se errou, ele está blefando. O Hórus entra para tentar comprá-lo.
      console.log("[Lógica] Jogador errou. Ativando Acordo de Ouro.");
      // Note: 'suborno' status needs to be added to room_status enum if not exists
      // For now, we'll go to 'voting' which triggers the bribe flow
      await updateRoomStatus('voting');
    }
  }, [gameState.currentQuestion, roomId, updateRoomStatus]);

  return {
    gameState,
    loading,
    updateRoomStatus,
    nextPlayer,
    submitVote,
    updateScore,
    updateBluffcoins,
    resetBluffcoins,
    hasEnoughCoins,
    updateGameMode,
    shouldSkipBribe,
    getQuestionContext,
    calculateBribeAmount,
    checkBribeEligibility,
    lastStateChange,
    // Hórus 2.0: Single narration trigger
    lastNarrationId,
    refetch: fetchGameState,
    // Connection status
    isConnected,
    isReconnecting,
    retryCount,
    reconnect,
  };
}
