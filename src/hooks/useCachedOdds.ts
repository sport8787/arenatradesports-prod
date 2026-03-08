import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CachedGame {
  id: string;
  event_id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: any[];
  simulated_odds: boolean;
  fetched_at: string;
  expires_at: string;
}

export function useCachedOdds() {
  const [games, setGames] = useState<CachedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<string | null>(null);

  const fetchCachedGames = useCallback(async () => {
    setLoading(true);
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('cached_odds_games')
      .select('*')
      .gt('expires_at', now)
      .gt('commence_time', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()) // include live window
      .order('commence_time', { ascending: true });

    if (error) {
      console.error('Error fetching cached odds:', error);
    } else {
      setGames((data as any[]) || []);
      if (data && data.length > 0) {
        setLastFetched((data[0] as any).fetched_at);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCachedGames();

    // Listen for realtime updates (when cron refreshes cache)
    const channel = supabase
      .channel('cached_odds_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cached_odds_games' },
        () => fetchCachedGames()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCachedGames]);

  const isEmpty = games.length === 0 && !loading;

  return { games, loading, lastFetched, isEmpty, refetch: fetchCachedGames };
}
