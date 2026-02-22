import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, TrendingUp, TrendingDown, BarChart3, Target, AlertTriangle, PartyPopper, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GoldButton from '@/components/game/GoldButton';
import SignalCard from '@/components/historico/SignalCard';
import StatsCard from '@/components/historico/StatsCard';
import WinRateChart from '@/components/historico/WinRateChart';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useSignalHistory } from '@/hooks/useSignalHistory';

// ── Types ──
export interface Signal {
  id: string;
  date: string;
  verdict: 'APROVADO' | 'VETADO' | 'AGUARDAR';
  match: string;
  championship: string;
  market: string;
  odd: number;
  confidence: number;
  userEntered: boolean;
  stakeAmount?: number;
  result?: 'GREEN' | 'RED' | 'PENDING';
  profit?: number;
  profitPercent?: number;
  missedProfit?: number;
  reason?: string;
  followedAdvice?: boolean;
}

// ── Mock Data (fallback) ──
const mockSignals: Signal[] = [
  { id: '1', date: '2026-02-19T14:32:00', verdict: 'APROVADO', match: 'Brasil vs Argentina', championship: 'Copa do Mundo', market: 'Over 0.5 HT', odd: 1.95, confidence: 78, userEntered: true, stakeAmount: 10, result: 'GREEN', profit: 9.50, profitPercent: 95 },
  { id: '2', date: '2026-02-18T20:15:00', verdict: 'VETADO', match: 'Flamengo vs Palmeiras', championship: 'Brasileirão', market: 'BTTS', odd: 1.70, confidence: 35, userEntered: false, reason: 'xG insuficiente, jogo frio', followedAdvice: true },
  { id: '3', date: '2026-02-17T16:45:00', verdict: 'APROVADO', match: 'Real Madrid vs Barcelona', championship: 'Champions League', market: 'Over 1.5', odd: 1.85, confidence: 82, userEntered: false, result: 'GREEN', missedProfit: 8.50 },
  { id: '4', date: '2026-02-17T14:00:00', verdict: 'APROVADO', match: 'Liverpool vs Man City', championship: 'Champions League', market: 'BTTS', odd: 1.75, confidence: 71, userEntered: true, stakeAmount: 15, result: 'GREEN', profit: 11.25, profitPercent: 75 },
  { id: '5', date: '2026-02-16T21:00:00', verdict: 'APROVADO', match: 'Bayern vs Dortmund', championship: 'Champions League', market: 'Over 2.5', odd: 1.90, confidence: 80, userEntered: true, stakeAmount: 10, result: 'RED', profit: -10, profitPercent: -100 },
  { id: '6', date: '2026-02-16T18:30:00', verdict: 'AGUARDAR', match: 'Napoli vs Inter', championship: 'Champions League', market: 'Under 2.5', odd: 1.60, confidence: 55, userEntered: false, result: 'PENDING' },
  { id: '7', date: '2026-02-15T20:00:00', verdict: 'APROVADO', match: 'Corinthians vs São Paulo', championship: 'Brasileirão', market: 'Over 0.5 HT', odd: 2.00, confidence: 74, userEntered: true, stakeAmount: 10, result: 'GREEN', profit: 10, profitPercent: 100 },
  { id: '8', date: '2026-02-14T16:00:00', verdict: 'VETADO', match: 'Atlético MG vs Cruzeiro', championship: 'Brasileirão', market: 'Over 1.5 HT', odd: 2.50, confidence: 30, userEntered: false, reason: 'Jogo muito equilibrado, sem pressão clara', followedAdvice: false, result: 'GREEN', missedProfit: 0 },
  { id: '9', date: '2026-02-13T21:00:00', verdict: 'APROVADO', match: 'PSG vs Marseille', championship: 'La Liga', market: 'PSG Vencer HT', odd: 1.65, confidence: 85, userEntered: true, stakeAmount: 20, result: 'GREEN', profit: 13, profitPercent: 65 },
  { id: '10', date: '2026-02-12T18:00:00', verdict: 'APROVADO', match: 'Boca vs River', championship: 'Copa do Mundo', market: 'Over 2.5', odd: 2.40, confidence: 70, userEntered: true, stakeAmount: 10, result: 'GREEN', profit: 14, profitPercent: 140 },
  { id: '11', date: '2026-02-11T20:30:00', verdict: 'APROVADO', match: 'Chelsea vs Arsenal', championship: 'Champions League', market: 'BTTS', odd: 1.80, confidence: 76, userEntered: true, stakeAmount: 10, result: 'RED', profit: -10, profitPercent: -100 },
  { id: '12', date: '2026-02-10T15:00:00', verdict: 'APROVADO', match: 'Juventus vs AC Milan', championship: 'Champions League', market: 'Under 2.5', odd: 1.70, confidence: 68, userEntered: true, stakeAmount: 10, result: 'GREEN', profit: 7, profitPercent: 70 },
];

// Map real user_actions to Signal format
const mapActionToSignal = (action: any): Signal => ({
  id: action.id,
  date: action.created_at,
  verdict: (action.analysis?.verdict || 'APROVADO') as Signal['verdict'],
  match: action.analysis?.match_id || 'Jogo desconhecido',
  championship: '',
  market: action.analysis?.market || '',
  odd: action.analysis?.odd || 0,
  confidence: action.analysis?.confidence || 0,
  userEntered: action.action === 'entered',
  stakeAmount: action.stake_amount || undefined,
  result: action.result ? (action.result.toUpperCase() as Signal['result']) : undefined,
  profit: action.profit_loss || undefined,
  profitPercent: action.stake_amount && action.profit_loss ? Math.round((action.profit_loss / action.stake_amount) * 100) : undefined,
});

const computeStats = (signals: Signal[]) => {
  const approved = signals.filter(s => s.verdict === 'APROVADO');
  const withResult = approved.filter(s => s.result && s.result !== 'PENDING');
  const green = withResult.filter(s => s.result === 'GREEN').length;
  const red = withResult.filter(s => s.result === 'RED').length;
  const winRate = withResult.length > 0 ? Math.round((green / withResult.length) * 100) : 0;
  const totalPL = signals.reduce((sum, s) => sum + (s.profit ?? 0), 0);
  const missedTotal = signals.filter(s => !s.userEntered && s.result === 'GREEN').reduce((sum, s) => sum + (s.missedProfit ?? 0), 0);
  const notFollowed = signals.filter(s => s.verdict === 'APROVADO' && !s.userEntered && s.result === 'GREEN').length;
  const totalApprovedNotFollowed = signals.filter(s => s.verdict === 'APROVADO' && !s.userEntered).length;
  return { totalSignals: signals.length, green, red, winRate, totalPL, missedTotal, notFollowed, totalApprovedNotFollowed };
};

type VerdictFilter = 'all' | 'APROVADO' | 'VETADO' | 'AGUARDAR';
type PeriodFilter = '7d' | '30d' | '90d' | 'all';
type ResultFilter = 'all' | 'GREEN' | 'RED' | 'PENDING';

const championships = ['Copa do Mundo', 'Champions League', 'Brasileirão', 'La Liga'];

export default function Historico() {
  const navigate = useNavigate();
  const { actions, loading } = useSignalHistory();
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all');
  const [championshipFilter, setChampionshipFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');

  // Use real data if available, fallback to mock
  const allSignals = useMemo(() => {
    if (actions.length > 0) {
      return actions.map(mapActionToSignal);
    }
    return mockSignals;
  }, [actions]);

  const filtered = useMemo(() => {
    return allSignals.filter(s => {
      if (verdictFilter !== 'all' && s.verdict !== verdictFilter) return false;
      if (championshipFilter !== 'all' && s.championship !== championshipFilter) return false;
      if (resultFilter !== 'all' && s.result !== resultFilter) return false;
      if (periodFilter !== 'all') {
        const days = periodFilter === '7d' ? 7 : periodFilter === '30d' ? 30 : 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        if (new Date(s.date) < cutoff) return false;
      }
      return true;
    });
  }, [verdictFilter, periodFilter, championshipFilter, resultFilter, allSignals]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  const exportCSV = () => {
    const header = 'Data,Jogo,Campeonato,Mercado,Odd,Veredito,Entrei,Resultado,Lucro\n';
    const rows = filtered.map(s => {
      const date = new Date(s.date).toLocaleDateString('pt-BR');
      return `${date},${s.match},${s.championship},${s.market},${s.odd},${s.verdict},${s.userEntered ? 'SIM' : 'NAO'},${s.result ?? '-'},${s.profit ?? s.missedProfit ? `${(s.profit ?? 0) > 0 ? '+' : ''}${s.profit ?? 0}` : '-'}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historico-sinais.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'CSV exportado!', description: 'Arquivo baixado com sucesso.' });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/dashboard')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-orbitron text-sm md:text-base font-bold text-primary">📊 HISTÓRICO DE SINAIS</h1>
          </div>
          <GoldButton size="sm" variant="outline" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </GoldButton>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 space-y-5 max-w-4xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-orbitron">Carregando histórico...</p>
          </div>
        ) : (
          <>
            {/* Insight Banner */}
            {stats.notFollowed >= 3 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-destructive">Oportunidades perdidas!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Você não seguiu {stats.totalApprovedNotFollowed} sinais aprovados. Desses, {stats.notFollowed} deram GREEN.
                    Perdeu R$ {stats.missedTotal.toFixed(2)} em lucro. Disciplina = Lucro!
                  </p>
                </div>
              </motion.div>
            )}

            {stats.winRate >= 70 && stats.totalSignals >= 5 && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-success/10 border border-success/30 rounded-xl p-4 flex items-start gap-3">
                <PartyPopper className="w-5 h-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-success">Performance excelente!</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Win rate de {stats.winRate}%! Você está seguindo o sistema. Continue assim!
                  </p>
                </div>
              </motion.div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatsCard label="Total Sinais" value={stats.totalSignals} icon={<BarChart3 className="w-4 h-4" />} />
              <StatsCard label="Green / Red" value={`${stats.green} / ${stats.red}`} icon={<Target className="w-4 h-4" />} sub={<div className="w-full bg-secondary rounded-full h-1.5 mt-1"><div className="bg-success h-1.5 rounded-full" style={{ width: `${stats.winRate}%` }} /></div>} />
              <StatsCard label="Win Rate" value={`${stats.winRate}%`} icon={<TrendingUp className="w-4 h-4" />} valueColor={stats.winRate >= 60 ? 'text-success' : stats.winRate >= 50 ? 'text-primary' : 'text-destructive'} />
              <StatsCard label="P&L" value={`${stats.totalPL >= 0 ? '+' : ''}R$ ${stats.totalPL.toFixed(2)}`} icon={stats.totalPL >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} valueColor={stats.totalPL >= 0 ? 'text-success' : 'text-destructive'} />
            </div>

            {/* Win Rate Chart */}
            <WinRateChart signals={filtered} />

            {/* Filters */}
            <div className="space-y-3">
              <Tabs value={verdictFilter} onValueChange={v => setVerdictFilter(v as VerdictFilter)}>
                <TabsList className="bg-secondary/50">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="APROVADO">Aprovados</TabsTrigger>
                  <TabsTrigger value="VETADO">Vetados</TabsTrigger>
                  <TabsTrigger value="AGUARDAR">Aguardar</TabsTrigger>
                </TabsList>
              </Tabs>
              <div className="flex flex-wrap gap-2">
                <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value as PeriodFilter)} className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="all">Todo período</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                  <option value="90d">Últimos 90 dias</option>
                </select>
                <select value={championshipFilter} onChange={e => setChampionshipFilter(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="all">Todos campeonatos</option>
                  {championships.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={resultFilter} onChange={e => setResultFilter(e.target.value as ResultFilter)} className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="all">Todos resultados</option>
                  <option value="GREEN">Green</option>
                  <option value="RED">Red</option>
                  <option value="PENDING">Pendente</option>
                </select>
              </div>
            </div>

            {/* Signal List */}
            <div className="space-y-3">
              <AnimatePresence>
                {filtered.length > 0 ? (
                  filtered.map((signal, i) => (
                    <SignalCard key={signal.id} signal={signal} index={i} />
                  ))
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                    <span className="text-5xl">📊</span>
                    <h2 className="font-orbitron text-lg text-foreground">Nenhum sinal registrado</h2>
                    <p className="text-sm text-muted-foreground">Quando Mycroft detectar oportunidades, elas aparecerão aqui.</p>
                    <GoldButton size="sm" onClick={() => navigate('/dashboard')}>Voltar ao Dashboard</GoldButton>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
