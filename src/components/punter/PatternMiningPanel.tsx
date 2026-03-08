import { useState } from 'react';
import { getCachedPatterns, runPatternMining, type PatternData } from '@/services/patternMiningService';
import { useAuth } from '@/hooks/useAuth';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Layers, RefreshCw, TrendingUp, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function PatternMiningPanel() {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<PatternData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<'cache' | 'fresh'>('cache');

  async function loadCached() {
    setLoading(true);
    setError('');
    try {
      const data = await getCachedPatterns(true);
      setPatterns(data);
      setSource('cache');
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar padrões');
    } finally {
      setLoading(false);
    }
  }

  async function runFresh() {
    setLoading(true);
    setError('');
    try {
      const result = await runPatternMining(user?.id);
      setPatterns(result.patterns);
      setSource('fresh');
    } catch (e: any) {
      setError(e.message || 'Erro no pattern mining');
    } finally {
      setLoading(false);
    }
  }

  const top10 = patterns.slice(0, 10);

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">PATTERN MINING ENGINE</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={loadCached}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
          >
            <Database className="w-3 h-3" />
            CACHE
          </button>
          <button
            onClick={runFresh}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            RECALCULAR
          </button>
        </div>
      </div>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {patterns.length === 0 && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          Descobre padrões lucrativos por liga + mercado no histórico
        </p>
      )}

      {patterns.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground">PADRÕES</p>
              <p className="text-lg font-mono font-bold text-foreground">{patterns.length}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground">LUCRATIVOS</p>
              <p className="text-lg font-mono font-bold text-green-400">{patterns.filter(p => p.is_profitable).length}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground">MELHOR ROI</p>
              <p className="text-lg font-mono font-bold text-primary">
                {patterns.length > 0 ? `${patterns[0].roi.toFixed(1)}%` : '—'}
              </p>
            </div>
          </div>

          {/* ROI Chart */}
          {top10.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">TOP 10 PADRÕES — ROI</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={top10} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                  <YAxis
                    type="category"
                    dataKey={(d: PatternData) => `${d.league.slice(0, 12)} | ${d.market}`}
                    tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
                    width={120}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']}
                  />
                  <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                    {top10.map((entry, i) => (
                      <Cell key={i} fill={entry.roi >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Pattern List */}
          <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
            {patterns.slice(0, 15).map((p, i) => (
              <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 border border-border">
                <div>
                  <p className="text-[10px] font-mono text-foreground">{p.league}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">{p.market} • {p.sample_size} bets</p>
                </div>
                <div className="text-right">
                  <p className={cn("text-[10px] font-mono font-bold", p.roi >= 0 ? 'text-green-400' : 'text-red-400')}>
                    ROI {p.roi.toFixed(1)}%
                  </p>
                  <p className="text-[9px] font-mono text-muted-foreground">
                    WR {p.win_rate.toFixed(0)}% • Odd {p.avg_odd?.toFixed(2) || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
