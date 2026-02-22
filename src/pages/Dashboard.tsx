import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, Dumbbell, Bell, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MatchCard, { type Match } from '@/components/dashboard/MatchCard';
import AnalysisModal from '@/components/dashboard/AnalysisModal';
import GoldButton from '@/components/game/GoldButton';
import { cn } from '@/lib/utils';

const mockMatches: Match[] = [
  {
    id: '1',
    championship: 'Copa do Mundo 2026',
    championshipColor: 'yellow',
    home: 'Brasil',
    away: 'Argentina',
    homeLogo: '🇧🇷',
    awayLogo: '🇦🇷',
    scoreHome: 2,
    scoreAway: 1,
    minute: 34,
    period: '1º Tempo',
    status: 'live',
    mycroftStatus: 'opportunity',
  },
  {
    id: '2',
    championship: 'Champions League',
    championshipColor: 'blue',
    home: 'Real Madrid',
    away: 'Barcelona',
    homeLogo: '⚪',
    awayLogo: '🔴',
    scoreHome: 0,
    scoreAway: 0,
    minute: 23,
    period: '1º Tempo',
    status: 'live',
    mycroftStatus: 'analyzing',
  },
  {
    id: '3',
    championship: 'Brasileirão',
    championshipColor: 'green',
    home: 'Flamengo',
    away: 'Palmeiras',
    homeLogo: '🔴⚫',
    awayLogo: '🟢',
    scoreHome: 1,
    scoreAway: 1,
    minute: 67,
    period: '2º Tempo',
    status: 'live',
    mycroftStatus: 'no_value',
  },
  {
    id: '4',
    championship: 'La Liga',
    championshipColor: 'red',
    home: 'Atlético Madrid',
    away: 'Sevilla',
    homeLogo: '🔴⚪',
    awayLogo: '⚪🔴',
    scoreHome: 0,
    scoreAway: 0,
    minute: 0,
    period: 'Início 21:00',
    status: 'scheduled',
    mycroftStatus: 'no_value',
  },
  {
    id: '5',
    championship: 'Copa do Mundo 2026',
    championshipColor: 'yellow',
    home: 'Alemanha',
    away: 'França',
    homeLogo: '🇩🇪',
    awayLogo: '🇫🇷',
    scoreHome: 3,
    scoreAway: 2,
    minute: 90,
    period: 'Encerrado',
    status: 'finished',
    mycroftStatus: 'no_value',
  },
];

const championships = ['Copa do Mundo', 'Champions League', 'Brasileirão', 'La Liga'];

type StatusFilter = 'all' | 'live' | 'scheduled' | 'finished';

export default function Dashboard() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedChampionships, setSelectedChampionships] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toggleChampionship = (c: string) => {
    setSelectedChampionships(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const handleViewAnalysis = (matchId: string) => {
    const match = mockMatches.find(m => m.id === matchId);
    if (match) {
      setSelectedMatch(match);
      setIsModalOpen(true);
    }
  };

  const filtered = useMemo(() => {
    return mockMatches.filter(m => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (selectedChampionships.length > 0 && !selectedChampionships.some(c => m.championship.includes(c))) return false;
      return true;
    });
  }, [statusFilter, selectedChampionships]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <h1 className="font-orbitron text-base md:text-lg font-bold text-primary truncate">
            Arena Trader Esportivo
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
        {filtered.length > 0 ? (
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

      {/* Analysis Modal */}
      <AnalysisModal
        match={selectedMatch}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
