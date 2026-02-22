import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, Dumbbell, Bell, BarChart3, Loader2, Brain } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MatchCard, { type Match } from '@/components/dashboard/MatchCard';
import AnalysisModal, { type MycroftAnalysisData } from '@/components/dashboard/AnalysisModal';
import GoldButton from '@/components/game/GoldButton';
import MycroftSportsChat from '@/components/arena-trader/MycroftSportsChat';
import { cn } from '@/lib/utils';
import { useLiveMatches, type LiveMatch } from '@/hooks/useLiveMatches';

// Fallback mock data shown when no real data exists
const mockMatches: Match[] = [
  { id: '1', championship: 'Copa do Mundo 2026', championshipColor: 'yellow', home: 'Brasil', away: 'Argentina', homeLogo: '🇧🇷', awayLogo: '🇦🇷', scoreHome: 2, scoreAway: 1, minute: 34, period: '1º Tempo', status: 'live', mycroftStatus: 'APROVADO' },
  { id: '2', championship: 'Champions League', championshipColor: 'blue', home: 'Real Madrid', away: 'Barcelona', homeLogo: '⚪', awayLogo: '🔴', scoreHome: 0, scoreAway: 0, minute: 23, period: '1º Tempo', status: 'live', mycroftStatus: 'AGUARDAR' },
  { id: '3', championship: 'Brasileirão', championshipColor: 'green', home: 'Flamengo', away: 'Palmeiras', homeLogo: '🔴⚫', awayLogo: '🟢', scoreHome: 1, scoreAway: 1, minute: 67, period: '2º Tempo', status: 'live', mycroftStatus: 'VETADO' },
  { id: '4', championship: 'La Liga', championshipColor: 'red', home: 'Atlético Madrid', away: 'Sevilla', homeLogo: '🔴⚪', awayLogo: '⚪🔴', scoreHome: 0, scoreAway: 0, minute: 0, period: 'Início 21:00', status: 'scheduled', mycroftStatus: 'VETADO' },
  { id: '5', championship: 'Copa do Mundo 2026', championshipColor: 'yellow', home: 'Alemanha', away: 'França', homeLogo: '🇩🇪', awayLogo: '🇫🇷', scoreHome: 3, scoreAway: 2, minute: 90, period: 'Encerrado', status: 'finished', mycroftStatus: 'VETADO' },
];

const getChampionshipColor = (name: string): Match['championshipColor'] => {
  const lower = name.toLowerCase();
  if (lower.includes('copa')) return 'yellow';
  if (lower.includes('champions') || lower.includes('liga')) return 'blue';
  if (lower.includes('brasileir')) return 'green';
  return 'red';
};

const mapLiveMatchToMatch = (lm: LiveMatch): Match => ({
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
  mycroftStatus: (lm.mycroft_status === 'analyzing' ? 'AGUARDAR' : lm.mycroft_status === 'opportunity' ? 'APROVADO' : lm.mycroft_status === 'no_value' ? 'VETADO' : (lm.mycroft_status || 'VETADO')) as Match['mycroftStatus'],
});

type StatusFilter = 'all' | 'live' | 'scheduled' | 'finished';

export default function ArenaTraderSports() {
  const navigate = useNavigate();
  const { matches: liveMatches, loading } = useLiveMatches();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedChampionships, setSelectedChampionships] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MycroftAnalysisData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Use real data if available, fallback to mock
  const allMatches = useMemo(() => {
    if (liveMatches.length > 0) {
      return liveMatches.map(mapLiveMatchToMatch);
    }
    return mockMatches;
  }, [liveMatches]);

  // Dynamic championships from real data
  const championships = useMemo(() => {
    const counts = new Map<string, number>();
    allMatches.forEach(m => {
      counts.set(m.championship, (counts.get(m.championship) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name]) => name);
  }, [allMatches]);

  const toggleChampionship = (c: string) => {
    setSelectedChampionships(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleViewAnalysis = (matchId: string) => {
    const match = allMatches.find(m => m.id === matchId);
    if (!match) return;

    // Find the corresponding LiveMatch to get its mycroft_analysis
    const liveMatch = liveMatches.find(lm => lm.id === matchId);
    const analysis = liveMatch?.mycroft_analysis ? {
      id: liveMatch.mycroft_analysis.id,
      verdict: liveMatch.mycroft_analysis.verdict,
      market: liveMatch.mycroft_analysis.market,
      odd: liveMatch.mycroft_analysis.odd,
      confidence: liveMatch.mycroft_analysis.confidence,
      thesis: liveMatch.mycroft_analysis.thesis,
      fundamentation: liveMatch.mycroft_analysis.fundamentation,
      risk_management: liveMatch.mycroft_analysis.risk_management,
      alerts: liveMatch.mycroft_analysis.alerts || [],
    } as MycroftAnalysisData : null;

    setSelectedMatch(match);
    setSelectedAnalysis(analysis);
    setIsModalOpen(true);
  };

  const filtered = useMemo(() => {
    return allMatches.filter(m => {
      if (statusFilter !== 'all') {
        // Map halftime to live for filtering
        const effectiveStatus = (m.status as string) === 'halftime' ? 'live' : m.status;
        if (effectiveStatus !== statusFilter) return false;
      }
      if (selectedChampionships.length > 0 && !selectedChampionships.includes(m.championship)) return false;
      return true;
    });
  }, [statusFilter, selectedChampionships, allMatches]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-orbitron text-base md:text-lg font-bold text-primary truncate">
            Arena Trader Sports
          </h1>

          <div className="hidden md:flex items-center gap-5">
            <div className="flex items-center gap-1.5 text-sm">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Banca:</span>
              <span className="font-orbitron font-bold text-foreground">R$ 500,00</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-muted-foreground">Win Rate:</span>
              <span className="font-orbitron font-bold text-success">68%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <GoldButton size="sm" variant="outline" onClick={() => setIsChatOpen(true)}>
              <Brain className="w-4 h-4 mr-1" />
              KB & Chat
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/historico')}>
              <BarChart3 className="w-4 h-4 mr-1" />
              Histórico
            </GoldButton>
            <GoldButton size="sm" variant="outline" onClick={() => navigate('/modo-treino')}>
              <Dumbbell className="w-4 h-4 mr-1" />
              Treino
            </GoldButton>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-4 space-y-3">
        <Tabs value={statusFilter} onValueChange={v => setStatusFilter(v as StatusFilter)}>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="live">Ao Vivo</TabsTrigger>
            <TabsTrigger value="scheduled">Pré-Live</TabsTrigger>
            <TabsTrigger value="finished">Finalizados</TabsTrigger>
          </TabsList>
        </Tabs>

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
      </div>

      {/* Grid */}
      <main className="container mx-auto px-4 pb-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-orbitron">Carregando jogos...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((match, i) => (
              <MatchCard
                key={match.id}
                match={match}
                index={i}
                onAnalysisClick={handleViewAnalysis}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center space-y-4"
          >
            <span className="text-6xl">⚽</span>
            <h2 className="font-orbitron text-xl text-foreground">Nenhum jogo ao vivo agora</h2>
            <p className="text-muted-foreground text-sm">Próximos jogos começam em 2h30min</p>
            <GoldButton size="sm">
              <Bell className="w-4 h-4 mr-1" />
              Ativar Notificações
            </GoldButton>
          </motion.div>
        )}
      </main>

      {/* Analysis Modal - reads from Supabase, no edge function calls */}
      <AnalysisModal
        match={selectedMatch}
        analysis={selectedAnalysis}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Mycroft Sports KB + Chat */}
      <MycroftSportsChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
    </div>
  );
}
