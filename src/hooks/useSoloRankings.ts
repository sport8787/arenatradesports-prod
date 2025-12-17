import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getOrCreateSessionId } from '@/lib/gameUtils';

export interface SoloRanking {
  id: string;
  nickname: string;
  session_id: string;
  total_games: number;
  total_wins: number;
  total_points: number;
  successful_bluffs: number;
  bluffs_detected: number;
  times_fooled: number;
  best_round: number;
  created_at: string;
  updated_at: string;
}

export function useSoloRankings() {
  const [rankings, setRankings] = useState<SoloRanking[]>([]);
  const [myRanking, setMyRanking] = useState<SoloRanking | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionId = getOrCreateSessionId();

  const fetchRankings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('solo_rankings')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(100);

      if (error) throw error;
      setRankings((data as SoloRanking[]) || []);

      // Find my ranking
      const mine = data?.find(r => r.session_id === sessionId);
      setMyRanking((mine as SoloRanking) || null);
    } catch (error) {
      console.error('Error fetching solo rankings:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  const getOrCreateSoloRanking = useCallback(async (nickname: string): Promise<SoloRanking | null> => {
    try {
      // Check if ranking exists
      const { data: existing } = await supabase
        .from('solo_rankings')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existing) {
        // Update nickname if changed
        if (existing.nickname !== nickname) {
          await supabase
            .from('solo_rankings')
            .update({ nickname })
            .eq('id', existing.id);
        }
        setMyRanking(existing as SoloRanking);
        return existing as SoloRanking;
      }

      // Create new ranking
      const { data: newRanking, error } = await supabase
        .from('solo_rankings')
        .insert({ nickname, session_id: sessionId })
        .select()
        .single();

      if (error) throw error;
      setMyRanking(newRanking as SoloRanking);
      return newRanking as SoloRanking;
    } catch (error) {
      console.error('Error getting/creating solo ranking:', error);
      return null;
    }
  }, [sessionId]);

  const updateSoloRankingStats = useCallback(async (updates: {
    addPoints?: number;
    addWin?: boolean;
    addGame?: boolean;
    addSuccessfulBluff?: boolean;
    addBluffDetected?: boolean;
    addTimesFooled?: boolean;
    setBestRound?: number;
  }) => {
    if (!myRanking) return;

    try {
      const newValues: Partial<SoloRanking> = {};
      
      if (updates.addPoints) {
        newValues.total_points = myRanking.total_points + updates.addPoints;
      }
      if (updates.addWin) {
        newValues.total_wins = myRanking.total_wins + 1;
      }
      if (updates.addGame) {
        newValues.total_games = myRanking.total_games + 1;
      }
      if (updates.addSuccessfulBluff) {
        newValues.successful_bluffs = myRanking.successful_bluffs + 1;
      }
      if (updates.addBluffDetected) {
        newValues.bluffs_detected = myRanking.bluffs_detected + 1;
      }
      if (updates.addTimesFooled) {
        newValues.times_fooled = myRanking.times_fooled + 1;
      }
      if (updates.setBestRound && updates.setBestRound > myRanking.best_round) {
        newValues.best_round = updates.setBestRound;
      }

      await supabase
        .from('solo_rankings')
        .update(newValues)
        .eq('id', myRanking.id);

      await fetchRankings();
    } catch (error) {
      console.error('Error updating solo ranking:', error);
    }
  }, [myRanking, fetchRankings]);

  return {
    rankings,
    myRanking,
    loading,
    getOrCreateSoloRanking,
    updateSoloRankingStats,
    refetch: fetchRankings,
  };
}
