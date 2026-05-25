import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface MissedOpportunitiesProps {
  userId: string;
}

export default function MissedOpportunities({ userId }: MissedOpportunitiesProps) {
  const [expanded, setExpanded] = useState(false);

  const { data: missed, isLoading } = useQuery({
    queryKey: ['missed-bets', userId],
    queryFn: async () => {
      // Get all settled Hórus bets
      const { data: horusBets } = await supabase
        .from('virtual_bets_punter')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['green', 'red'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (!horusBets || horusBets.length === 0) return [];

      // Get all manual bets match_ids
      const { data: manualBets } = await supabase
        .from('virtual_bets_manual')
        .select('match_id')
        .eq('user_id', userId);

      const manualMatchIds = new Set(
        (manualBets || []).map((b: any) => (b.match_id || '').toLowerCase())
      );

      // Filter Hórus bets that user did NOT replicate
      return horusBets.filter((b: any) =>
        !manualMatchIds.has((b.match_id || '').toLowerCase())
      );
    },
    staleTime: 60_000,
  });

  if (isLoading || !missed || missed.length === 0) return null;

  const totalMissedProfit = missed.reduce(
    (sum: number, bet: any) => sum + (parseFloat(bet.profit_loss) || 0),
    0
  );

  const missedGreens = missed.filter((b: any) => b.status === 'green');
  const missedReds = missed.filter((b: any) => b.status === 'red');

  // Only show if there's meaningful missed profit
  if (totalMissedProfit <= 0) return null;

  const visibleBets = expanded ? missedGreens : missedGreens.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg bg-card overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
            OPORTUNIDADES PERDIDAS
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono text-muted-foreground mr-2">Lucro Não Capturado</span>
          <span className="font-mono text-sm font-bold text-destructive">
            -R$ {totalMissedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border flex items-center gap-4 text-[10px] font-mono text-muted-foreground">
        <span>{missedGreens.length} greens perdidos</span>
        <span>{missedReds.length} reds evitados</span>
        <span>{missed.length} entradas não seguidas</span>
      </div>

      <div className="divide-y divide-border">
        <AnimatePresence>
          {visibleBets.map((bet: any, i: number) => (
            <motion.div
              key={bet.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="px-4 py-2.5 flex items-center justify-between hover:bg-secondary/10 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-xs font-semibold text-foreground truncate">
                    {bet.match_name || bet.match_id}
                  </p>
                  <span className="text-[9px] font-mono text-destructive/80 bg-destructive/10 px-1.5 py-0.5 rounded shrink-0">
                    Você perdeu!
                  </span>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {bet.market} · Odd {parseFloat(bet.odd).toFixed(2)} · {format(new Date(bet.created_at), 'dd/MM HH:mm')}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                <p className="font-mono text-sm font-bold text-destructive">
                  -R$ {parseFloat(bet.profit_loss).toFixed(2)}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {missedGreens.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-center text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors border-t border-border flex items-center justify-center gap-1"
        >
          {expanded ? (
            <><ChevronUp className="w-3 h-3" /> OCULTAR</>
          ) : (
            <><ChevronDown className="w-3 h-3" /> VER TODOS ({missedGreens.length})</>
          )}
        </button>
      )}

      {totalMissedProfit > 100 && (
        <div className="mx-3 mb-3 p-2.5 bg-warning/5 border border-warning/15 rounded-lg flex items-start gap-2">
          <TrendingDown className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
          <p className="text-[10px] font-mono text-foreground/70 leading-relaxed">
            Você deixou de ganhar <span className="text-warning font-semibold">R$ {totalMissedProfit.toFixed(2)}</span> por
            não seguir {missedGreens.length} recomendações que deram green.
          </p>
        </div>
      )}
    </motion.div>
  );
}
