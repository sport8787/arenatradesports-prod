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
import { useBankroll } from '@/hooks/useBankroll';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchBets();
  }, [user]);

  const fetchBets = async () => {
    if (!user) return;
    setLoading(true);

    const [sportsRes, punterRes] = await Promise.all([
      supabase.from('virtual_bets').select('*').eq('user_id', user.id).order('placed_at', { ascending: false }),
      supabase.from('virtual_bets_punter').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    const sportsBets: Bet[] = (sportsRes.data || []).map((b: any) => ({
      id: b.id,
      match_name: b.match_name || b.match_id,
      market: b.market,
      odd: parseFloat(b.odd),
      stake: parseFloat(b.stake),
      status: b.status,
      result: b.status === 'settled' ? (b.profit_loss > 0 ? 'green' : 'red') : undefined,
      profit_loss: b.profit_loss ? parseFloat(b.profit_loss) : null,
      placed_at: b.placed_at,
      settled_at: b.settled_at,
      source: 'sports',
      score_home: b.score_home,
      score_away: b.score_away,
      red_card_home: b.red_card_home,
      red_card_away: b.red_card_away,
    }));

    const punterBets: Bet[] = (punterRes.data || []).map((b: any) => ({
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
      source: 'punter',
      score_home: b.score_home,
      score_away: b.score_away,
      red_card_home: b.red_card_home,
      red_card_away: b.red_card_away,
      thesis: b.thesis,
    }));

    setBets([...sportsBets, ...punterBets].sort((a, b) =>
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

    // Determine result
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
      // Fallback for unknown markets
      isGreen = h > a;
    }

    const betResult = isGreen ? 'green' : 'red';
    const profitLoss = isGreen
      ? +(bet.stake * (bet.odd - 1)).toFixed(2)
      : -bet.stake;

    const table = data.source === 'punter' ? 'virtual_bets_punter' : 'virtual_bets';

    // Update bet
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
      toast.error('Erro ao liquidar aposta');
      console.error(betError);
      return;
    }

    // Update bankroll - only add back for GREEN (stake already deducted)
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

    // Also settle matching punter_signals if punter bet
    if (data.source === 'punter') {
      const matchId = bet.match_name.replace(/ vs /g, '_').replace(/ /g, '_');
      await supabase
        .from('punter_signals')
        .update({
          result: betResult,
          status: 'settled',
          profit_loss: isGreen
            ? +(bet.odd * 3).toFixed(2) // default stake_percentage
            : -3,
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

    toast.success(`Aposta liquidada: ${betResult.toUpperCase()}`);
    await fetchBets();
  }, [user, bankroll, bets]);

  const revertToPending = useCallback(async (bet: Bet) => {
    if (!user || !bankroll) return;

    const table = bet.source === 'punter' ? 'virtual_bets_punter' : 'virtual_bets';
    const wasGreen = bet.result === 'green' || bet.status === 'green';

    // Reverse bankroll impact
    // If it was GREEN, we need to remove the winnings (stake * odd) from balance
    // If it was RED, stake was already deducted at placement, no balance change needed
    const balanceChange = wasGreen ? -(bet.stake * bet.odd) : 0;
    const profitReverse = -(bet.profit_loss || 0);

    // Revert bet to pending
    const updatePayload = bet.source === 'punter'
      ? { status: 'pending', result: null, profit_loss: null, score_home: null, score_away: null, red_card_home: false, red_card_away: false, updated_at: new Date().toISOString() }
      : { status: 'pending', profit_loss: null, score_home: null, score_away: null, red_card_home: false, red_card_away: false, settled_at: null };

    const { error } = await supabase.from(table).update(updatePayload).eq('id', bet.id);
    if (error) {
      toast.error('Erro ao reverter aposta');
      console.error(error);
      return;
    }

    // Reverse bankroll stats
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

    // Also revert matching punter_signals if punter bet
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

    toast.success('Aposta revertida para pendente');
    await fetchBets();
  }, [user, bankroll, bets]);


  const cancelBet = useCallback(async (bet: Bet) => {
    if (!user || !bankroll) return;

    const table = bet.source === 'punter' ? 'virtual_bets_punter' : 'virtual_bets';
    const bankrollTable = bet.source === 'punter' ? 'user_bankroll' : 'sports_bankroll';

    // Mark as cancelled
    const { error } = await supabase
      .from(table)
      .update({ status: 'cancelled', updated_at: new Date().toISOString() } as any)
      .eq('id', bet.id);

    if (error) {
      toast.error('Erro ao cancelar aposta');
      console.error(error);
      return;
    }

    // Refund stake to bankroll
    await supabase
      .from(bankrollTable as any)
      .update({
        balance: bankroll.balance + bet.stake,
        total_staked: Math.max(0, bankroll.total_staked - bet.stake),
        updated_at: new Date().toISOString(),
      } as any)
      .eq('user_id', user.id);

    toast.success(`Aposta cancelada — R$ ${bet.stake.toFixed(2)} estornado`);
    await fetchBets();
  }, [user, bankroll]);

  const periodFiltered = useMemo(() => {
    const start = getPeriodStartDate(period);
    if (!start) return bets;
    return bets.filter(b => new Date(b.placed_at) >= start);
  }, [bets, period]);

  const leagueFiltered = useMemo(() => {
    if (league === 'all') return periodFiltered;
    return periodFiltered.filter(b => extractLeagueHint(b.match_name) === league);
  }, [periodFiltered, league]);

  const filtered = useMemo(() => {
    const src = leagueFiltered;
    if (filter === 'all') return src.filter(b => b.status !== 'cancelled');
    if (filter === 'pending') return src.filter(b => b.status === 'pending');
    if (filter === 'green') return src.filter(b => b.result === 'green' || b.status === 'green');
    if (filter === 'red') return src.filter(b => b.result === 'red' || b.status === 'red');
    if (filter === 'cancelled') return src.filter(b => b.status === 'cancelled');
    return src;
  }, [leagueFiltered, filter]);

  const stats = useMemo(() => {
    const src = leagueFiltered;
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
  }, [leagueFiltered]);

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
              Posições do Hórus
            </h1>
          </div>
          <GoldButton size="sm" onClick={handleSettle} disabled={settling}>
            <CheckCircle2 className={cn("w-4 h-4 mr-1", settling && "animate-spin")} />
            {settling ? 'Liquidando...' : 'Liquidar Auto'}
          </GoldButton>
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
            <p className="font-orbitron">Nenhuma aposta encontrada</p>
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
                    bet.result === 'green' || bet.status === 'green' ? 'border-success/40' :
                    bet.result === 'red' || bet.status === 'red' ? 'border-destructive/40' :
                    'border-border'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={bet.source === 'punter' ? 'secondary' : 'outline'} className="text-[10px]">
                        {bet.source === 'punter' ? 'Punter' : 'Sports'}
                      </Badge>
                      <span className="font-orbitron text-sm font-bold text-foreground truncate max-w-[200px]">
                        {bet.match_name}
                      </span>
                    </div>
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
                      ) : (bet.status === 'settled' || bet.status === 'green' || bet.status === 'red') && (
                        <button
                          onClick={() => revertToPending(bet)}
                          className="flex items-center gap-1 text-xs font-orbitron text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 px-2 py-1 rounded-md transition-colors"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                          Corrigir
                        </button>
                      )}
                      {bet.status !== 'cancelled' && (
                        (bet.result === 'green' || bet.status === 'green') ? (
                          <Badge className="bg-success/20 text-success border-success/30 font-orbitron">GREEN ✅</Badge>
                        ) : (bet.result === 'red' || bet.status === 'red') ? (
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

                  {/* Thesis */}
                  {bet.thesis && (
                    <div className="bg-secondary/20 rounded-lg px-3 py-2 mt-1">
                      <p className="text-xs text-muted-foreground">💡 <span className="text-foreground/80">{bet.thesis}</span></p>
                    </div>
                  )}

                  {bet.profit_loss != null && (bet.status === 'settled' || bet.status === 'green' || bet.status === 'red') && (
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
        bet={selectedBet}
        onSettle={handleManualSettle}
      />
    </div>
  );
}
