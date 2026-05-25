import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, TrendingUp, TrendingDown, BarChart3, Target, AlertTriangle, Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import GoldButton from '@/components/game/GoldButton';
import SignalCard from '@/components/historico/SignalCard';
import StatsCard from '@/components/historico/StatsCard';
import WinRateChart from '@/components/historico/WinRateChart';
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
];

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
  const notFollowed = signals.filter(s => s.verdict === 'APROVADO' && !s.userEntered && s.result === 'GREEN').length;
  return { totalSignals: signals.length, green, red, winRate, totalPL, notFollowed };
};

export default function Historico() {
  const navigate = useNavigate();
  const { actions, loading } = useSignalHistory();
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'APROVADO' | 'VETADO' | 'AGUARDAR'>('all');

  const allSignals = useMemo(() => actions.length > 0 ? actions.map(mapActionToSignal) : mockSignals, [actions]);

  const filtered = useMemo(() => {
    return allSignals.filter(s => verdictFilter === 'all' || s.verdict === verdictFilter);
  }, [verdictFilter, allSignals]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  const exportCSV = () => {
    const header = 'Data,Jogo,Mercado,Odd,Veredito,Entrei,Resultado,Lucro\n';
    const rows = filtered.map(s => `${new Date(s.date).toLocaleDateString('pt-BR')},${s.match},${s.market},${s.odd},${s.verdict},${s.userEntered ? 'SIM' : 'NAO'},${s.result ?? '-'},${s.profit ?? '-'}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'historico.csv'; a.click();
    toast({ title: 'CSV exportado!' });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/punter/menu')} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-orbitron text-lg font-bold text-primary">Histórico</h1>
          </div>
          <GoldButton size="sm" variant="outline" onClick={exportCSV}><Download className="w-4 h-4 mr-1.5" /> Exportar</GoldButton>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground font-orbitron">Carregando histórico...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard label="Entradas" value={stats.totalSignals} icon={<BarChart3 />} />
              <StatsCard label="Win Rate" value={`${stats.winRate}%`} icon={<Target />} valueColor="text-yellow-500" />
              <StatsCard label="Resultado" value={`${stats.totalPL >= 0 ? '+' : ''}${stats.totalPL} BC`} icon={<TrendingUp />} valueColor={stats.totalPL >= 0 ? "text-green-500" : "text-red-500"} />
              <StatsCard label="Perdidos" value={stats.notFollowed} icon={<AlertTriangle />} valueColor="text-orange-500" />
            </div>

            <WinRateChart signals={allSignals} />

            <div className="space-y-4">
              <Tabs value={verdictFilter} onValueChange={v => setVerdictFilter(v as any)}>
                <TabsList className="bg-secondary/50">
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="APROVADO">Aprovados</TabsTrigger>
                  <TabsTrigger value="VETADO">Jogo Morto</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                <AnimatePresence mode="popLayout">
                  {filtered.length > 0 ? (
                    filtered.map((signal, i) => (
                      <SignalCard key={signal.id} signal={signal} index={i} />
                    ))
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="col-span-full py-20 text-center space-y-4 bg-card border border-dashed border-border rounded-2xl">
                      <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30" />
                      <h2 className="font-orbitron text-lg">Nenhum entrada</h2>
                      <GoldButton size="sm" onClick={() => navigate('/punter/menu')}>Voltar</GoldButton>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}