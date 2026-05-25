import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, Target, Medal, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface RankingEntry {
  id: string;
  username: string;
  total_bets: number;
  roi: number;
  win_rate: number;
  total_profit: number;
  best_streak: number;
  sharpe_ratio: number;
}

export default function PunterRankings({ onClose }: { onClose: () => void }) {
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('punter_rankings' as any)
        .select('*')
        .gte('total_bets', 50)
        .order('roi', { ascending: false })
        .limit(50);

      setRankings((data as unknown as RankingEntry[]) || []);
      setLoading(false);
    }
    load();
  }, []);

  const getMedalColor = (i: number) => {
    if (i === 0) return 'text-yellow-400';
    if (i === 1) return 'text-gray-300';
    if (i === 2) return 'text-amber-600';
    return 'text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h1 className="font-orbitron text-base font-bold text-foreground">Top Investidores</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 max-w-2xl space-y-3">
        <p className="text-xs text-muted-foreground text-center">
          Ranking por ROI — mínimo 50 entradas para participar
        </p>

        {loading ? (
          <div className="flex justify-center py-12">
            <Target className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : rankings.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">Nenhum investidor com 50+ entradas ainda</p>
          </div>
        ) : (
          <AnimatePresence>
            {rankings.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={cn(
                  "bg-card border rounded-xl p-4 flex items-center gap-4",
                  i < 3 ? 'border-yellow-500/30' : 'border-border'
                )}
              >
                <div className="flex items-center justify-center w-8">
                  {i < 3 ? (
                    <Medal className={cn("w-6 h-6", getMedalColor(i))} />
                  ) : (
                    <span className="font-orbitron text-sm font-bold text-muted-foreground">{i + 1}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-orbitron text-sm font-bold text-foreground truncate">{entry.username}</p>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>{entry.total_bets} entradas</span>
                    <span>WR: {Number(entry.win_rate).toFixed(0)}%</span>
                    <span>Streak: {entry.best_streak}</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className={cn(
                    "font-orbitron text-lg font-bold",
                    Number(entry.roi) >= 0 ? 'text-success' : 'text-destructive'
                  )}>
                    {Number(entry.roi) >= 0 ? '+' : ''}{Number(entry.roi).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">ROI</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
