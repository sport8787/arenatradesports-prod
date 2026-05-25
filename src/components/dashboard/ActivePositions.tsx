import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Zap, Eye, Shield, CheckCircle2, XCircle, Trophy, Info, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { playCriticalAlert, playWarningAlert } from '@/lib/criticalAlertSound';
import { horusMentor } from '@/services/horusMentor';
import { toast } from 'sonner';


// Padrões de alerta do plano BACK FAVORITO COM VALOR
const BACKFAV_IMMEDIATE_STOP = /(gol\s+do\s+advers[áa]rio.*odd|odd\s*<\s*1[.,]40.*gol|stop\s+imediato.*back\s*fav)/i;
const BACKFAV_PREVENTIVE = /(55\s*min.*sem\s*gol\s*do\s*favorit|cash\s*out\s+preventivo|janela\s+encerrada)/i;
const BACKFAV_MARKET = /(back\s*favorit|match\s*odds.*back|favorit.*back)/i;

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
  placed_at: string;
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
  cashout_value: number | null;
}

export default function ActivePositions() {
  const { user } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [settled, setSettled] = useState<SettledBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentlySettledIds, setRecentlySettledIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let knownSettledIds = new Set<string>();
    // Mapeia id -> assinatura do alerta (signal + reason) para detectar transições
    let knownAlertSig = new Map<string, string>();
    // Evita tocar o mesmo som repetido em <10s para o mesmo id
    const lastPlayedAt = new Map<string, number>();
    let isFirstLoad = true;

    async function fetchAll() {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      const [pendingRes, settledRes] = await Promise.all([
        supabase
          .from('virtual_bets')
          .select('id, match_name, market, odd, stake, entry_odd, current_odd, cashout_value, mycroft_cashout_signal, mycroft_cashout_reason, odd_fonte, last_cashout_update, placed_at')
          .eq('user_id', user!.id)
          .eq('status', 'pending')
          .order('placed_at', { ascending: false }),
        supabase
          .from('virtual_bets')
          .select('id, match_name, market, odd, stake, status, profit_loss, score_home, score_away, settled_at, cashout_value')
          .eq('user_id', user!.id)
          .in('status', ['won', 'lost', 'cashout'])
          .gte('settled_at', twoHoursAgo)
          .order('settled_at', { ascending: false })
          .limit(10),
      ]);

      const settledList = (settledRes.data as SettledBet[]) || [];
      const pendingList = (pendingRes.data as Position[]) || [];

      // Detect newly settled bets (not present in last snapshot)
      if (!isFirstLoad) {
        const newIds = settledList.map(b => b.id).filter(id => !knownSettledIds.has(id));
        if (newIds.length > 0) {
          setRecentlySettledIds(prev => {
            const next = new Set(prev);
            newIds.forEach(id => next.add(id));
            return next;
          });
          newIds.forEach(id => {
            setTimeout(() => {
              setRecentlySettledIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }, 8000);
          });
        }

        // 🔊 Detectar NOVO entrada crítico/aviso (transição) e tocar som
        const now = Date.now();
        for (const pos of pendingList) {
          if (!pos.mycroft_cashout_signal || !pos.mycroft_cashout_reason) continue;
          const sig = `${pos.mycroft_cashout_signal}::${pos.mycroft_cashout_reason}`;
          const prevSig = knownAlertSig.get(pos.id);
          if (prevSig === sig) continue; // sem mudança

          const last = lastPlayedAt.get(pos.id) || 0;
          if (now - last < 10000) continue; // throttle 10s

          const reason = pos.mycroft_cashout_reason;
          const isCritical = /SAIR AGORA|🚨|⚠️ SAIR/i.test(reason);
          const isWarning = !isCritical && /ATENÇÃO|⚠️/i.test(reason);

          if (isCritical) {
            playCriticalAlert();
            horusMentor.speak('cashout_critical').catch(() => {});
            lastPlayedAt.set(pos.id, now);

            toast.error('🚨 FECHE A POSIÇÃO AGORA', {
              description: `${pos.match_name} — ${reason}`,
              duration: 20000,
              action: {
                label: 'Abrir Betfair',
                onClick: () => window.open('https://promos.betfair.bet.br/choose-your-refer-and-earn-offer?referrerCode=DWGLHVUTF', '_blank'),
              },
            });
          } else if (isWarning) {
            playWarningAlert();
            lastPlayedAt.set(pos.id, now);
            toast.warning('⚠️ Atenção: posição sob risco', {
              description: `${pos.match_name} — ${reason}`,
              duration: 12000,
            });
          }

          // 🚨 Toasts específicos do plano BACK FAVORITO COM VALOR
          const isBackFav = BACKFAV_MARKET.test(pos.market || '');
          if (isBackFav && BACKFAV_IMMEDIATE_STOP.test(reason)) {
            toast.error('🚨 STOP IMEDIATO — Back Favorito', {
              description: `${pos.match_name}: ${reason}`,
              duration: 12000,
            });
          } else if (isBackFav && BACKFAV_PREVENTIVE.test(reason)) {
            toast.warning('⏱️ Cash out preventivo — Back Favorito', {
              description: `${pos.match_name}: ${reason}`,
              duration: 10000,
            });
          }
        }
      }

      // Atualiza assinaturas conhecidas (sempre, inclusive no primeiro load — para não tocar som de entradas antigos)
      knownAlertSig = new Map(
        pendingList
          .filter(p => p.mycroft_cashout_signal && p.mycroft_cashout_reason)
          .map(p => [p.id, `${p.mycroft_cashout_signal}::${p.mycroft_cashout_reason}`])
      );
      knownSettledIds = new Set(settledList.map(b => b.id));
      isFirstLoad = false;

      setPositions(pendingList);
      setSettled(settledList);
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
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <h3 className="font-orbitron text-sm font-bold text-foreground uppercase">
                Posições Abertas ({positions.length})
              </h3>
            </div>
            <Link to="/arena-trader-sports/under-thresholds" className="text-[10px] font-orbitron uppercase text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              ⚙ Thresholds Under
            </Link>
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

                    {pos.mycroft_cashout_signal && pos.mycroft_cashout_reason && (() => {
                      const reasonText = pos.mycroft_cashout_reason!;
                      const isCriticalAlert = /SAIR AGORA|🚨|⚠️ SAIR/i.test(reasonText);
                      return (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className={cn(
                            'flex items-start gap-2 p-3 rounded-lg border-2',
                            isCriticalAlert
                              ? 'bg-destructive/20 border-destructive shadow-[0_0_24px_rgba(239,68,68,0.5)] animate-pulse'
                              : 'bg-warning/15 border-warning/50',
                          )}
                        >
                          <AlertTriangle className={cn(
                            'w-5 h-5 flex-shrink-0 mt-0.5',
                            isCriticalAlert ? 'text-destructive' : 'text-warning',
                          )} />
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              'text-xs font-black font-orbitron uppercase tracking-wider',
                              isCriticalAlert ? 'text-destructive' : 'text-warning',
                            )}>
                              {isCriticalAlert ? '🚨 Feche a posição agora' : 'Atenção: posição em risco'}
                            </p>
                            <p className="text-xs text-foreground/90 mt-1 leading-snug">{reasonText}</p>
                          </div>
                        </motion.div>
                      );
                    })()}

                    <a
                      href="https://promos.betfair.bet.br/choose-your-refer-and-earn-offer?referrerCode=DWGLHVUTF"
                      target="_blank"
                      rel="noopener noreferrer sponsored"
                      className="flex items-center justify-center gap-2 w-full px-3 py-1.5 rounded-md bg-[#FFB80C] hover:bg-[#FFC93D] text-black font-orbitron font-bold text-[11px] uppercase tracking-wider transition-all shadow-[0_0_10px_rgba(255,184,12,0.2)]"
                    >
                      Gerenciar na Betfair →
                    </a>
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
        <TooltipProvider delayDuration={150}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-gold" />
            <h3 className="font-orbitron text-sm font-bold text-foreground uppercase">
              Liquidações Recentes ({settled.length})
            </h3>
            <Link
              to="/arena-trader-sports/liquidacoes"
              className="ml-auto inline-flex items-center gap-1 text-[11px] font-orbitron uppercase text-primary hover:underline"
            >
              <History className="w-3 h-3" /> Ver histórico completo
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {settled.map((bet) => {
                const isWon = bet.status === 'won';
                const isCashout = bet.status === 'cashout';
                const pnl = bet.profit_loss ?? (isWon ? (bet.stake * bet.odd - bet.stake) : -bet.stake);
                const isProfit = pnl >= 0;

                const label = isCashout ? 'CASH OUT' : isWon ? 'GREN' : 'RED';
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
                const isJustSettled = recentlySettledIds.has(bet.id);

                const tooltipText = isCashout
                  ? `Posição encerrada via CASH OUT garantindo R$ ${(bet.cashout_value ?? bet.stake).toFixed(2)}.`
                  : isWon
                    ? `O mercado "${bet.market}" foi ATINGIDO. Lucro líquido: R$ ${pnl.toFixed(2)}.`
                    : `O mercado "${bet.market}" NÃO foi atingido. Perda: R$ ${bet.stake.toFixed(2)}.`;

                return (
                  <motion.div
                    key={bet.id}
                    layout
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', damping: 18 }}
                    className={cn(
                      'border rounded-xl p-4 space-y-3 transition-shadow',
                      borderColor,
                      isJustSettled && (isWon
                        ? 'shadow-[0_0_24px_hsl(var(--success)/0.5)] ring-2 ring-success/40'
                        : isCashout
                          ? 'shadow-[0_0_24px_hsl(var(--primary)/0.5)] ring-2 ring-primary/40'
                          : 'shadow-[0_0_24px_hsl(var(--destructive)/0.5)] ring-2 ring-destructive/40')
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-orbitron text-xs font-bold text-foreground truncate">{bet.match_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{bet.market} @ {Number(bet.odd).toFixed(2)}</p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <motion.span
                            initial={isJustSettled ? { scale: 0.6, opacity: 0 } : false}
                            animate={isJustSettled ? { scale: [0.6, 1.25, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
                            transition={{ duration: 0.6 }}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-md font-orbitron text-[11px] font-black uppercase tracking-wider shadow-md cursor-help',
                              labelColor,
                              isJustSettled && 'animate-pulse'
                            )}
                          >
                            {isWon ? <CheckCircle2 className="w-3 h-3" /> : isCashout ? <Trophy className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {label}
                            <Info className="w-3 h-3 opacity-70 ml-0.5" />
                          </motion.span>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
                          {tooltipText}
                        </TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Placar final */}
                    {hasScore && (
                      <motion.div
                        initial={isJustSettled ? { scale: 0.9, opacity: 0 } : false}
                        animate={{ scale: 1, opacity: 1 }}
                        className="flex items-center justify-center gap-3 bg-background/60 rounded-lg py-2"
                      >
                        <span className="text-[10px] uppercase text-muted-foreground font-orbitron">Placar Final</span>
                        <span className="font-orbitron text-2xl font-black text-foreground tabular-nums">
                          {bet.score_home} <span className="text-muted-foreground mx-1">×</span> {bet.score_away}
                        </span>
                      </motion.div>
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
        </TooltipProvider>
      )}
    </div>
  );
}
