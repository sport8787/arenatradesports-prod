import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ScheduledGame {
  id: string;
  match_date: string;
  match_time: string;
  match_datetime: string;
  league_name: string;
  home_team: string;
  away_team: string;
  event_id: string | null;
  match_id: string | null;
  status: string | null;
  check_time: string;
  relevance_score: number | null;
}

export function useScheduledGames() {
  const [games, setGames] = useState<ScheduledGame[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGames = useCallback(async () => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from('scheduled_games')
      .select('*')
      .gte('match_datetime', now.toISOString())
      .lte('match_datetime', in24h.toISOString())
      .order('match_datetime', { ascending: true })
      .limit(80);

    if (error) {
      console.error('Error fetching scheduled games:', error);
    } else {
      setGames((data as any[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGames();
    // Auto-refresh every 60s so countdown + pré-live filtering stay accurate
    const id = setInterval(() => fetchGames(), 60_000);
    return () => clearInterval(id);
  }, [fetchGames]);

  return { games, loading, refetch: fetchGames };
}
