import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown, Wallet, Target, Gavel, Undo2, Ban } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import GoldButton from '@/components/game/GoldButton';
import ManualSettleModal from '@/components/bet-history/ManualSettleModal';
import PeriodFilter, { PeriodOption, getPeriodStartDate } from '@/components/bet-history/PeriodFilter';
import LeagueFilter, { extractLeagueHint } from '@/components/bet-history/LeagueFilter';
import BankrollEvolutionChart from '@/components/bet-history/BankrollEvolutionChart';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useManualBankroll } from '@/hooks/useManualBankroll';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ManualBet {
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
  score_home?: number | null;
  score_away?: number | null;
  red_card_home?: boolean;
  red_card_away?: boolean;
  thesis?: string | null;
}

type FilterStatus = 'all' | 'pending' | 'green' | 'red' | 'cancelled';

export default function MinhasApostasPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { bankroll } = useManualBankroll();
  const [bets, setBets] = useState<ManualBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [period, setPeriod] = useState<PeriodOption>('all');
  const [league, setLeague] = useState('all');
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<ManualBet | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchBets();
  }, [user]);

  const fetchBets = async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('virtual_bets_manual' as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching manual bets:', error);
      setLoading(false);
      return;
    }

    const mapped: ManualBet[] = (data || []).map((b: any) => ({
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
      score_home: b.score_home,
      score_away: b.score_away,
      red_card_home: b.red_card_home,
      red_card_away: b.red_card_away,
      thesis: b.thesis,
    }));

    setBets(mapped);
    setLoading(false);
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

    const { error: betError } = await supabase
      .from('virtual_bets_manual' as any)
      .update({
        status: 'settled',
        result: betResult,
        profit_loss: profitLoss,
        score_home: h,
        score_away: a,
        red_card_home: data.redCardHome,
        red_card_away: data.redCardAway,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.betId);

    if (betError) {
      toast.error('Erro ao liquidar posição');
      console.error(betError);
      return;
    }

    // Update manual bankroll
    const balanceChange = isGreen ? bet.stake * bet.odd : 0;
    const newGreens = (bankroll.green_bets || 0) + (isGreen ? 1 : 0);
    const newReds = (bankroll.red_bets || 0) + (isGreen ? 0 : 1);

    await supabase
      .from('manual_bankroll' as any)
      .update({
        balance: +((bankroll.balance || 0) + balanceChange).toFixed(2),
        total_profit: +((bankroll.total_profit || 0) + profitLoss).toFixed(2),
        green_bets: newGreens,
        red_bets: newReds,
        win_rate: (newGreens + newReds) > 0 ? +(newGreens / (newGreens + newReds) * 100).toFixed(2) : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    toast.success(`Posição liquidada: ${betResult.toUpperCase()}`);
    await fetchBets();
  }, [user, bankroll, bets]);

  const revertToPending = useCallback(async (bet: ManualBet) => {
    if (!user || !bankroll) return;

    const wasGreen = bet.result === 'green';
    const balanceChange = wasGreen ? -(bet.stake * bet.odd) : 0;
    const profitReverse = -(bet.profit_loss || 0);

    const { error } = await supabase
      .from('virtual_bets_manual' as any)
      .update({
        status: 'pending',
        result: null,
        profit_loss: null,
        score_home: null,
        score_away: null,
        red_card_home: false,
        red_card_away: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bet.id);

    if (error) {
      toast.error('Erro ao reverter posição');
      console.error(error);
      return;
    }

    const newGreens = (bankroll.green_bets || 0) - (wasGreen ? 1 : 0);
    const newReds = (bankroll.red_bets || 0) - (wasGreen ? 0 : 1);

    await supabase
      .from('manual_bankroll' as any)
      .update({
        balance: +((bankroll.balance || 0) + balanceChange).toFixed(2),
        total_profit: +((bankroll.total_profit || 0) + profitReverse).toFixed(2),
        green_bets: Math.max(0, newGreens),
        red_bets: Math.max(0, newReds),
        win_rate: (newGreens + newReds) > 0 ? +(newGreens / (newGreens + newReds) * 100).toFixed(2) : 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    toast.success('Posição revertida para pendente');
    await fetchBets();
  }, [user, bankroll, bets]);

  const cancelBet = useCallback(async (bet: ManualBet) => {
    if (!user || !bankroll) return;

    const { error } = await supabase
      .from('virtual_bets_manual' as any)
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bet.id);

    if (error) {
      toast.error('Erro ao cancelar posição');
      console.error(error);
      return;
    }

    // Refund stake
    await supabase
      .from('manual_bankroll' as any)
      .update({
        balance: (bankroll.balance || 0) + bet.stake,
        total_staked: Math.max(0, (bankroll.total_staked || 0) - bet.stake),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    toast.success(`Posição cancelada — R$ ${bet.stake.toFixed(2)} estornado`);
    await fetchBets();
  }, [user, bankroll]);

  const filtered = useMemo(() => {
    if (filter === 'all') return bets.filter(b => b.status !== 'cancelled');
    if (filter === 'pending') return bets.filter(b => b.status === 'pending');
    if (filter === 'green') return bets.filter(b => b.result === 'green');
    if (filter === 'red') return bets.filter(b => b.result === 'red');
    if (filter === 'cancelled') return bets.filter(b => b.status === 'cancelled');
    return bets;
  }, [bets, filter]);

  const stats = useMemo(() => {
    const settled = bets.filter(b => b.status === 'settled' || b.result === 'green' || b.result === 'red');
    const greens = settled.filter(b => b.result === 'green');
    const reds = settled.filter(b => b.result === 'red');
    const totalProfit = settled.reduce((sum, b) => sum + (b.profit_loss || 0), 0);
    const pending = bets.filter(b => b.status === 'pending');
    const pendingStake = pending.reduce((sum, b) => sum + b.stake, 0);
    return {
      total: bets.length,
      greens: greens.length,
      reds: reds.length,
      pending: pending.length,
      pendingStake,
      totalProfit,
      winRate: settled.length > 0 ? (greens.length / settled.length * 100) : 0,
    };
  }, [bets]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-orbitron text-base md:text-lg font-bold text-primary">
              Minhas Posições
            </h1>
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
                <p className="text-xs text-muted-foreground font-orbitron uppercase">Saldo Minha Banca</p>
                <p className="text-lg font-orbitron font-bold text-foreground">
                  R$ {(bankroll.balance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, icon: Target, color: 'text-primary' },
            { label: 'Green', value: stats.greens, icon: TrendingUp, color: 'text-success' },
            { label: 'Red', value: stats.reds, icon: TrendingDown, color: 'text-destructive' },
            { label: 'Lucro', value: `R$ ${stats.totalProfit.toFixed(2)}`, icon: Wallet, color: stats.totalProfit >= 0 ? 'text-success' : 'text-destructive' },
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

        {/* Bet List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Clock className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-orbitron">Nenhuma posição encontrada</p>
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
                    "bg-card border rounded-xl p-4 space-y-2",
                    bet.result === 'green' ? 'border-success/40' :
                    bet.result === 'red' ? 'border-destructive/40' :
                    'border-border'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-orbitron text-sm font-bold text-foreground truncate max-w-[200px]">
                      {bet.match_name}
                    </span>
                    <div className="flex items-center gap-2">
                      {bet.status === 'pending' ? (
                        <>
                          <button
                            onClick={() => cancelBet(bet)}
                            className="flex items-center gap-1 text-xs font-orbitron text-destructive hover:text-destructive/80 bg-destructive/10 hover:bg-destructive/20 px-2 py-1 rounded-md transition-colors"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            Cancelar
                          </button>
                          <button
                            onClick={() => { setSelectedBet(bet); setSettleModalOpen(true); }}
                            className="flex items-center gap-1 text-xs font-orbitron text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md transition-colors"
                          >
                            <Gavel className="w-3.5 h-3.5" />
                            Liquidar
                          </button>
                        </>
                      ) : bet.status === 'cancelled' ? (
                        <Badge variant="outline" className="font-orbitron text-muted-foreground border-muted-foreground/30">CANCELADA ✖</Badge>
                      ) : (bet.status === 'settled' || bet.result === 'green' || bet.result === 'red') && (
                        <button
                          onClick={() => revertToPending(bet)}
                          className="flex items-center gap-1 text-xs font-orbitron text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 px-2 py-1 rounded-md transition-colors"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Corrigir
                        </button>
                      )}
                      {bet.status !== 'cancelled' && (
                        bet.result === 'green' ? (
                          <Badge className="bg-success/20 text-success border-success/30 font-orbitron">GREEN ✅</Badge>
                        ) : bet.result === 'red' ? (
                          <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-orbitron">RED ❌</Badge>
                        ) : bet.status === 'pending' ? (
                          <Badge variant="outline" className="font-orbitron text-warning border-warning/30">PENDENTE ⏳</Badge>
                        ) : null
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>Mercado: <span className="text-foreground font-medium">{bet.market}</span></span>
                    <span>Odd: <span className="text-foreground font-medium">{bet.odd.toFixed(2)}</span></span>
                    <span>Stake: <span className="text-foreground font-medium">R$ {bet.stake.toFixed(2)}</span></span>
                    {bet.score_home != null && bet.score_away != null && (
                      <span>Placar: <span className="text-foreground font-medium">{bet.score_home} × {bet.score_away}</span></span>
                    )}
                    {(bet.red_card_home || bet.red_card_away) && (
                      <span>🟥 {bet.red_card_home && bet.red_card_away ? 'Ambos' : bet.red_card_home ? 'Casa' : 'Fora'}</span>
                    )}
                    <span>{formatDate(bet.placed_at)}</span>
                  </div>

                  {bet.thesis && (
                    <div className="bg-secondary/20 rounded-lg px-3 py-2 mt-1">
                      <p className="text-xs text-muted-foreground">💡 <span className="text-foreground/80">{bet.thesis}</span></p>
                    </div>
                  )}

                  {bet.profit_loss != null && (bet.status === 'settled' || bet.result === 'green' || bet.result === 'red') && (
                    <div className={cn(
                      "text-sm font-orbitron font-bold",
                      bet.profit_loss >= 0 ? 'text-success' : 'text-destructive'
                    )}>
                      {bet.profit_loss >= 0 ? '+' : ''}R$ {bet.profit_loss.toFixed(2)}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <ManualSettleModal
        open={settleModalOpen}
        onClose={() => { setSettleModalOpen(false); setSelectedBet(null); }}
        bet={selectedBet ? { ...selectedBet, source: 'sports' } : null}
        onSettle={handleManualSettle}
      />
    </div>
  );
}
