import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveMatch {
  id: string;
  match_id: string;
  championship: string;
  home_team: string;
  away_team: string;
  home_logo: string | null;
  away_logo: string | null;
  score_home: number;
  score_away: number;
  minute: number | null;
  period: string | null;
  status: string | null;
  stats: any;
  mycroft_status: string | null;
  mycroft_analysis_id: string | null;
  created_at: string;
  updated_at: string;
  mycroft_analysis?: {
    id: string;
    verdict: string;
    market: string;
    odd: number;
    confidence: number;
    thesis: string;
    fundamentation: any;
    risk_management: any;
    alerts: string[];
  } | null;
}

export function useLiveMatches() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('live_matches')
      .select('*')
      .in('status', ['live', 'halftime'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching matches:', error);
      setLoading(false);
      return;
    }

    // Fetch associated analyses for matches that have one
    const matchesWithAnalysis = await Promise.all(
      (data || []).map(async (match: any) => {
        if (match.mycroft_analysis_id) {
          const { data: analysis } = await supabase
            .from('mycroft_analyses')
            .select('*')
            .eq('id', match.mycroft_analysis_id)
            .single();
          return { ...match, mycroft_analysis: analysis };
        }
        return { ...match, mycroft_analysis: null };
      })
    );

    setMatches(matchesWithAnalysis);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMatches();

    const channel = supabase
      .channel('live_matches_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_matches' },
        () => fetchMatches()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mycroft_analyses' },
        () => fetchMatches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMatches]);

  return { matches, loading, refetch: fetchMatches };
}
