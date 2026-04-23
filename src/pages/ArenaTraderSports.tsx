import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, Dumbbell, Bell, BarChart3, Loader2, Brain, FlaskConical, CheckCircle2, CornerDownRight, LayoutGrid, TableProperties, Target, Trophy, RefreshCw } from 'lucide-react';
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
import ActivePositions from '@/components/dashboard/ActivePositions';
import CompactMatchTable from '@/components/dashboard/CompactMatchTable';

// Fallback mock data shown when no real data exists
const mockMatches: Match[] = [
  { id: '1', championship: 'Copa do Mundo 2026', championshipColor: 'yellow', home: 'Brasil', away: 'Argentina', homeLogo: '🇧🇷', awayLogo: '🇦🇷', scoreHome: 2, scoreAway: 1, minute: 34, period: '1º Tempo', status: 'live', mycroftStatus: 'APROVADO' },
  { id: '2', championship: 'Champions League', championshipColor: 'blue', home: 'Real Madrid', away: 'Barcelona', homeLogo: '⚪', awayLogo: '🔴', scoreHome: 0, scoreAway: 0, minute: 23, period: '1º Tempo', status: 'live', mycroftStatus: 'AGUARDAR' },
  { id: '3', championship: 'Brasileirão', championshipColor: 'green', home: 'Flamengo', away: 'Palmeiras', homeLogo: '🔴⚫', awayLogo: '🟢', scoreHome: 1, scoreAway: 1, minute: 67, period: '2º Tempo', status: 'live', mycroftStatus: 'JOGO_MORTO' },
  { id: '4', championship: 'La Liga', championshipColor: 'red', home: 'Atlético Madrid', away: 'Sevilla', homeLogo: '🔴⚪', awayLogo: '⚪🔴', scoreHome: 0, scoreAway: 1, minute: 72, period: '2º Tempo', status: 'live', mycroftStatus: 'LABAREDA' },
  { id: '5', championship: 'Europa League', championshipColor: 'blue', home: 'Braga', away: 'Ferencvaros', homeLogo: '🔴', awayLogo: '🟢', scoreHome: 2, scoreAway: 0, minute: 55, period: '2º Tempo', status: 'live', mycroftStatus: 'CUIDADO' },
];

const getChampionshipColor = (name: string): Match['championshipColor'] => {
  const lower = name.toLowerCase();
  if (lower.includes('copa')) return 'yellow';
  if (lower.includes('champions') || lower.includes('liga')) return 'blue';
  if (lower.includes('brasileir')) return 'green';
  return 'red';
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
  };
};

type StatusFilter = 'all' | 'proximos' | 'live' | 'scheduled' | 'finished' | 'simulado';

export default function ArenaTraderSports() {
  const navigate = useNavigate();
  
  const { matches: liveMatches, loading, refreshing, lastUpdated, refetch } = useLiveMatches();
  const { bankroll, loading: bankrollLoading, placeBet, cashOut, settleBets, updateInitialBalance } = useSportsBankroll();
  const { games: scheduledGames, loading: scheduledLoading } = useScheduledGames();
  const { requestPush, isSupported: pushSupported } = usePushNotifications();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedChampionships, setSelectedChampionships] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MycroftAnalysisData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [isSettling, setIsSettling] = useState(false);
  const [isAnalyzingCorners, setIsAnalyzingCorners] = useState(false);
  const [bettedMatchIds, setBettedMatchIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
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
      .slice(0, 10)
      .map(([name]) => name);
  }, [allMatches]);

  const toggleChampionship = (c: string) => {
    setSelectedChampionships(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleViewAnalysis = (matchId: string) => {
    // Navega para a página de detalhes ao vivo (análise + estatísticas + histórico em tempo real)
    navigate(`/arena-trader-sports/jogo/${matchId}`);
  };

  const filtered = useMemo(() => {
    const statusPriority: Record<string, number> = { APROVADO: 0, opportunity: 0, APROVADO_SITUACIONAL: 0, LABAREDA: 1, CUIDADO: 2, AGUARDAR: 3, analyzing: 3, JOGO_MORTO: 4, VETADO: 4, no_value: 4 };
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
        if (statusFilter !== 'all') {
          const effectiveStatus = (m.status as string) === 'halftime' ? 'live' : m.status;
          if (effectiveStatus !== statusFilter) return false;
        }
        if (selectedChampionships.length > 0 && !selectedChampionships.includes(m.championship)) return false;
        return true;
      })
      .sort((a, b) => (statusPriority[a.mycroftStatus] ?? 3) - (statusPriority[b.mycroftStatus] ?? 3));
  }, [statusFilter, selectedChampionships, allMatches]);



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
            <LiveCronToggle />
            {/* View toggle */}
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
          </div>
        </div>

        {/* Action buttons row - scrollable */}
        <div className="container mx-auto px-4 pb-3">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            <GoldButton size="sm" onClick={handleAnalyzeCorners} disabled={isAnalyzingCorners} variant="outline">
              <CornerDownRight className={cn("w-4 h-4 mr-1", isAnalyzingCorners && "animate-spin")} />
              Escanteios
            </GoldButton>
            <GoldButton size="sm" onClick={handleSettleBets} disabled={isSettling} variant="outline">
              <CheckCircle2 className={cn("w-4 h-4 mr-1", isSettling && "animate-spin")} />
              Liquidar
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => setIsChatOpen(true)}>
              <Brain className="w-4 h-4 mr-1" />
              KB & Chat
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/historico')}>
              <BarChart3 className="w-4 h-4 mr-1" />
              Histórico
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/performance')}>
              <TrendingUp className="w-4 h-4 mr-1" />
              Performance
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/historico')}>
              <Wallet className="w-4 h-4 mr-1" />
              Meus Trades
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/arena-trader-sports/ranking-mensal')}>
              <Trophy className="w-4 h-4 mr-1" />
              Ranking
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/modo-treino')}>
              <Dumbbell className="w-4 h-4 mr-1" />
              Treino
            </GoldButton>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Bankroll Widget */}
        {bankroll && !bankrollLoading && (
          <BankrollWidget bankroll={bankroll} onUpdateBalance={updateInitialBalance} />
        )}

        {/* Active Positions */}
        <ActivePositions />

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
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="proximos" className="gap-1.5">
                Próximos Jogos
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
              <TabsTrigger value="finished">Finalizados</TabsTrigger>
              <TabsTrigger value="simulado" className="gap-1">
                <FlaskConical className="w-3 h-3" />
                Simulado
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Simulation Panel - shown when "Simulado" tab is active */}
          {statusFilter === 'simulado' && (
            <SimulationPanel onFetched={refetch} />
          )}

          {statusFilter !== 'simulado' && (
            <div className="flex flex-wrap gap-2">
              {championships.map(c => (
                <button
                  key={c}
                  onClick={() => toggleChampionship(c)}
                  className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                    selectedChampionships.includes(c)
                      ? 'border-success bg-success/10 text-success'
                      : 'border-border bg-secondary/30 text-muted-foreground hover:border-muted-foreground'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
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
        {loading ? (
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
            className="flex flex-col items-center justify-center py-20 text-center space-y-4"
          >
            <span className="text-6xl">⚽</span>
            <h2 className="font-orbitron text-xl text-foreground">Nenhum jogo ao vivo agora</h2>
            <p className="text-muted-foreground text-sm">Próximos jogos começam em 2h30min</p>
            <GoldButton size="sm" onClick={() => requestPush()}>
              <Bell className="w-4 h-4 mr-1" />
              Ativar Notificações
            </GoldButton>
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
