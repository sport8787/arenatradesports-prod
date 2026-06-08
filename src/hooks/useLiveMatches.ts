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
  'International Match', 'International Matches', 'Friendly International',
  'Club Friendly', 'Club Friendlies',
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

export interface FutoddsPressureWindow {
  pressure_home?: number;
  pressure_away?: number;
  attacks_home?: number;
  attacks_away?: number;
  dangerous_attacks_home?: number;
  dangerous_attacks_away?: number;
  shots_on_target_home?: number;
  shots_on_target_away?: number;
}

export interface FutoddsPressureIndices {
  home?: number;
  away?: number;
  total?: number;
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
  /** stats JSON. Pode incluir campos Futodds: pressure_indices, last5min_stats,
   *  last10min_stats, last15min_stats, last20min_stats, dangerous_attacks_*, etc. */
  stats: any & {
    pressure_indices?: FutoddsPressureIndices;
    last5min_stats?: FutoddsPressureWindow;
    last10min_stats?: FutoddsPressureWindow;
    last15min_stats?: FutoddsPressureWindow;
    last20min_stats?: FutoddsPressureWindow;
    futodds_event_id?: number | string;
  };
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
    result?: string | null;
    final_score_home?: number | null;
    final_score_away?: number | null;
    settled_at?: string | null;
  } | null;
}

// Cache módulo-level: sobrevive a desmontagem/remontagem de componentes (navegação entre rotas).
// Evita spinner ao voltar para a página — mostra dados imediatamente enquanto revalida em background.
let _moduleCache: LiveMatch[] = [];
let _moduleCacheTs = 0;
const CACHE_STALE_MS = 30_000; // dados < 30s são exibidos sem spinner

export function useLiveMatches() {
  const hasCache = _moduleCache.length > 0;
  const [matches, setMatches] = useState<LiveMatch[]>(() => _moduleCache);
  const [loading, setLoading] = useState(!hasCache);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(() => _moduleCacheTs ? new Date(_moduleCacheTs) : null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMatches = useCallback(async () => {
    setRefreshing(true);
    // Buscar tudo que NÃO está explicitamente finalizado/cancelado.
    const FINISHED_STATUSES = ['finished', 'ft', 'aet', 'pen', 'fin', 'ended', 'cancelled', 'canceled', 'postponed', 'abandoned'];
    const { data, error } = await supabase
      .from('live_matches')
      .select('*, mycroft_analyses(*)')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching matches:', error);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const filtered = (data || [])
      .filter((match: any) => {
        const status = String(match.status || '').toLowerCase();
        if (FINISHED_STATUSES.includes(status)) return false;
        const period = String(match.period || '').toLowerCase();
        if (period.includes('finish') || period.includes('ended') || period.includes('after')) return false;
        // Aumentado de 4h → 6h para tolerar lacunas temporárias da API.
        const updatedAgoMs = Date.now() - new Date(match.updated_at).getTime();
        if (updatedAgoMs > 6 * 60 * 60 * 1000) return false;

        const minute = Number(match.minute || 0);
        const looksLikeSecondHalf = period.includes('second') || period.includes('2nd') || period.includes('2t') || period.includes('2º');
        const looksLikeEndedByClock = minute >= 90 && looksLikeSecondHalf;
        const mycroftSettled = Array.isArray(match.mycroft_analyses)
          ? match.mycroft_analyses.some((a: any) => !!a.result)
          : !!match.mycroft_analyses?.result;

        // Jogo 90'+ em 2T não deve continuar em Ao Vivo só porque a análise tocou o registro.
        // Se o feed real não atualizou recentemente, escondemos da UI imediatamente.
        if (looksLikeEndedByClock && updatedAgoMs > 2 * 60 * 1000) return false;
        // Mesmo com update recente, se já existe resultado liquidado, não é mais jogo ao vivo.
        if (looksLikeEndedByClock && mycroftSettled) return false;
        return true;
      })
      .map((match: any) => {
        // mycroft_analyses(*) retorna array (relação via match_id).
        // Precisamos do registro apontado por mycroft_analysis_id, ou o mais recente.
        const rawAnalysis = match.mycroft_analyses;
        let analysis: any = null;
        if (Array.isArray(rawAnalysis)) {
          analysis = rawAnalysis.find((a: any) => a.id === match.mycroft_analysis_id)
            ?? rawAnalysis.sort((a: any, b: any) =>
                new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
              )[0]
            ?? null;
        } else {
          analysis = rawAnalysis ?? null;
        }
        const { mycroft_analyses, ...rest } = match;
        return { ...rest, mycroft_analysis: analysis } as LiveMatch;
      });

    // Deduplicação por match_id — mantém o registro mais recente (updated_at)
    const dedupMap = new Map<string, LiveMatch>();
    for (const m of filtered) {
      const existing = dedupMap.get(m.match_id);
      if (!existing) {
        dedupMap.set(m.match_id, m);
      } else {
        const existingTs = new Date(existing.updated_at).getTime();
        const currentTs = new Date(m.updated_at).getTime();
        if (currentTs >= existingTs) dedupMap.set(m.match_id, m);
      }
    }
    const mapped = Array.from(dedupMap.values()).sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    console.log(`[useLiveMatches] ${(data || []).length} brutos → ${filtered.length} ativos → ${mapped.length} únicos`);

    // MERGE estável: preserva jogos que estavam ativos há <2 min mesmo se não vierem
    // nesta resposta (evita "sumir/voltar" por jitter da API ou marcação prematura
    // de finished no backend). Atualiza dados dos jogos que vieram.
    setMatches((prev) => {
      const incomingMap = new Map(mapped.map((m) => [m.match_id, m]));
      const RETENTION_MS = 2 * 60 * 1000; // 2 min de retenção otimista
      const now = Date.now();

      // Mantém jogos anteriores recentes que não voltaram nesta resposta
      const retained: LiveMatch[] = [];
      for (const p of prev) {
        if (incomingMap.has(p.match_id)) continue; // será substituído pelo novo
        const age = now - new Date(p.updated_at).getTime();
        if (age <= RETENTION_MS) retained.push(p);
      }

      const merged = [...mapped, ...retained].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      // Evita re-render se assinatura é idêntica
      if (prev.length === merged.length) {
        const sig = (arr: LiveMatch[]) =>
          arr.map((p) => `${p.match_id}:${p.updated_at}:${p.mycroft_status ?? ''}:${p.score_home}-${p.score_away}:${p.minute ?? ''}`).join('|');
        if (sig(prev) === sig(merged)) return prev;
      }
      return merged;
    });
    // Atualiza cache módulo-level para próximas navegações
    _moduleCache = mapped;
    _moduleCacheTs = Date.now();

    setLoading(false);
    setRefreshing(false);
    setLastUpdated(new Date());
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

  return { matches, loading, refreshing, lastUpdated, refetch: fetchMatches };
}
