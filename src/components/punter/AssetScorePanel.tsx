import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getClassificationBadge } from '@/services/bettingAssetScoreService';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { Award, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface ScoreDistribution {
  classification: string;
  count: number;
  avg_score: number;
  win_rate: number;
  roi: number;
}

export default function AssetScorePanel() {
  const { user } = useAuth();
  const [distribution, setDistribution] = useState<ScoreDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalBets, setTotalBets] = useState(0);

  async function loadData() {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('bets_history')
        .select('asset_score, asset_classification, result, profit_loss')
        .eq('user_id', user.id)
        .not('asset_classification', 'is', null);

      if (!data || data.length === 0) {
        setDistribution([]);
        setLoading(false);
        return;
      }

      setTotalBets(data.length);

      const groups: Record<string, { count: number; wins: number; totalPl: number; totalScore: number }> = {};
      for (const b of data) {
        const cls = b.asset_classification || 'UNKNOWN';
        if (!groups[cls]) groups[cls] = { count: 0, wins: 0, totalPl: 0, totalScore: 0 };
        groups[cls].count++;
        if (b.result === 'GREEN' || b.result === 'win') groups[cls].wins++;
        groups[cls].totalPl += Number(b.profit_loss) || 0;
        groups[cls].totalScore += Number(b.asset_score) || 0;
      }

      const tiers = ['ELITE', 'PREMIUM', 'STRONG', 'SPECULATIVE', 'IGNORAR'];
      const dist: ScoreDistribution[] = tiers
        .filter(t => groups[t])
        .map(t => ({
          classification: t,
          count: groups[t].count,
          avg_score: groups[t].totalScore / groups[t].count,
          win_rate: (groups[t].wins / groups[t].count) * 100,
          roi: groups[t].count > 0 ? (groups[t].totalPl / groups[t].count) * 100 : 0,
        }));

      setDistribution(dist);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  const PIE_COLORS = ['#eab308', '#10b981', '#3b82f6', '#f97316', '#6b7280'];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">BETTING ASSET SCORE</span>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          {loading ? 'CARREGANDO...' : 'CARREGAR BAS'}
        </button>
      </div>

      {distribution.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          Classificação de ativos: ELITE • PREMIUM • STRONG • SPECULATIVE
        </p>
      )}

      {distribution.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Pie + Summary */}
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={100} height={100}>
              <PieChart>
                <Pie data={distribution} cx="50%" cy="50%" innerRadius={25} outerRadius={45} dataKey="count" startAngle={90} endAngle={-270}>
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1">
              {distribution.map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                    <span className={cn("text-[10px] font-mono font-bold border px-1.5 py-0.5 rounded", getClassificationBadge(d.classification as any))}>
                      {d.classification}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{d.count} bets</span>
                </div>
              ))}
              <p className="text-[9px] font-mono text-muted-foreground mt-1">Total: {totalBets} entradas com BAS</p>
            </div>
          </div>

          {/* Performance by Tier */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2">PERFORMANCE POR CLASSIFICAÇÃO</p>
            <div className="space-y-1.5">
              {distribution.map((d, i) => (
                <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 border border-border">
                  <span className={cn("text-[10px] font-mono font-bold border px-1.5 py-0.5 rounded", getClassificationBadge(d.classification as any))}>
                    {d.classification}
                  </span>
                  <div className="flex gap-4 text-[10px] font-mono">
                    <span className="text-muted-foreground">Score {d.avg_score.toFixed(0)}</span>
                    <span className={cn(d.win_rate >= 50 ? 'text-green-400' : 'text-red-400')}>
                      WR {d.win_rate.toFixed(0)}%
                    </span>
                    <span className={cn(d.roi >= 0 ? 'text-green-400' : 'text-red-400')}>
                      ROI {d.roi.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
