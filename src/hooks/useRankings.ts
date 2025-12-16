import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Ranking } from '@/types/ranking';
import { getOrCreateSessionId } from '@/lib/gameUtils';

export function useRankings() {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [myRanking, setMyRanking] = useState<Ranking | null>(null);
  const [loading, setLoading] = useState(true);

  const sessionId = getOrCreateSessionId();

  const fetchRankings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rankings')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(100);

      if (error) throw error;
      setRankings((data as Ranking[]) || []);

      // Find my ranking
      const mine = data?.find(r => r.session_id === sessionId);
      setMyRanking((mine as Ranking) || null);
    } catch (error) {
      console.error('Error fetching rankings:', error);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchRankings();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('rankings-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rankings' },
        () => fetchRankings()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRankings]);

  const getOrCreateRanking = useCallback(async (nickname: string): Promise<Ranking | null> => {
    try {
      // Check if ranking exists
      const { data: existing } = await supabase
        .from('rankings')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existing) {
        // Update nickname if changed
        if (existing.nickname !== nickname) {
          await supabase
            .from('rankings')
            .update({ nickname })
            .eq('id', existing.id);
        }
        return existing as Ranking;
      }

      // Create new ranking
      const { data: newRanking, error } = await supabase
        .from('rankings')
        .insert({ nickname, session_id: sessionId })
        .select()
        .single();

      if (error) throw error;
      return newRanking as Ranking;
    } catch (error) {
      console.error('Error getting/creating ranking:', error);
      return null;
    }
  }, [sessionId]);

  const updateRankingStats = useCallback(async (updates: {
    addPoints?: number;
    addWin?: boolean;
    addGame?: boolean;
    addSuccessfulBluff?: boolean;
    addBluffDetected?: boolean;
    addTimesFooled?: boolean;
  }, rankingOverride?: Ranking | null) => {
    const ranking = rankingOverride || myRanking;
    if (!ranking) return;

    try {
      const newValues: Partial<Ranking> = {};
      
      if (updates.addPoints) {
        newValues.total_points = ranking.total_points + updates.addPoints;
      }
      if (updates.addWin) {
        newValues.total_wins = ranking.total_wins + 1;
      }
      if (updates.addGame) {
        newValues.total_games = ranking.total_games + 1;
      }
      if (updates.addSuccessfulBluff) {
        newValues.successful_bluffs = ranking.successful_bluffs + 1;
      }
      if (updates.addBluffDetected) {
        newValues.bluffs_detected = ranking.bluffs_detected + 1;
      }
      if (updates.addTimesFooled) {
        newValues.times_fooled = ranking.times_fooled + 1;
      }

      await supabase
        .from('rankings')
        .update(newValues)
        .eq('id', ranking.id);

      await fetchRankings();
    } catch (error) {
      console.error('Error updating ranking:', error);
    }
  }, [myRanking, fetchRankings]);

  return {
    rankings,
    myRanking,
    loading,
    getOrCreateRanking,
    updateRankingStats,
    refetch: fetchRankings,
  };
}
