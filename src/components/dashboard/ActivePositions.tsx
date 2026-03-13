import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, AlertTriangle, Banknote, Shield, Clock, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

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
  auto_cashout_enabled: boolean;
  last_cashout_update: string | null;
  created_at: string;
}

interface ActivePositionsProps {
  onCashOut: (betId: string, cashoutValue: number) => Promise<{ success: boolean; error?: string }>;
}

export default function ActivePositions({ onCashOut }: ActivePositionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [cashingOut, setCashingOut] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function fetchPositions() {
      const { data } = await supabase
        .from('virtual_bets')
        .select('id, match_name, market, odd, stake, entry_odd, current_odd, cashout_value, mycroft_cashout_signal, mycroft_cashout_reason, auto_cashout_enabled, last_cashout_update, created_at')
        .eq('user_id', user!.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      setPositions((data as any[]) || []);
      setLoading(false);
    }

    fetchPositions();

    // Realtime updates
    const channel = supabase
      .channel(`positions_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'virtual_bets',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchPositions();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleCashOut = async (pos: Position) => {
    if (!pos.cashout_value || cashingOut) return;
    setCashingOut(pos.id);
    
    const result = await onCashOut(pos.id, pos.cashout_value);
    if (result.success) {
      toast({ title: '💰 Cash Out realizado!', description: `R$ ${pos.cashout_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} devolvido à banca` });
      setPositions(prev => prev.filter(p => p.id !== pos.id));
    } else {
      toast({ title: '❌ Erro', description: result.error || 'Erro ao realizar cash out' });
    }
    setCashingOut(null);
  };

  const toggleAutoCashout = async (pos: Position) => {
    const newVal = !pos.auto_cashout_enabled;
    await supabase
      .from('virtual_bets')
      .update({ auto_cashout_enabled: newVal })
      .eq('id', pos.id);
    
    setPositions(prev => prev.map(p => p.id === pos.id ? { ...p, auto_cashout_enabled: newVal } : p));
    toast({ title: newVal ? '🤖 Auto Cash Out ativado' : '🔒 Auto Cash Out desativado' });
  };

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
            const healthColor = pos.mycroft_cashout_signal 
              ? 'border-destructive/50 bg-destructive/5' 
              : isProfit 
                ? 'border-success/30 bg-success/5' 
                : 'border-warning/30 bg-warning/5';

            return (
              <motion.div
                key={pos.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className={cn('border rounded-xl p-4 space-y-3', healthColor)}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-orbitron text-xs font-bold text-foreground truncate">
                      {pos.match_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pos.market} @ {entryOdd.toFixed(2)}
                    </p>
                  </div>
                  <div className={cn('flex items-center gap-1 text-xs font-bold', isProfit ? 'text-success' : 'text-destructive')}>
                    {isProfit ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%
                  </div>
                </div>

                {/* Cashout value */}
                <div className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground font-orbitron">Cash Out</p>
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

                {/* Odd movement */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Odd:</span>
                  <span className="font-mono">{entryOdd.toFixed(2)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={cn('font-mono font-bold', currentOdd < entryOdd ? 'text-success' : currentOdd > entryOdd ? 'text-destructive' : 'text-foreground')}>
                    {currentOdd.toFixed(2)}
                  </span>
                  {pos.last_cashout_update && (
                    <span className="text-muted-foreground ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(pos.last_cashout_update).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                {/* Mycroft signal */}
                {pos.mycroft_cashout_signal && pos.mycroft_cashout_reason && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/30 rounded-lg"
                  >
                    <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-destructive">Mycroft recomenda sair</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pos.mycroft_cashout_reason}</p>
                    </div>
                  </motion.div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCashOut(pos)}
                    disabled={cashingOut === pos.id || !pos.cashout_value}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-orbitron text-xs font-bold uppercase transition-all disabled:opacity-50',
                      pos.mycroft_cashout_signal
                        ? 'bg-destructive text-destructive-foreground animate-pulse'
                        : isProfit
                          ? 'bg-success text-success-foreground hover:brightness-110'
                          : 'bg-warning text-warning-foreground hover:brightness-110'
                    )}
                  >
                    <Banknote className="w-4 h-4" />
                    {cashingOut === pos.id ? 'Saindo...' : `CASH OUT R$ ${cashoutValue.toFixed(2)}`}
                  </button>

                  <button
                    onClick={() => toggleAutoCashout(pos)}
                    className={cn(
                      'p-2.5 rounded-lg border transition-all',
                      pos.auto_cashout_enabled 
                        ? 'border-primary bg-primary/10 text-primary' 
                        : 'border-border text-muted-foreground hover:text-foreground'
                    )}
                    title={pos.auto_cashout_enabled ? 'Auto Cash Out ativo' : 'Ativar Auto Cash Out'}
                  >
                    {pos.auto_cashout_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
