import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Zap, Eye, Shield } from 'lucide-react';
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

export default function ActivePositions() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function fetchPositions() {
      const { data } = await supabase
        .from('virtual_bets')
        .select('id, match_name, market, odd, stake, entry_odd, current_odd, cashout_value, mycroft_cashout_signal, mycroft_cashout_reason, odd_fonte, last_cashout_update, created_at')
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      setPositions((data as any[]) || []);
      setLoading(false);
    }

    fetchPositions();

    const channel = supabase
      .channel(`positions_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'virtual_bets', filter: `user_id=eq.${user.id}` }, () => fetchPositions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (loading || positions.length === 0) return null;

  return (
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

                {/* Header */}
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

                {/* Valor estimado x Stake */}
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

                {/* Odd movement + fonte indicator */}
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
  );
}
