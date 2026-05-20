import { useState, useMemo, useCallback, useEffect } from 'react';
import { isExpiredHtSignal } from '@/lib/signalValidity';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, TrendingUp, Dumbbell, Bell, BarChart3, Loader2, Brain, FlaskConical, CheckCircle2, CornerDownRight, LayoutGrid, TableProperties, Target, Trophy, RefreshCw, Sparkles } from 'lucide-react';
import PunterBackButton from '@/components/punter/PunterBackButton';
import WhatsAppSupportButton from '@/components/WhatsAppSupportButton';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { type Match } from '@/components/dashboard/MatchCard';
import MatchCardWithEntries from '@/components/dashboard/MatchCardWithEntries';
import AnalysisModal, { type MycroftAnalysisData } from '@/components/dashboard/AnalysisModal';
import GoldButton from '@/components/game/GoldButton';
import MycroftSportsChat from '@/components/arena-trader/MycroftSportsChat';
import BankrollWidget from '@/components/arena-trader/BankrollWidget';
import { cn } from '@/lib/utils';
import { useLiveMatches, type LiveMatch } from '@/hooks/useLiveMatches';
import { useSportsBankroll } from '@/hooks/useSportsBankroll';
import { useScheduledGames } from '@/hooks/useScheduledGames';
import ScheduledGamesSection from '@/components/dashboard/ScheduledGamesSection';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import SimulationPanel from '@/components/arena-trader/SimulationPanel';
import LiveCronToggle from '@/components/arena-trader/LiveCronToggle';
import ShadowAfCronToggle from '@/components/arena-trader/ShadowAfCronToggle';
import { useAdmin } from '@/hooks/useAdmin';
import ActivePositions from '@/components/dashboard/ActivePositions';
import CalibrationCard from '@/components/dashboard/CalibrationCard';
import { useApprovedSignalSound } from '@/hooks/useApprovedSignalSound';

import CompactMatchTable from '@/components/dashboard/CompactMatchTable';
import ShadowAfApprovedTab from '@/components/dashboard/ShadowAfApprovedTab';
import NextMatchEmptyState from '@/components/arena-trader/NextMatchEmptyState';
import PushOptInBanner from '@/components/punter/PushOptInBanner';
import { useFavorites } from '@/hooks/useFavorites';
import { Star } from 'lucide-react';
import TraderViewModeToggle from '@/components/arena-trader/TraderViewModeToggle';
import MeusSinaisPanel from '@/components/arena-trader/MeusSinaisPanel';
import { useTraderViewMode } from '@/hooks/useTraderViewMode';


const getChampionshipColor = (name: string): Match['championshipColor'] => {
  const lower = name.toLowerCase();
  if (lower.includes('copa')) return 'yellow';
  if (lower.includes('champions') || lower.includes('liga')) return 'blue';
  if (lower.includes('brasileir')) return 'green';
  return 'red';
};

// Mapeia campeonato → região para chips de filtro rápido (Trader #4).
type Region = 'BRASIL' | 'EUROPA' | 'SUL_AMERICA' | 'OUTROS';
const REGION_LABELS: Record<Region, string> = {
  BRASIL: 'Brasil', EUROPA: 'Europa', SUL_AMERICA: 'Sul-América', OUTROS: 'Outros',
};
const getRegionForChampionship = (name: string): Region => {
  const l = (name || '').toLowerCase();
  if (/brasileir|copa do brasil|s[ée]rie [abcd]\b|paulist|carioca|gauch|mineir|baian|cearen|nordest|catarinens|para[ií]b/.test(l)) return 'BRASIL';
  if (/premier league|bundesliga|la liga|laliga|ligue ?1|serie a\b|champions|europa league|conference|eredivisie|primeira liga|portuguese|copa do rei|fa cup|efl|championship|scottish|belgian|austrian|swiss|polish|turkish|s[üu]per lig|greek|russian|ukrainian|romanian|czech|hungarian|denmark|sweden|norway|finland|allsvenskan|eliteserien|veikkaus|euro/.test(l)) return 'EUROPA';
  if (/libertador|sudameric|argentin|chilen|uruguai|paraguai|bolivian|colombian|ecuadorian|peruvian|venezuelan|copa americ/.test(l)) return 'SUL_AMERICA';
  return 'OUTROS';
};

const mapLiveMatchToMatch = (lm: LiveMatch): Match => {
  const s = lm.stats as any;
  return {
    id: lm.id,
    championship: lm.championship,
    championshipColor: getChampionshipColor(lm.championship),
    home: lm.home_team,
    away: lm.away_team,
    homeLogo: lm.home_logo || '⚽',
    awayLogo: lm.away_logo || '⚽',
    scoreHome: lm.score_home ?? 0,
    scoreAway: lm.score_away ?? 0,
    minute: lm.minute ?? 0,
    period: lm.period ?? '',
    status: (lm.status === 'halftime' ? 'live' : lm.status) as Match['status'],
    mycroftStatus: (lm.mycroft_status === 'done' && lm.mycroft_analysis?.verdict ? lm.mycroft_analysis.verdict : lm.mycroft_status === 'analyzing' ? 'AGUARDAR' : lm.mycroft_status === 'opportunity' ? 'APROVADO' : lm.mycroft_status === 'no_value' ? 'JOGO_MORTO' : (lm.mycroft_status || 'AGUARDAR')) as Match['mycroftStatus'],
    matchId: lm.match_id,
    stats: s ? {
      possession_home: s.possession_home ?? undefined,
      possession_away: s.possession_away ?? undefined,
      attacks_home: s.attacks_home ?? s.dangerous_attacks_home ?? undefined,
      attacks_away: s.attacks_away ?? s.dangerous_attacks_away ?? undefined,
      shots_home: s.shots_on_target_home ?? s.shots_home ?? undefined,
      shots_away: s.shots_on_target_away ?? s.shots_away ?? undefined,
      corners_home: s.corners_home ?? undefined,
      corners_away: s.corners_away ?? undefined,
      xG_home: s.xG_home ?? undefined,
      xG_away: s.xG_away ?? undefined,
    } : null,
    planName: lm.mycroft_analysis?.fundamentation?.plan_name ?? null,
    market: lm.mycroft_analysis?.market ?? null,
    signalResult: (lm.mycroft_analysis?.result === 'green' || lm.mycroft_analysis?.result === 'red') ? lm.mycroft_analysis.result : null,
    finalScoreHome: lm.mycroft_analysis?.final_score_home ?? null,
    finalScoreAway: lm.mycroft_analysis?.final_score_away ?? null,
    confidence: lm.mycroft_analysis?.confidence ?? null,
    alerts: lm.mycroft_analysis?.alerts ?? null,
    approvalOdd: lm.mycroft_analysis?.odd ?? null,
    oddsLive: (lm as any).odds_live ?? null,
    healthStats: s ? {
      pressure_indices: s.pressure_indices ?? undefined,
      last5min_stats: s.last5min_stats ?? undefined,
      last10min_stats: s.last10min_stats ?? undefined,
    } : null,
  };
};

type StatusFilter = 'all' | 'proximos' | 'live' | 'aprovados' | 'meus_sinais' | 'aprovados_af' | 'aprovados_ai' | 'scheduled' | 'finished' | 'simulado';

/**
 * Normaliza um mercado para uma chave curta usada no filtro
 * (ex: "Over 0.5 HT", "Under 2.5 FT", "BTTS Yes", "Corners Over 8.5").
 */
function normalizeMarketKey(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m: RegExpMatchArray | null;
  if ((m = s.match(/Corners?\s*Over\s*(\d+(?:\.\d+)?)/i))) return `Corners Over ${m[1]}`;
  if ((m = s.match(/Corners?\s*Under\s*(\d+(?:\.\d+)?)/i))) return `Corners Under ${m[1]}`;
  if ((m = s.match(/Over\s*(\d+(?:\.\d+)?)\s*(?:corners|escanteios)/i))) return `Corners Over ${m[1]}`;
  if ((m = s.match(/Under\s*(\d+(?:\.\d+)?)\s*(?:corners|escanteios)/i))) return `Corners Under ${m[1]}`;
  if ((m = s.match(/Cards?\s*Over\s*(\d+(?:\.\d+)?)/i))) return `Cards Over ${m[1]}`;
  if ((m = s.match(/Cards?\s*Under\s*(\d+(?:\.\d+)?)/i))) return `Cards Under ${m[1]}`;
  if ((m = s.match(/(?:HT\s*Over|Over\s*(\d+(?:\.\d+)?)\s*(?:Gols?\s*)?HT)/i))) {
    const num = m[1] ?? s.match(/HT\s*Over\s*(\d+(?:\.\d+)?)/i)?.[1];
    if (num) return `Over ${num} HT`;
  }
  if ((m = s.match(/(?:HT\s*Under|Under\s*(\d+(?:\.\d+)?)\s*(?:Gols?\s*)?HT)/i))) {
    const num = m[1] ?? s.match(/HT\s*Under\s*(\d+(?:\.\d+)?)/i)?.[1];
    if (num) return `Under ${num} HT`;
  }
  if ((m = s.match(/Over\s*(\d+(?:\.\d+)?)\s*(?:Gols?\s*)?(?:2[ºo]?\s*[Tt]empo|2T|Segundo\s*Tempo)/i))) return `Over ${m[1]} 2T`;
  if ((m = s.match(/Under\s*(\d+(?:\.\d+)?)\s*(?:Gols?\s*)?(?:2[ºo]?\s*[Tt]empo|2T|Segundo\s*Tempo)/i))) return `Under ${m[1]} 2T`;
  if (/BTTS\s*Yes|^GG$/i.test(s)) return 'BTTS Yes';
  if (/BTTS\s*No|^NG$/i.test(s)) return 'BTTS No';
  if (/^BTTS$/i.test(s)) return 'BTTS';
  if ((m = s.match(/Over\s*(\d+(?:\.\d+)?)/i))) return `Over ${m[1]} FT`;
  if ((m = s.match(/Under\s*(\d+(?:\.\d+)?)/i))) return `Under ${m[1]} FT`;
  return s;
}

export default function ArenaTraderSports() {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const { isAdvanced } = useTraderViewMode();
  
  const { matches: liveMatches, loading, refreshing, lastUpdated, refetch } = useLiveMatches();
  const { bankroll, loading: bankrollLoading, placeBet, cashOut, settleBets, updateInitialBalance } = useSportsBankroll();
  const { games: scheduledGames, loading: scheduledLoading } = useScheduledGames();
  const { requestPush, isSupported: pushSupported } = usePushNotifications();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    if (typeof window === 'undefined') return 'all';
    const saved = window.localStorage.getItem('arenaTraderSports.statusFilter');
    const valid: StatusFilter[] = ['all','proximos','live','aprovados','meus_sinais','aprovados_af','scheduled','finished','simulado'];
    return (valid.includes(saved as StatusFilter) ? (saved as StatusFilter) : 'all');
  });
  useEffect(() => {
    try { window.localStorage.setItem('arenaTraderSports.statusFilter', statusFilter); } catch { /* ignore */ }
  }, [statusFilter]);
  const [selectedChampionships, setSelectedChampionships] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const raw = window.localStorage.getItem('arenaTraderSports.selectedChampionships'); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return [];
  });
  useEffect(() => {
    try { window.localStorage.setItem('arenaTraderSports.selectedChampionships', JSON.stringify(selectedChampionships)); } catch { /* ignore */ }
  }, [selectedChampionships]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const raw = window.localStorage.getItem('arenaTraderSports.selectedRegions'); if (raw) return JSON.parse(raw); } catch { /* ignore */ }
    return [];
  });
  useEffect(() => {
    try { window.localStorage.setItem('arenaTraderSports.selectedRegions', JSON.stringify(selectedRegions)); } catch { /* ignore */ }
  }, [selectedRegions]);
  // Modo Foco — Trader #7: esconde tudo que não for LABAREDA / APROVADO FORTE (conf >= 70)
  const [focusMode, setFocusMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem('arenaTraderSports.focusMode') === '1'; } catch { return false; }
  });
  useEffect(() => {
    try { window.localStorage.setItem('arenaTraderSports.focusMode', focusMode ? '1' : '0'); } catch { /* ignore */ }
  }, [focusMode]);
  const [marketFilters, setMarketFilters] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('arenaTraderSports.marketFilters');
      if (raw) return JSON.parse(raw);
      // Migração do filtro antigo single-select
      const legacy = window.localStorage.getItem('arenaTraderSports.marketFilter');
      if (legacy && legacy !== 'all') return [legacy];
    } catch { /* ignore */ }
    return [];
  });
  useEffect(() => {
    try { window.localStorage.setItem('arenaTraderSports.marketFilters', JSON.stringify(marketFilters)); } catch { /* ignore */ }
  }, [marketFilters]);
  // Navegação por teclado entre chips: ←/→ move foco, Home/End vão ao primeiro/último
  const handleChipKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(key)) return;
    const chips = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-chip]:not([disabled])')
    );
    if (chips.length === 0) return;
    const idx = chips.indexOf(document.activeElement as HTMLButtonElement);
    let next = idx;
    if (key === 'ArrowRight') next = idx < 0 ? 0 : (idx + 1) % chips.length;
    else if (key === 'ArrowLeft') next = idx <= 0 ? chips.length - 1 : idx - 1;
    else if (key === 'Home') next = 0;
    else if (key === 'End') next = chips.length - 1;
    e.preventDefault();
    chips[next]?.focus();
  };

  const toggleMarketFilter = (key: string) => {
    setMarketFilters(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);
  };
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MycroftAnalysisData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [isSettling, setIsSettling] = useState(false);
  const [isAnalyzingCorners, setIsAnalyzingCorners] = useState(false);
  const [bettedMatchIds, setBettedMatchIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    if (typeof window === 'undefined') return 'cards';
    const saved = window.localStorage.getItem('arenaTraderSports.viewMode');
    return saved === 'table' || saved === 'cards' ? saved : 'cards';
  });
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { isMatchFavorite, favs } = useFavorites();

  // Sinal sonoro ao detectar nova análise APROVADA / SITUACIONAL / LABAREDA via realtime
  useApprovedSignalSound(true);

  useEffect(() => {
    try {
      window.localStorage.setItem('arenaTraderSports.viewMode', viewMode);
    } catch {
      /* ignore storage errors */
    }
  }, [viewMode]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();

  // Fetch betted match IDs to prevent duplicates
  useEffect(() => {
    async function fetchBettedIds() {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) return;
      setCurrentUserId(session.session.user.id);
      const { data } = await supabase
        .from('virtual_bets')
        .select('match_id')
        .eq('user_id', session.session.user.id)
        .eq('status', 'pending');
      if (data) {
        setBettedMatchIds(new Set(data.map(b => b.match_id)));
      }
    }
    fetchBettedIds();
  }, []);

  const handleSettleBets = useCallback(async () => {
    setIsSettling(true);
    try {
      const result = await settleBets();
      if (result.success) {
        toast.success(result.data?.message || 'Apostas liquidadas!');
      } else {
        toast.error(result.error || 'Erro ao liquidar apostas');
      }
    } catch (e) {
      toast.error('Erro ao liquidar apostas');
    } finally {
      setIsSettling(false);
    }
  }, [settleBets]);

  const handleAnalyzeCorners = useCallback(async () => {
    setIsAnalyzingCorners(true);
    try {
      // Get live matches that have stats
      const matchesToAnalyze = liveMatches
        .filter(lm => lm.status === 'live' || lm.status === 'halftime')
        .slice(0, 10);

      if (matchesToAnalyze.length === 0) {
        toast.warning('Nenhum jogo ao vivo para analisar escanteios');
        return;
      }

      let analyzed = 0;
      let approved = 0;

      for (const match of matchesToAnalyze) {
        try {
          const stats = match.stats as any;
          const { data, error } = await supabase.functions.invoke('mycroft-corners-analyzer', {
            body: {
              fixture_id: match.match_id,
              home_team_id: stats?.home_team_id || 0,
              away_team_id: stats?.away_team_id || 0,
              home_team_name: match.home_team,
              away_team_name: match.away_team,
              liga: match.championship,
              linha_total: 9.5,
              modo: 'completo',
            },
          });
          if (!error && data?.success) {
            analyzed++;
            if (data.aprovados_count > 0) approved++;
          }
        } catch (err) {
          console.warn(`Corners analysis failed for ${match.home_team} vs ${match.away_team}:`, err);
        }
      }

      if (approved > 0) {
        toast.success(`⚽ ${approved} jogos com oportunidade em escanteios!`);
      } else {
        toast.info(`${analyzed} jogos analisados — nenhuma oportunidade em escanteios`);
      }
      await refetch();
    } catch (e) {
      console.error('Corners analysis error:', e);
      toast.error('Erro ao analisar escanteios');
    } finally {
      setIsAnalyzingCorners(false);
    }
  }, [liveMatches, refetch]);

  // Use real data if available, fallback to mock
  const allMatches = useMemo(() => {
    const base = liveMatches.map(mapLiveMatchToMatch);
    return base.map(m => ({ ...m, hasBet: bettedMatchIds.has(m.matchId || m.id) }));
  }, [liveMatches, bettedMatchIds]);

  // Dynamic championships from real data
  const championships = useMemo(() => {
    const priorityOrder = [
      'brasileirão', 'brasileiro serie b', 'premier league',
      'bundesliga', 'la liga', 'ligue 1', 'serie a',
    ];
    const counts = new Map<string, number>();
    allMatches.forEach(m => {
      counts.set(m.championship, (counts.get(m.championship) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => {
        const aIdx = priorityOrder.findIndex(p => a[0].toLowerCase().includes(p));
        const bIdx = priorityOrder.findIndex(p => b[0].toLowerCase().includes(p));
        const aPrio = aIdx >= 0 ? aIdx : 100;
        const bPrio = bIdx >= 0 ? bIdx : 100;
        if (aPrio !== bPrio) return aPrio - bPrio;
        return b[1] - a[1];
      })
      .filter(([name]) => selectedRegions.length === 0 || selectedRegions.includes(getRegionForChampionship(name)))
      .slice(0, 10)
      .map(([name]) => name);
  }, [allMatches, selectedRegions]);

  // Contagem por região (para badges nos chips)
  const regionCounts = useMemo(() => {
    const counts: Record<Region, number> = { BRASIL: 0, EUROPA: 0, SUL_AMERICA: 0, OUTROS: 0 };
    allMatches.forEach(m => { counts[getRegionForChampionship(m.championship)]++; });
    return counts;
  }, [allMatches]);

  const toggleChampionship = (c: string) => {
    setSelectedChampionships(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };
  const toggleRegion = (r: Region) => {
    setSelectedRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);
  };

  const handleViewAnalysis = (matchId: string) => {
    // Navega para a página de detalhes ao vivo (análise + estatísticas + histórico em tempo real)
    navigate(`/arena-trader-sports/jogo/${matchId}`);
  };

  const filtered = useMemo(() => {
    const statusPriority: Record<string, number> = { APROVADO: 0, opportunity: 0, APROVADO_SITUACIONAL: 0, LABAREDA: 1, CUIDADO: 2, AGUARDAR: 3, analyzing: 3, JOGO_MORTO: 4, VETADO: 4, no_value: 4 };
    if (statusFilter === 'meus_sinais') return [];
    return allMatches
      .filter(m => {
        if (statusFilter === 'proximos' || statusFilter === 'scheduled') return false;
        // In "simulado" mode, show only sim_ matches
        if (statusFilter === 'simulado') {
          if (!m.matchId?.startsWith('sim_')) return false;
          if (selectedChampionships.length > 0 && !selectedChampionships.includes(m.championship)) return false;
          return true;
        }
        // In all other tabs, exclude sim_ matches
        if (m.matchId?.startsWith('sim_')) return false;
        // Aba "Sinais Aprovados": apenas APROVADOS com jogo em andamento (live ou halftime)
        if (statusFilter === 'aprovados') {
          const effectiveStatus = (m.status as string) === 'halftime' ? 'live' : m.status;
          if (effectiveStatus !== 'live') return false;
          const approvedStatuses = ['APROVADO', 'APROVADO_SITUACIONAL', 'opportunity', 'LABAREDA'];
          if (!approvedStatuses.includes(m.mycroftStatus)) return false;
          // Excluir sinais de 1º tempo já expirados (após HT)
          if (isExpiredHtSignal({ market: m.market, minute: m.minute, period: m.period, status: m.status })) return false;
          // Filtro por mercado (selecionado pelo usuário)
          if (marketFilters.length > 0) {
            const k = normalizeMarketKey(m.market);
            if (!k || !marketFilters.includes(k)) return false;
          }
        } else if (statusFilter !== 'all') {
          const effectiveStatus = (m.status as string) === 'halftime' ? 'live' : m.status;
          if (effectiveStatus !== statusFilter) return false;
        }
        if (selectedChampionships.length > 0 && !selectedChampionships.includes(m.championship)) return false;
        if (selectedRegions.length > 0 && !selectedRegions.includes(getRegionForChampionship(m.championship))) return false;
        if (onlyFavorites && !isMatchFavorite({ matchId: m.matchId, home: m.home, away: m.away })) return false;
        // Modo Foco — só LABAREDA / APROVADO FORTE (conf >= 70)
        if (focusMode) {
          const focusStatuses = ['APROVADO', 'APROVADO_SITUACIONAL', 'opportunity', 'LABAREDA'];
          if (!focusStatuses.includes(m.mycroftStatus)) return false;
          const conf = typeof m.confidence === 'number' ? m.confidence : 0;
          if (conf < 70) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Favoritos sempre no topo (estáveis durante atualizações ao vivo)
        const favA = isMatchFavorite({ matchId: a.matchId, home: a.home, away: a.away }) ? 0 : 1;
        const favB = isMatchFavorite({ matchId: b.matchId, home: b.home, away: b.away }) ? 0 : 1;
        if (favA !== favB) return favA - favB;
        return (statusPriority[a.mycroftStatus] ?? 3) - (statusPriority[b.mycroftStatus] ?? 3);
      });
  }, [statusFilter, selectedChampionships, selectedRegions, allMatches, onlyFavorites, isMatchFavorite, marketFilters, focusMode]);

  // Mercados disponíveis nos sinais APROVADOS ao vivo (para popular o filtro)
  const approvedMarketOptions = useMemo(() => {
    const approvedStatuses = ['APROVADO', 'APROVADO_SITUACIONAL', 'opportunity', 'LABAREDA'];
    const counts = new Map<string, number>();
    allMatches.forEach(m => {
      if (m.matchId?.startsWith('sim_')) return;
      const eff = (m.status as string) === 'halftime' ? 'live' : m.status;
      if (eff !== 'live') return;
      if (!approvedStatuses.includes(m.mycroftStatus)) return;
      if (isExpiredHtSignal({ market: m.market, minute: m.minute, period: m.period, status: m.status })) return;
      const key = normalizeMarketKey(m.market);
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allMatches]);

  const favoritesCount = useMemo(
    () => allMatches.filter(m => isMatchFavorite({ matchId: m.matchId, home: m.home, away: m.away })).length,
    [allMatches, isMatchFavorite],
  );



  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        {/* Top row: title + bankroll info */}
        <div className="container mx-auto px-4 pt-3 pb-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <PunterBackButton />
            <h1 className="font-orbitron text-base md:text-lg font-bold text-primary truncate">
              Arena Trader Sports
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {bankroll && (
              <div className="hidden md:flex items-center gap-5">
                <div className="flex items-center gap-1.5 text-sm">
                  <Wallet className="w-4 h-4 text-primary" />
                  <span className="text-muted-foreground">Banca:</span>
                  <span className="font-orbitron font-bold text-foreground">
                    R$ {bankroll.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-muted-foreground">Win Rate:</span>
                  <span className="font-orbitron font-bold text-success">{bankroll.win_rate.toFixed(0)}%</span>
                </div>
              </div>
            )}
            <WhatsAppSupportButton />
            <TraderViewModeToggle />
            {isAdvanced && isAdmin && <LiveCronToggle />}
            {/* ShadowAfCronToggle removido — API-Football descontinuada (Fase 1) */}
            {/* View toggle */}
            {isAdvanced && (
              <div className="flex items-center border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn('p-1.5 transition-colors', viewMode === 'cards' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground')}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn('p-1.5 transition-colors', viewMode === 'table' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground')}
                >
                  <TableProperties className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons row - scrollable */}
        {isAdvanced && (
          <div className="container mx-auto px-4 pb-3">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
              <GoldButton size="sm" variant="outline" onClick={() => setIsChatOpen(true)}>
                <Brain className="w-4 h-4 mr-1" />
                Chat com Mycroft
              </GoldButton>
              <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/sinais-aprovados')}>
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Sinais Aprovados
              </GoldButton>
              <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/eventos-raros')}>
                <Sparkles className="w-4 h-4 mr-1" />
                Eventos Raros
              </GoldButton>
              <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/meu-plano')}>
                <Sparkles className="w-4 h-4 mr-1" />
                Meu Plano
              </GoldButton>
              <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/ciclos')}>
                <TrendingUp className="w-4 h-4 mr-1" />
                Ciclos
              </GoldButton>
              <GoldButton size="sm" variant="outline" onClick={() => navigate('/sinais-alavanca')}>
                <TrendingUp className="w-4 h-4 mr-1" />
                Sinais Alavanca
              </GoldButton>
              <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/performance')}>
                <TrendingUp className="w-4 h-4 mr-1" />
                Performance
              </GoldButton>
              <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/performance-por-mercado')}>
                <TrendingUp className="w-4 h-4 mr-1" />
                Por Mercado
              </GoldButton>
            </div>
          </div>
        )}
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Push opt-in (some quando usuário ativa) */}
        <PushOptInBanner />

        {/* Bankroll Widget */}
        {isAdvanced && bankroll && !bankrollLoading && (
          <BankrollWidget bankroll={bankroll} onUpdateBalance={updateInitialBalance} />
        )}

        {/* Active Positions */}
        {isAdvanced && <ActivePositions />}

        {/* Meus Sinais (plano pessoal) — promo discreta. Conteúdo completo na aba "Meus Sinais". */}
        {statusFilter !== 'meus_sinais' && <MeusSinaisPanel />}

        {/* Eventos Raros movido para /arena-trader-sports/eventos-raros */}

        {/* Filters */}
        <div className="space-y-3">
          {/* Sync indicator */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin text-primary')} />
              {refreshing ? (
                <span className="text-primary">Atualizando jogos ao vivo…</span>
              ) : lastUpdated ? (
                <span>
                  Última sincronização:{' '}
                  <span className="text-foreground font-medium">
                    {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </span>
              ) : (
                <span>Aguardando primeira sincronização…</span>
              )}
            </div>
            <button
              onClick={() => refetch()}
              disabled={refreshing}
              className="text-primary hover:underline disabled:opacity-50"
            >
              Atualizar agora
            </button>
          </div>
          <Tabs value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="aprovados" className="gap-1.5">
                Sinais Aprovados
                {(() => {
                  const approved = ['APROVADO', 'APROVADO_SITUACIONAL', 'opportunity', 'LABAREDA'];
                  const count = allMatches.filter(m => {
                    const eff = (m.status as string) === 'halftime' ? 'live' : m.status;
                    if (eff !== 'live') return false;
                    if (!approved.includes(m.mycroftStatus)) return false;
                    if (m.matchId?.startsWith('sim_')) return false;
                    if (isExpiredHtSignal({ market: m.market, minute: m.minute, period: m.period, status: m.status })) return false;
                    return true;
                  }).length;
                  return count > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-bold">
                      {count}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              <TabsTrigger value="meus_sinais" className="gap-1.5">
                <Target className="w-3 h-3" />
                Meus Sinais
              </TabsTrigger>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="proximos" className="gap-1.5">
                Próximos
                {scheduledGames.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">
                    {scheduledGames.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="live">Ao Vivo</TabsTrigger>
              <TabsTrigger value="scheduled" className="gap-1.5">
                Pré-Live
                {(() => {
                  const preliveCount = scheduledGames.filter(g => {
                    const m = (new Date(g.match_datetime).getTime() - Date.now()) / 60000;
                    return m > 0 && m <= 10;
                  }).length;
                  return preliveCount > 0 ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-bold animate-pulse">
                      {preliveCount}
                    </span>
                  ) : null;
                })()}
              </TabsTrigger>
              {/* Em mobile (<md), Finalizados/Simulado ficam ocultos para reduzir scroll horizontal */}
              <TabsTrigger value="finished" className="hidden md:inline-flex">Finalizados</TabsTrigger>
              {isAdvanced && (
                <TabsTrigger value="simulado" className="hidden md:inline-flex gap-1">
                  <FlaskConical className="w-3 h-3" />
                  Simulado
                </TabsTrigger>
              )}
              {/* Aba "Aprovados (AF)" removida — API-Football descontinuada (Fase 1) */}
              {false && isAdvanced && isAdmin && (
                <TabsTrigger value="aprovados_af" className="gap-1.5 border border-amber-500/40 text-amber-600">
                  <FlaskConical className="w-3 h-3" />
                  Aprovados (AF)
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>

          {(() => {
            const anyActive =
              statusFilter !== 'all' ||
              marketFilters.length > 0 ||
              selectedChampionships.length > 0 ||
              onlyFavorites;
            if (!anyActive) return null;
            return (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setMarketFilters([]);
                    setSelectedChampionships([]);
                    setOnlyFavorites(false);
                  }}
                  className="text-xs px-2.5 py-1 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
                  title="Limpa status, mercados, campeonatos e favoritos"
                >
                  ✕ Limpar filtros
                </button>
              </div>
            );
          })()}

          {isAdvanced && statusFilter === 'aprovados' && approvedMarketOptions.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Filtrar por mercado"
              onKeyDown={handleChipKeyDown}
            >
              <span className="text-xs text-muted-foreground mr-1">Mercados:</span>
              {approvedMarketOptions.map(([key, count]) => {
                const active = marketFilters.includes(key);
                return (
                  <button
                    key={key}
                    data-chip
                    onClick={() => toggleMarketFilter(key)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-success/60',
                      active
                        ? 'border-success bg-success/15 text-success'
                        : 'border-border bg-secondary/30 text-muted-foreground hover:border-success/50 hover:text-success'
                    )}
                    aria-pressed={active}
                  >
                    {key} <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
              {marketFilters.length > 0 && (
                <button
                  onClick={() => setMarketFilters([])}
                  className="text-[11px] text-primary hover:underline ml-1"
                >
                  Limpar ({marketFilters.length})
                </button>
              )}
            </div>
          )}

          {statusFilter === 'aprovados_af' && isAdmin && (
            <ShadowAfApprovedTab />
          )}

          {/* Simulation Panel - shown when "Simulado" tab is active */}
          {statusFilter === 'simulado' && (
            <SimulationPanel onFetched={refetch} />
          )}

          {/* Meus Sinais — painel grande quando a aba está ativa */}
          {statusFilter === 'meus_sinais' && (
            <div className="space-y-3">
              <MeusSinaisPanel />
            </div>
          )}

          {isAdvanced && statusFilter !== 'simulado' && statusFilter !== 'meus_sinais' && (
            <>
              {/* Chips de Região (Brasil / Europa / Sul-América / Outros) — Trader #4 */}
              <div className="flex flex-wrap gap-2 items-center mb-2" role="group" aria-label="Regiões">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-orbitron mr-1">Região</span>
                {(['BRASIL','EUROPA','SUL_AMERICA','OUTROS'] as Region[]).map(r => {
                  const active = selectedRegions.includes(r);
                  const count = regionCounts[r];
                  return (
                    <button
                      key={r}
                      data-chip
                      onClick={() => toggleRegion(r)}
                      disabled={count === 0 && !active}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                        active
                          ? 'border-primary bg-primary/15 text-primary'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/50',
                        count === 0 && !active && 'opacity-40 cursor-not-allowed',
                      )}
                      aria-pressed={active}
                    >
                      {REGION_LABELS[r]}
                      <span className="ml-0.5 px-1.5 rounded-full bg-foreground/10 text-foreground/70 text-[10px] font-bold">{count}</span>
                    </button>
                  );
                })}
                {selectedRegions.length > 0 && (
                  <button
                    onClick={() => setSelectedRegions([])}
                    className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >Limpar</button>
                )}
                {/* Modo Foco — Trader #7 */}
                <button
                  onClick={() => setFocusMode(v => !v)}
                  className={cn(
                    'ml-auto px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-warning/60',
                    focusMode
                      ? 'border-warning bg-warning/15 text-warning shadow-[0_0_12px_hsl(var(--warning)/0.35)]'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:border-warning/50 hover:text-warning'
                  )}
                  aria-pressed={focusMode}
                  title="Mostra apenas LABAREDA / APROVADO FORTE (confiança ≥ 70)"
                >
                  🎯 MODO FOCO {focusMode ? 'ON' : 'OFF'}
                </button>
              </div>
            <div
              className="flex flex-wrap gap-2 items-center"
              role="group"
              aria-label="Favoritos e campeonatos"
              onKeyDown={handleChipKeyDown}
            >
              <button
                data-chip
                onClick={() => setOnlyFavorites(v => !v)}
                disabled={favoritesCount === 0 && !onlyFavorites}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  onlyFavorites
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border bg-secondary/30 text-muted-foreground hover:border-primary/50 hover:text-primary',
                  favoritesCount === 0 && !onlyFavorites && 'opacity-50 cursor-not-allowed',
                )}
                aria-pressed={onlyFavorites}
                title={favoritesCount === 0 ? 'Favorite jogos clicando na ⭐ no card' : 'Mostrar apenas favoritos (Home/End para ir ao início/fim, ←/→ para navegar)'}
              >
                <Star className={cn('w-3 h-3', onlyFavorites && 'fill-primary')} />
                Favoritos
                {favoritesCount > 0 && (
                  <span className="ml-0.5 px-1.5 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                    {favoritesCount}
                  </span>
                )}
              </button>
              {championships.map(c => (
                <button
                  key={c}
                  data-chip
                  onClick={() => toggleChampionship(c)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-success/60',
                    selectedChampionships.includes(c)
                      ? 'border-success bg-success/10 text-success'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            </>
          )}

        {/* Scheduled Games Section - shown when "Próximos Jogos" tab is active */}
        {statusFilter === 'proximos' && (
          <ScheduledGamesSection games={scheduledGames} loading={scheduledLoading} mode="upcoming" />
        )}

        {/* Pre-Live Section - jogos que começam em ≤10 minutos */}
        {statusFilter === 'scheduled' && (
          <ScheduledGamesSection
            games={scheduledGames.filter(g => {
              const diffMin = (new Date(g.match_datetime).getTime() - Date.now()) / 60000;
              return diffMin > 0 && diffMin <= 10;
            })}
            loading={scheduledLoading}
            mode="prelive"
          />
        )}
      </div>
      </div>

      {/* Grid */}
      <main className="container mx-auto px-4 pb-8">
        {isAdvanced && isAdmin && <CalibrationCard arena="trader_sports" />}
        {statusFilter === 'meus_sinais' ? null : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-orbitron">Carregando jogos...</p>
          </div>
        ) : filtered.length > 0 ? (
          viewMode === 'table' ? (
            <CompactMatchTable matches={filtered} onRowClick={handleViewAnalysis} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((match, i) => (
                <MatchCardWithEntries
                  key={match.id}
                  match={match}
                  index={i}
                  userId={currentUserId}
                  bankrollBalance={bankroll?.balance ?? 500}
                  onAnalysisClick={handleViewAnalysis}
                />
              ))}
            </div>
          )
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <NextMatchEmptyState
              rawLiveCount={allMatches.filter(m => {
                const eff = (m.status as string) === 'halftime' ? 'live' : m.status;
                return eff === 'live' && !m.matchId?.startsWith('sim_');
              }).length}
              onResetFilters={() => {
                setSelectedRegions([]);
                setSelectedChampionships([]);
                setMarketFilters([]);
                setOnlyFavorites(false);
                setFocusMode(false);
                setStatusFilter('all');
                try {
                  window.localStorage.removeItem('arenaTraderSports.selectedRegions');
                  window.localStorage.removeItem('arenaTraderSports.selectedChampionships');
                  window.localStorage.removeItem('arenaTraderSports.marketFilters');
                  window.localStorage.removeItem('arenaTraderSports.focusMode');
                  window.localStorage.setItem('arenaTraderSports.statusFilter', 'all');
                } catch { /* ignore */ }
              }}
              nextMatch={(() => {
                const next = [...scheduledGames]
                  .filter(g => new Date(g.match_datetime).getTime() > Date.now())
                  .sort((a, b) => new Date(a.match_datetime).getTime() - new Date(b.match_datetime).getTime())[0];
                return next
                  ? {
                      home: next.home_team,
                      away: next.away_team,
                      championship: (next as any).championship || (next as any).league || null,
                      datetime: next.match_datetime,
                    }
                  : null;
              })()}
            />
          </motion.div>
        )}
      </main>

      {/* Analysis Modal */}
      <AnalysisModal
        match={selectedMatch}
        analysis={selectedAnalysis}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        bankrollProps={bankroll ? {
          balance: bankroll.balance,
          recommendedStake: Math.round(bankroll.balance * 0.05 * 100) / 100,
          placeBet: async (a) => {
            // Use the API match_id (matchId) instead of DB row id
            const matchId = selectedMatch?.matchId || a.match_id;
            const result = await placeBet({ ...a, match_id: matchId });
            if (result.success) {
              setBettedMatchIds(prev => new Set([...prev, matchId]));
            }
            return result;
          },
        } : undefined}
        matchStats={selectedMatch ? (() => {
          const lm = liveMatches.find(m => m.id === selectedMatch.id);
          const s = lm?.stats as any;
          if (!s) return null;
          return {
            attacks_home: s.attacks_home ?? s.dangerous_attacks_home ?? undefined,
            attacks_away: s.attacks_away ?? s.dangerous_attacks_away ?? undefined,
            xG_home: s.xG_home ?? undefined,
            xG_away: s.xG_away ?? undefined,
            possession_home: s.possession_home ?? undefined,
            possession_away: s.possession_away ?? undefined,
            shots_home: s.shots_on_target_home ?? s.shots_home ?? undefined,
            shots_away: s.shots_on_target_away ?? s.shots_away ?? undefined,
          };
        })() : null}
      />

      {/* Mycroft Sports KB + Chat */}
      <MycroftSportsChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
