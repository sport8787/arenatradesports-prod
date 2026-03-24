import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Whitelist de ligas permitidas (mesma do backend)
const LIGAS_PERMITIDAS = new Set([
  'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1',
  'Primeira Liga', 'Eredivisie', 'Pro League', 'Super League', 'Süper Lig',
  'Championship', 'Champions League', 'Europa League', 'Conference League',
  'Libertadores', 'Sul-Americana', 'Copa Do Brasil', 'Copa do Brasil',
  'Brasileirão Série A', 'Serie A', 'Série A', 'Brasileirão Série B', 'Serie B', 'Série B',
  'Brasileirão Série C', 'Serie C', 'Série C',
  'Copa do Nordeste', 'Copa do Norte', 'Copa Verde', 'Copa Paulista',
  'Copa Espírito Santo', 'Copa Rio',
  'Argentine Primera División', 'Primera División', 'Liga Profesional Argentina',
  'Copa Argentina', 'Copa Sudamericana',
  'MLS',
]);

function isAllowedLeague(championship: string): boolean {
  if (!championship) return false;
  const lower = championship.toLowerCase();
  for (const liga of LIGAS_PERMITIDAS) {
    if (lower.includes(liga.toLowerCase())) return true;
  }
  return false;
}

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMatches = useCallback(async () => {
    // Single query with join instead of N+1
    const { data, error } = await supabase
      .from('live_matches')
      .select('*, mycroft_analyses(*)')
      .in('status', ['live', 'halftime'])
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching matches:', error);
      setLoading(false);
      return;
    }

    console.log(`[useLiveMatches] Raw from DB: ${(data || []).length} matches`, (data || []).map((m: any) => `${m.match_id}: ${m.championship} (${m.home_team} vs ${m.away_team})`));

    // Map joined data and filter by allowed leagues
    const mapped = (data || [])
      .filter((match: any) => {
        const allowed = isAllowedLeague(match.championship);
        if (!allowed) console.warn(`[useLiveMatches] Filtered out: ${match.championship} (${match.home_team})`);
        return allowed;
      })
      .map((match: any) => {
        const analysis = match.mycroft_analyses || null;
        const { mycroft_analyses, ...rest } = match;
        return { ...rest, mycroft_analysis: analysis } as LiveMatch;
      });

    console.log(`[useLiveMatches] After filter: ${mapped.length} matches`);
    setMatches(mapped);
    setLoading(false);
  }, []);

  // Debounced refetch to avoid rapid-fire updates from realtime
  const debouncedRefetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchMatches();
    }, 2000); // 2s debounce
  }, [fetchMatches]);

  useEffect(() => {
    fetchMatches();

    const channel = supabase
      .channel('live_matches_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_matches' },
        () => debouncedRefetch()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mycroft_analyses' },
        () => debouncedRefetch()
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [fetchMatches, debouncedRefetch]);

  return { matches, loading, refetch: fetchMatches };
}
