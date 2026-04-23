import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Whitelist de ligas permitidas (mesma do backend)
const LIGAS_PERMITIDAS = new Set([
  'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1',
  'Primeira Liga', 'Eredivisie', 'Pro League', 'Super League', 'Süper Lig',
  'Championship', '2. Bundesliga', 'Bundesliga 2', 'Serie B',
  'Champions League', 'Europa League', 'Conference League',
  'Libertadores', 'Sul-Americana', 'Copa Sudamericana',
  'Copa Do Brasil', 'Copa do Brasil',
  'Brasileirão Série A', 'Serie A', 'Série A',
  'Brasileirão Série B', 'Serie B', 'Série B',
  'Brasileirão Série C', 'Serie C', 'Série C',
  'Copa do Nordeste', 'Copa do Norte', 'Copa Verde', 'Copa Paulista',
  'Copa Espírito Santo', 'Copa Rio',
  'Argentine Primera División', 'Primera División', 'Liga Profesional Argentina',
  'Copa Argentina',
  'MLS',
  'Amistosos Internacionais', 'International Friendlies', 'Friendlies',
  'Eliminatórias Copa do Mundo - Europa', 'World Cup Qualifiers - Europe', 'WC Qualification Europe',
  // Feminino
  "UEFA Women's Champions League", 'WSL', 'Frauen-Bundesliga', 'NWSL', 'Brasileirão Feminino',
  "Women's Super League",
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
    // Buscar tudo que NÃO está explicitamente finalizado/cancelado.
    // O backend já controla quais jogos entram em live_matches; aqui não derrubamos
    // jogos por status secundário ('2nd_half', 'in_play', null etc).
    const FINISHED_STATUSES = ['finished', 'ft', 'aet', 'pen', 'fin', 'ended', 'cancelled', 'canceled', 'postponed', 'abandoned'];
    const { data, error } = await supabase
      .from('live_matches')
      .select('*, mycroft_analyses(*)')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching matches:', error);
      setLoading(false);
      return;
    }

    const mapped = (data || [])
      .filter((match: any) => {
        const status = String(match.status || '').toLowerCase();
        // Remove jogos explicitamente finalizados
        if (FINISHED_STATUSES.includes(status)) return false;
        // Remove jogos antigos sem atualização há mais de 4h (evita lixo)
        const updatedAgoMs = Date.now() - new Date(match.updated_at).getTime();
        if (updatedAgoMs > 4 * 60 * 60 * 1000) return false;
        // Backend já controla quais jogos entram em live_matches (whitelist de ligas).
        // Frontend NÃO deve refiltrar por liga — isso causava jogos sumindo da UI
        // quando o nome do campeonato vinha em outro idioma/variante.
        return true;
      })
      .map((match: any) => {
        const analysis = match.mycroft_analyses || null;
        const { mycroft_analyses, ...rest } = match;
        return { ...rest, mycroft_analysis: analysis } as LiveMatch;
      });

    console.log(`[useLiveMatches] ${(data || []).length} brutos → ${mapped.length} ativos`);
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

    // Polling de segurança a cada 15s — evita "sumiço" temporário caso o realtime
    // perca algum evento ou o debounce engula a última atualização.
    const pollId = setInterval(() => {
      fetchMatches();
    }, 15_000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [fetchMatches, debouncedRefetch]);

  return { matches, loading, refetch: fetchMatches };
}
