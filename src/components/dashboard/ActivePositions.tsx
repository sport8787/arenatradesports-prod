import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Zap, Eye, Shield, CheckCircle2, XCircle, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Position {
  id: string;
  match_name: string;
  market: string;
  odd: number;
  stake: number;
  entry_odd: number | null;
  current_odd: number | null;
  cashout_value: number | null;
  mycroft_cashout_signal: boolean;
  mycroft_cashout_reason: string | null;
  odd_fonte: string | null;
  last_cashout_update: string | null;
  created_at: string;
}

interface SettledBet {
  id: string;
  match_name: string;
  market: string;
  odd: number;
  stake: number;
  status: string; // 'won' | 'lost' | 'cashout'
  profit_loss: number | null;
  score_home: number | null;
  score_away: number | null;
  settled_at: string | null;
}

export default function ActivePositions() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [settled, setSettled] = useState<SettledBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchAll() {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const [pendingRes, settledRes] = await Promise.all([
        supabase
          .from('virtual_bets')
          .select('id, match_name, market, odd, stake, entry_odd, current_odd, cashout_value, mycroft_cashout_signal, mycroft_cashout_reason, odd_fonte, last_cashout_update, created_at')
          .eq('user_id', user!.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('virtual_bets')
          .select('id, match_name, market, odd, stake, status, profit_loss, score_home, score_away, settled_at')
          .eq('user_id', user!.id)
          .in('status', ['won', 'lost', 'cashout'])
          .gte('settled_at', twoHoursAgo)
          .order('settled_at', { ascending: false })
          .limit(10),
      ]);

      setPositions((pendingRes.data as any[]) || []);
      setSettled((settledRes.data as any[]) || []);
      setLoading(false);
    }

    fetchAll();

    const channel = supabase
      .channel(`positions_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'virtual_bets', filter: `user_id=eq.${user.id}` }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading || (positions.length === 0 && settled.length === 0)) return null;

  return (
    <div className="space-y-5">
      {/* Posições Abertas */}
      {positions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="font-orbitron text-sm font-bold text-foreground uppercase">
              Posições Abertas ({positions.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {positions.map((pos) => {
                const entryOdd = pos.entry_odd || pos.odd;
                const currentOdd = pos.current_odd || entryOdd;
                const cashoutValue = pos.cashout_value || pos.stake;
                const pnl = cashoutValue - pos.stake;
                const pnlPct = ((cashoutValue / pos.stake) - 1) * 100;
                const isProfit = pnl >= 0;
                const isEstimated = pos.odd_fonte !== 'real';
                const healthColor = pos.mycroft_cashout_signal
                  ? 'border-destructive/50 bg-destructive/5'
                  : isProfit ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5';

                return (
                  <motion.div key={pos.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                    className={cn('border rounded-xl p-4 space-y-3', healthColor)}>

                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-orbitron text-xs font-bold text-foreground truncate">{pos.match_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pos.market} @ {entryOdd.toFixed(2)}</p>
                      </div>
                      <div className={cn('flex items-center gap-1 text-xs font-bold', isProfit ? 'text-success' : 'text-destructive')}>
                        {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-orbitron">Valor Estimado</p>
                        <p className={cn('text-lg font-black font-orbitron', isProfit ? 'text-success' : 'text-destructive')}>
                          R$ {cashoutValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-muted-foreground font-orbitron">Stake</p>
                        <p className="text-sm text-muted-foreground font-orbitron">
                          R$ {pos.stake.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Odd:</span>
                      <span className="font-mono">{entryOdd.toFixed(2)}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className={cn('font-mono font-bold', currentOdd < entryOdd ? 'text-success' : currentOdd > entryOdd ? 'text-destructive' : 'text-foreground')}>
                        {currentOdd.toFixed(2)}
                      </span>

                      {isEstimated ? (
                        <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-warning/15 border border-warning/30 text-warning text-[10px] font-bold">
                          <Eye className="w-2.5 h-2.5" /> EST
                        </span>
                      ) : (
                        <span className="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-success/15 border border-success/30 text-success text-[10px] font-bold">
                          <Shield className="w-2.5 h-2.5" /> REAL
                        </span>
                      )}

                      {pos.last_cashout_update && (
                        <span className="text-muted-foreground ml-auto flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(pos.last_cashout_update).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>

                    {isEstimated && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-warning/10 border border-warning/20 rounded-lg">
                        <Eye className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                        <p className="text-[10px] text-warning">Odd estimada por IA — pode divergir do mercado real</p>
                      </div>
                    )}

                    {pos.mycroft_cashout_signal && pos.mycroft_cashout_reason && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                        className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-destructive">Atenção: posição em risco</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{pos.mycroft_cashout_reason}</p>
                        </div>
                      </motion.div>
                    )}

                    <p className="text-[10px] text-muted-foreground text-center pt-1 border-t border-border/50">
                      Aguardando liquidação automática pelo placar final
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Liquidações Recentes */}
      {settled.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" />
            <h3 className="font-orbitron text-sm font-bold text-foreground uppercase">
              Liquidações Recentes ({settled.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {settled.map((bet) => {
                const isWon = bet.status === 'won';
                const isCashout = bet.status === 'cashout';
                const pnl = bet.profit_loss ?? (isWon ? (bet.stake * bet.odd - bet.stake) : -bet.stake);
                const isProfit = pnl >= 0;

                const label = isCashout ? 'CASH OUT' : isWon ? 'GREEN' : 'RED';
                const labelColor = isCashout
                  ? 'bg-primary text-primary-foreground'
                  : isWon
                    ? 'bg-success text-success-foreground'
                    : 'bg-destructive text-destructive-foreground';
                const borderColor = isCashout
                  ? 'border-primary/40 bg-primary/5'
                  : isWon
                    ? 'border-success/40 bg-success/5'
                    : 'border-destructive/40 bg-destructive/5';

                const hasScore = bet.score_home !== null && bet.score_away !== null;

                return (
                  <motion.div
                    key={bet.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={cn('border rounded-xl p-4 space-y-3', borderColor)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-orbitron text-xs font-bold text-foreground truncate">{bet.match_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{bet.market} @ {Number(bet.odd).toFixed(2)}</p>
                      </div>
                      <span className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-md font-orbitron text-[10px] font-black uppercase tracking-wider',
                        labelColor
                      )}>
                        {isWon ? <CheckCircle2 className="w-3 h-3" /> : isCashout ? <Trophy className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {label}
                      </span>
                    </div>

                    {/* Placar final */}
                    {hasScore && (
                      <div className="flex items-center justify-center gap-3 bg-background/60 rounded-lg py-2">
                        <span className="text-[10px] uppercase text-muted-foreground font-orbitron">Placar Final</span>
                        <span className="font-orbitron text-2xl font-black text-foreground tabular-nums">
                          {bet.score_home} <span className="text-muted-foreground mx-1">×</span> {bet.score_away}
                        </span>
                      </div>
                    )}

                    {/* Resultado financeiro */}
                    <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground font-orbitron">Resultado</p>
                        <p className={cn('text-lg font-black font-orbitron', isProfit ? 'text-success' : 'text-destructive')}>
                          {isProfit ? '+' : ''}R$ {Math.abs(pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase text-muted-foreground font-orbitron">Stake</p>
                        <p className="text-sm text-muted-foreground font-orbitron">
                          R$ {Number(bet.stake).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {bet.settled_at && (
                      <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Liquidado às {new Date(bet.settled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
