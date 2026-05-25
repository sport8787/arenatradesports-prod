import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Wallet, Target, Gavel, Undo2, Ban, CalendarDays, Download, FileDown } from 'lucide-react';
import BetImportPanel from '@/components/punter/BetImportPanel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import GoldButton from '@/components/game/GoldButton';
import ManualSettleModal from '@/components/bet-history/ManualSettleModal';
import PeriodFilter, { PeriodOption, getPeriodStartDate } from '@/components/bet-history/PeriodFilter';
import LeagueFilter, { extractLeague } from '@/components/bet-history/LeagueFilter';
import PendingDateSort, { PendingSortOption } from '@/components/bet-history/PendingDateSort';
import BankrollEvolutionChart from '@/components/bet-history/BankrollEvolutionChart';
import AdvancedFilters from '@/components/bet-history/AdvancedFilters';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useBankroll } from '@/hooks/useBankroll';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { generateBetReportPdf } from '@/utils/generateBetReportPdf';

interface Bet {
  id: string;
  match_name: string;
  market: string;
  odd: number;
  stake: number;
  status: string;
  result?: string;
  profit_loss: number | null;
  placed_at: string;
  settled_at?: string;
  source: 'sports' | 'punter';
  score_home?: number | null;
  score_away?: number | null;
  red_card_home?: boolean;
  red_card_away?: boolean;
  thesis?: string | null;
  commence_time?: string | null;
  league?: string;
  confidence?: number | null;
  categoria?: 'A' | 'B' | 'C';
}

function extractScoreFromThesis(thesis: string | null | undefined): number | null {
  if (!thesis) return null;
  // Captura padrões "Score 71/100", "Score: 89", "score 100/100"
  const m = thesis.match(/score[:\s]+(\d{1,3})(?:\/100)?/i);
  if (!m) return null;
  const v = parseInt(m[1], 10);
  return Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : null;
}

function deriveCategoria(confidence: number | null | undefined): 'A' | 'B' | 'C' {
  if (confidence == null) return 'C';
  if (confidence >= 80) return 'A';
  if (confidence >= 65) return 'B';
  return 'C';
}

type FilterStatus = 'all' | 'pending' | 'green' | 'red' | 'cancelled';

export default function BetHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bankroll, settleBets } = useBankroll();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [period, setPeriod] = useState<PeriodOption>('all');
  const [league, setLeague] = useState('all');
  const [pendingSort, setPendingSort] = useState<PendingSortOption>('date_asc');
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [advancedFiltered, setAdvancedFiltered] = useState<Bet[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchBets();
  }, [user]);

  const fetchBets = async () => {
    if (!user) return;
    setLoading(true);

    const { data: punterData } = await supabase
      .from('virtual_bets_punter')
      .select('*, punter_analyses!virtual_bets_punter_analysis_id_fkey(league, confidence)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const punterBets: Bet[] = (punterData || []).map((b: any) => {
      // Prioriza confidence da analysis vinculada; se ausente (ex.: Plano Favorito grava só thesis),
      // extrai o score do texto da tese para manter a categoria CAT consistente com o entrada aprovado.
      const analysisConf = b.punter_analyses?.confidence ?? null;
      const thesisScore = extractScoreFromThesis(b.thesis);
      const conf = analysisConf ?? thesisScore;
      return {
        id: b.id,
        match_name: b.match_name || b.match_id,
        market: b.market,
        odd: parseFloat(b.odd),
        stake: parseFloat(b.stake),
        status: b.status,
        result: b.result,
        profit_loss: b.profit_loss ? parseFloat(b.profit_loss) : null,
        placed_at: b.created_at,
        settled_at: b.status === 'settled' ? b.updated_at : undefined,
        source: 'punter' as const,
        score_home: b.score_home,
        score_away: b.score_away,
        red_card_home: b.red_card_home,
        red_card_away: b.red_card_away,
        thesis: b.thesis,
        commence_time: b.commence_time,
        league: b.punter_analyses?.league || undefined,
        confidence: conf,
        categoria: deriveCategoria(conf),
      };
    });

    setBets(punterBets.sort((a, b) =>
      new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime()
    ));
    setLoading(false);
  };

  const handleSettle = async () => {
    setSettling(true);
    const result = await settleBets();
    if (result.success) {
      await fetchBets();
    }
    setSettling(false);
  };

  const handleManualSettle = useCallback(async (data: {
    betId: string;
    scoreHome: number;
    scoreAway: number;
    redCardHome: boolean;
    redCardAway: boolean;
    source: 'sports' | 'punter';
  }) => {
    if (!user || !bankroll) return;

    const bet = bets.find(b => b.id === data.betId);
    if (!bet) return;

    const market = bet.market.toLowerCase().trim();
    const h = data.scoreHome;
    const a = data.scoreAway;
    const totalGoals = h + a;
    let isGreen = false;

    const teams = bet.match_name.split(' vs ');
    const homeTeamNorm = (teams[0] || '').toLowerCase().trim();
    const awayTeamNorm = (teams[1] || '').toLowerCase().trim();

    if (market === 'casa' || market === 'home' || market === '1') {
      isGreen = h > a;
    } else if (market === 'fora' || market === 'away' || market === '2') {
      isGreen = a > h;
    } else if (market === 'empate' || market === 'draw' || market === 'x') {
      isGreen = h === a;
    } else if (market.includes('over')) {
      const line = parseFloat(market.replace(/[^0-9.]/g, '')) || 2.5;
      isGreen = totalGoals > line;
    } else if (market.includes('under')) {
      const line = parseFloat(market.replace(/[^0-9.]/g, '')) || 2.5;
      isGreen = totalGoals < line;
    } else if (market.includes('btts') || market.includes('ambas')) {
      isGreen = h > 0 && a > 0;
    } else if (homeTeamNorm.includes(market) || market.includes(homeTeamNorm) ||
               homeTeamNorm.split(' ').some(w => w.length > 3 && market.includes(w))) {
      isGreen = h > a;
    } else if (awayTeamNorm.includes(market) || market.includes(awayTeamNorm) ||
               awayTeamNorm.split(' ').some(w => w.length > 3 && market.includes(w))) {
      isGreen = a > h;
    } else {
      isGreen = h > a;
    }

    const betResult = isGreen ? 'green' : 'red';
    const profitLoss = isGreen
      ? +(bet.stake * (bet.odd - 1)).toFixed(2)
      : -bet.stake;

    const table = data.source === 'punter' ? 'virtual_bets_punter' : 'virtual_bets';

    const updatePayload = data.source === 'punter'
      ? {
          status: 'settled',
          result: betResult,
          profit_loss: profitLoss,
          score_home: h,
          score_away: a,
          red_card_home: data.redCardHome,
          red_card_away: data.redCardAway,
          updated_at: new Date().toISOString(),
        }
      : {
          status: betResult,
          profit_loss: profitLoss,
          score_home: h,
          score_away: a,
          red_card_home: data.redCardHome,
          red_card_away: data.redCardAway,
          settled_at: new Date().toISOString(),
        };

    const { error: betError } = await supabase
      .from(table)
      .update(updatePayload)
      .eq('id', data.betId);

    if (betError) {
      toast.error('Erro ao liquidar entrada');
      console.error(betError);
      return;
    }

    const balanceChange = isGreen ? bet.stake * bet.odd : 0;

    await supabase
      .from('user_bankroll')
      .update({
        balance: +(bankroll.balance + balanceChange).toFixed(2),
        total_profit: +(bankroll.total_profit + profitLoss).toFixed(2),
        green_bets: bankroll.green_bets + (isGreen ? 1 : 0),
        red_bets: bankroll.red_bets + (isGreen ? 0 : 1),
        win_rate: +((bankroll.green_bets + (isGreen ? 1 : 0)) / (bankroll.green_bets + bankroll.red_bets + 1) * 100).toFixed(2),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (data.source === 'punter') {
      const matchId = bet.match_name.replace(/ vs /g, '_').replace(/ /g, '_');
      await supabase
        .from('punter_signals')
        .update({
          result: betResult,
          status: 'settled',
          profit_loss: isGreen ? +(bet.odd * 3).toFixed(2) : -3,
          score_home: h,
          score_away: a,
          red_card_home: data.redCardHome,
          red_card_away: data.redCardAway,
          resulted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .ilike('match_id', `%${matchId.split('_').slice(0, 2).join('%')}%`)
        .eq('status', 'pending');
    }

    toast.success(`Entrada liquidada: ${betResult.toUpperCase()}`);
    await fetchBets();
  }, [user, bankroll, bets]);

  const revertToPending = useCallback(async (bet: Bet) => {
    if (!user || !bankroll) return;

    const table = bet.source === 'punter' ? 'virtual_bets_punter' : 'virtual_bets';
    const wasGreen = bet.result === 'green' || bet.status === 'green';

    const balanceChange = wasGreen ? -(bet.stake * bet.odd) : 0;
    const profitReverse = -(bet.profit_loss || 0);

    const updatePayload = bet.source === 'punter'
      ? { status: 'pending', result: null, profit_loss: null, score_home: null, score_away: null, red_card_home: false, red_card_away: false, updated_at: new Date().toISOString() }
      : { status: 'pending', profit_loss: null, score_home: null, score_away: null, red_card_home: false, red_card_away: false, settled_at: null };

    const { error } = await supabase.from(table).update(updatePayload).eq('id', bet.id);
    if (error) {
      toast.error('Erro ao reverter entrada');
      console.error(error);
      return;
    }

    await supabase
      .from('user_bankroll')
      .update({
        balance: +(bankroll.balance + balanceChange).toFixed(2),
        total_profit: +(bankroll.total_profit + profitReverse).toFixed(2),
        green_bets: bankroll.green_bets - (wasGreen ? 1 : 0),
        red_bets: bankroll.red_bets - (wasGreen ? 0 : 1),
        win_rate: (bankroll.green_bets + bankroll.red_bets - 1) > 0
          ? +((bankroll.green_bets - (wasGreen ? 1 : 0)) / (bankroll.green_bets + bankroll.red_bets - 1) * 100).toFixed(2)
          : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (bet.source === 'punter') {
      const matchId = bet.match_name.replace(/ vs /g, '_').replace(/ /g, '_');
      await supabase
        .from('punter_signals')
        .update({
          result: null,
          status: 'pending',
          profit_loss: null,
          score_home: null,
          score_away: null,
          red_card_home: false,
          red_card_away: false,
          resulted_at: null,
          updated_at: new Date().toISOString(),
        })
        .ilike('match_id', `%${matchId.split('_').slice(0, 2).join('%')}%`)
        .eq('status', 'settled');
    }

    toast.success('Entrada revertida para pendente');
    await fetchBets();
  }, [user, bankroll, bets]);

  const cancelBet = useCallback(async (bet: Bet) => {
    if (!user || !bankroll) return;

    const table = bet.source === 'punter' ? 'virtual_bets_punter' : 'virtual_bets';
    const bankrollTable = bet.source === 'punter' ? 'user_bankroll' : 'sports_bankroll';

    const { error } = await supabase
      .from(table)
      .update({ status: 'cancelled', updated_at: new Date().toISOString() } as any)
      .eq('id', bet.id);

    if (error) {
      toast.error('Erro ao cancelar entrada');
      console.error(error);
      return;
    }

    await supabase
      .from(bankrollTable as any)
      .update({
        balance: bankroll.balance + bet.stake,
        total_staked: Math.max(0, bankroll.total_staked - bet.stake),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', user.id);

    toast.success(`Entrada cancelada — R$ ${bet.stake.toFixed(2)} estornado`);
    await fetchBets();
  }, [user, bankroll]);

  const periodFiltered = useMemo(() => {
    const start = getPeriodStartDate(period);
    if (!start) return bets;
    return bets.filter(b => new Date(b.placed_at) >= start);
  }, [bets, period]);

  const leagueFiltered = useMemo(() => {
    if (league === 'all') return periodFiltered;
    return periodFiltered.filter(b => extractLeague(b) === league);
  }, [periodFiltered, league]);

  // Advanced filters are applied to league-filtered bets
  // advancedFiltered state is managed by AdvancedFilters component

  const filtered = useMemo(() => {
    let src = advancedFiltered.length > 0 ? advancedFiltered : leagueFiltered;
    if (filter === 'all') src = src.filter(b => b.status !== 'cancelled');
    else if (filter === 'pending') src = src.filter(b => b.status === 'pending');
    else if (filter === 'green') src = src.filter(b => b.result === 'green' || b.status === 'green');
    else if (filter === 'red') src = src.filter(b => b.result === 'red' || b.status === 'red');
    else if (filter === 'cancelled') src = src.filter(b => b.status === 'cancelled');

    // Apply pending sort when on pending tab
    if (filter === 'pending') {
      return [...src].sort((a, b) => {
        if (pendingSort === 'date_asc') {
          const aTime = a.commence_time ? new Date(a.commence_time).getTime() : Infinity;
          const bTime = b.commence_time ? new Date(b.commence_time).getTime() : Infinity;
          return aTime - bTime;
        }
        if (pendingSort === 'date_desc') {
          const aTime = a.commence_time ? new Date(a.commence_time).getTime() : 0;
          const bTime = b.commence_time ? new Date(b.commence_time).getTime() : 0;
          return bTime - aTime;
        }
        return new Date(b.placed_at).getTime() - new Date(a.placed_at).getTime();
      });
    }

    return src;
  }, [advancedFiltered, leagueFiltered, filter, pendingSort]);

  const stats = useMemo(() => {
    const src = advancedFiltered.length > 0 ? advancedFiltered : leagueFiltered;
    const settled = src.filter(b => b.status === 'settled' || b.status === 'green' || b.status === 'red');
    const greens = settled.filter(b => b.result === 'green' || b.status === 'green');
    const reds = settled.filter(b => b.result === 'red' || b.status === 'red');
    const totalProfit = settled.reduce((sum, b) => sum + (b.profit_loss || 0), 0);
    const pending = src.filter(b => b.status === 'pending');
    const pendingStake = pending.reduce((sum, b) => sum + b.stake, 0);
    return {
      total: src.length,
      greens: greens.length,
      reds: reds.length,
      pending: pending.length,
      pendingStake,
      totalProfit,
      winRate: settled.length > 0 ? (greens.length / settled.length * 100) : 0,
    };
  }, [advancedFiltered, leagueFiltered]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatCommenceTime = (d: string) => {
    const date = new Date(d);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Hoje ${time}`;
    if (isTomorrow) return `Amanhã ${time}`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ` ${time}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/punter/menu')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-orbitron text-base md:text-lg font-bold text-primary">
              Posições do Hórus
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <GoldButton size="sm" onClick={() => {
              const totalStaked = filtered.reduce((s, b) => s + b.stake, 0);
              generateBetReportPdf(filtered, {
                totalBets: stats.total, greens: stats.greens, reds: stats.reds, pending: stats.pending,
                winRate: stats.winRate, totalProfit: stats.totalProfit, totalStaked,
                roi: totalStaked > 0 ? (stats.totalProfit / totalStaked) * 100 : 0,
                balance: bankroll?.balance || 0,
              }, 'Relatório — Posições do Hórus', `horus_apostas_${new Date().toISOString().slice(0,10)}.pdf`);
              toast.success('PDF gerado com sucesso!');
            }}>
              <FileDown className="w-4 h-4 mr-1" />
              PDF
            </GoldButton>
            <GoldButton size="sm" onClick={() => setImportOpen(true)}>
              <Download className="w-4 h-4 mr-1" />
              Importar
            </GoldButton>
            <GoldButton size="sm" onClick={handleSettle} disabled={settling}>
              <CheckCircle2 className={cn("w-4 h-4 mr-1", settling && "animate-spin")} />
              {settling ? 'Liquidando...' : 'Liquidar Auto'}
            </GoldButton>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Bankroll Summary */}
        {bankroll && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-primary/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground font-orbitron uppercase">Saldo da Banca</p>
                <p className="text-lg font-orbitron font-bold text-foreground">
                  R$ {bankroll.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="text-xs text-muted-foreground font-orbitron uppercase">Posições Pendentes</p>
                <p className="text-lg font-orbitron font-bold text-warning">
                  R$ {stats.pendingStake.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Period & League Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <PeriodFilter value={period} onChange={setPeriod} />
          <LeagueFilter bets={bets} value={league} onChange={setLeague} />
        </div>

        {/* Advanced Filters */}
        <AdvancedFilters
          bets={leagueFiltered as any}
          onFilteredChange={(filtered) => setAdvancedFiltered(filtered as any)}
        />

        {/* Bankroll Evolution Chart */}
        <BankrollEvolutionChart
          bets={leagueFiltered}
          initialBalance={bankroll?.initial_balance || 10000}
        />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Target, color: 'text-primary' },
            { label: 'Green', value: stats.greens, icon: TrendingUp, color: 'text-success' },
            { label: 'Red', value: stats.reds, icon: TrendingDown, color: 'text-destructive' },
            { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, icon: CheckCircle2, color: stats.winRate >= 55 ? 'text-success' : stats.winRate >= 50 ? 'text-warning' : 'text-destructive' },
            { label: 'Lucro', value: `R$ ${stats.totalProfit >= 1000 ? (stats.totalProfit / 1000).toFixed(1) + 'k' : stats.totalProfit.toFixed(2)}`, icon: Wallet, color: stats.totalProfit >= 0 ? 'text-success' : 'text-destructive' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 space-y-1"
            >
              <div className="flex items-center gap-2">
                <s.icon className={cn("w-4 h-4", s.color)} />
                <span className="text-xs text-muted-foreground font-orbitron uppercase">{s.label}</span>
              </div>
              <p className="text-lg font-orbitron font-bold text-foreground">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={v => setFilter(v as FilterStatus)}>
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="all">Todas ({stats.total})</TabsTrigger>
            <TabsTrigger value="pending">Pendentes ({stats.pending})</TabsTrigger>
            <TabsTrigger value="green">Green ({stats.greens})</TabsTrigger>
            <TabsTrigger value="red">Red ({stats.reds})</TabsTrigger>
            <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Pending sort */}
        {filter === 'pending' && (
          <div className="flex items-center gap-2">
            <PendingDateSort value={pendingSort} onChange={setPendingSort} />
          </div>
        )}

        {/* Bet List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Clock className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-orbitron">Nenhuma entrada encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {filtered.map((bet, i) => (
                <motion.div
                  key={bet.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "bg-card border rounded-xl p-4 space-y-3 hover:border-primary/50 transition-colors cursor-pointer",
                    bet.result === 'green' || bet.status === 'green' ? 'border-success/40' :
                    bet.result === 'red' || bet.status === 'red' ? 'border-destructive/40' :
                    'border-border'
                  )}
                >
                  {/* Header with sport icon and match name */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚽</span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={bet.source === 'punter' ? 'secondary' : 'outline'} className="text-[10px] font-orbitron">
                            {bet.source === 'punter' ? 'Punter' : 'Sports'}
                          </Badge>
                          {bet.categoria && (
                            <Badge
                              className={cn(
                                'text-[10px] font-orbitron font-bold border',
                                bet.categoria === 'A' && 'bg-destructive/20 text-destructive border-destructive/50',
                                bet.categoria === 'B' && 'bg-warning/20 text-warning border-warning/50',
                                bet.categoria === 'C' && 'bg-muted text-muted-foreground border-muted-foreground/30',
                              )}
                              title={`Categoria ${bet.categoria} — confiança ${bet.confidence ?? '—'}%`}
                            >
                              CAT {bet.categoria}
                            </Badge>
                          )}
                          <h3 className="font-orbitron text-sm font-bold text-foreground">
                            {bet.match_name}
                          </h3>
                        </div>
                        {bet.league && (
                          <p className="text-xs text-muted-foreground mt-0.5">{extractLeague(bet)}</p>
                        )}
                      </div>
                    </div>
                    
                    {/* Status Badge */}
                    {bet.status !== 'cancelled' && (
                      (bet.result === 'green' || bet.status === 'green') ? (
                        <Badge className="bg-success/20 text-success border-success/40 font-orbitron font-bold">GREEN ✓</Badge>
                      ) : (bet.result === 'red' || bet.status === 'red') ? (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/40 font-orbitron font-bold">RED ✗</Badge>
                      ) : bet.status === 'pending' ? (
                        <Badge className="bg-warning/20 text-warning border-warning/40 font-orbitron font-bold">PENDENTE ⏳</Badge>
                      ) : null
                    )}
                    {bet.status === 'cancelled' && (
                      <Badge variant="outline" className="font-orbitron text-muted-foreground border-muted-foreground/30">CANCELADA ✖</Badge>
                    )}
                  </div>

                  {/* Commence time for pending */}
                  {bet.status === 'pending' && bet.commence_time && (
                    <div className="flex items-center gap-1.5 text-xs bg-primary/10 rounded-lg px-3 py-1.5 w-fit">
                      <CalendarDays className="w-3.5 h-3.5 text-primary" />
                      <span className="text-primary font-orbitron font-medium">{formatCommenceTime(bet.commence_time)}</span>
                    </div>
                  )}

                  {/* Details Grid */}
                  <div className="grid grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs font-orbitron uppercase mb-1">Mercado</p>
                      <p className="text-foreground font-medium font-orbitron">{bet.market}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-orbitron uppercase mb-1">Odd</p>
                      <p className="text-foreground font-medium font-orbitron">{bet.odd.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-orbitron uppercase mb-1">Stake</p>
                      <p className="text-foreground font-medium font-orbitron">R$ {bet.stake.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs font-orbitron uppercase mb-1">
                        {bet.profit_loss != null ? 'Resultado' : 'EV'}
                      </p>
                      <p className={cn(
                        "font-medium font-orbitron",
                        bet.profit_loss != null 
                          ? (bet.profit_loss >= 0 ? 'text-success' : 'text-destructive')
                          : 'text-primary'
                      )}>
                        {bet.profit_loss != null 
                          ? `${bet.profit_loss >= 0 ? '+' : ''}R$ ${bet.profit_loss.toFixed(2)}`
                          : `+R$ ${(bet.stake * (bet.odd - 1)).toFixed(2)}`
                        }
                      </p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-2 border-t border-border">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(bet.placed_at)}
                    </span>
                    {bet.score_home != null && bet.score_away != null && (
                      <span className="font-medium text-foreground">
                        Placar: {bet.score_home} × {bet.score_away}
                      </span>
                    )}
                    {(bet.red_card_home || bet.red_card_away) && (
                      <span className="text-destructive font-medium">
                        🟥 {bet.red_card_home && bet.red_card_away ? 'Ambos' : bet.red_card_home ? 'Casa' : 'Fora'}
                      </span>
                    )}
                  </div>

                  {/* Thesis */}
                  {bet.thesis && (
                    <div className="bg-secondary/20 rounded-lg px-3 py-2">
                      <p className="text-xs leading-relaxed">
                        <span className="text-primary">💡</span> <span className="text-foreground/80">{bet.thesis}</span>
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    {bet.status === 'pending' ? (
                      <>
                        <button
                          onClick={() => cancelBet(bet)}
                          className="flex items-center gap-1 text-xs font-orbitron text-destructive hover:text-destructive/80 hover:bg-destructive/10 px-3 py-1.5 rounded-md transition-colors"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                        <button
                          onClick={() => { setSelectedBet(bet); setSettleModalOpen(true); }}
                          className="flex items-center gap-1 text-xs font-orbitron bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1.5 rounded-md transition-colors font-medium"
                        >
                          <Gavel className="w-3.5 h-3.5" />
                          Liquidar
                        </button>
                      </>
                    ) : (bet.status === 'settled' || bet.status === 'green' || bet.status === 'red') && (
                      <button
                        onClick={() => revertToPending(bet)}
                        className="flex items-center gap-1 text-xs font-orbitron text-muted-foreground hover:text-foreground hover:bg-muted/50 px-3 py-1.5 rounded-md transition-colors"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        Corrigir
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ManualSettleModal
        open={settleModalOpen}
        onClose={() => { setSettleModalOpen(false); setSelectedBet(null); }}
        bet={selectedBet}
        onSettle={handleManualSettle}
      />

      <BetImportPanel isOpen={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
