import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { clvEngineService, type CLVReport } from '@/services/clvEngineService';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { TrendingUp, RefreshCw, Target, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function CLVPanel() {
  const { user } = useAuth();
  const [report, setReport] = useState<CLVReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadReport() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await clvEngineService.calculateForUser(user.id);
      setReport(data);
    } catch (e: any) {
      setError(e.message || 'Erro ao calcular CLV');
    } finally {
      setLoading(false);
    }
  }

  const summary = report?.summary;
  const byMarket = report?.by_market || [];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">CLOSING LINE VALUE</span>
        </div>
        <button
          onClick={loadReport}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          {loading ? 'CALCULANDO...' : 'ANALISAR CLV'}
        </button>
      </div>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {!report && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          Clique em ANALISAR CLV para comparar suas odds de entrada vs fechamento
        </p>
      )}

      {summary && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <KPI label="CLV Médio" value={`${(summary.avg_clv ?? 0).toFixed(2)}%`} positive={(summary.avg_clv ?? 0) > 0} />
            <KPI label="Market Beat Rate" value={`${(summary.market_beat_rate ?? 0).toFixed(0)}%`} positive={(summary.market_beat_rate ?? 0) > 50} />
            <KPI label="CLV+ Rate" value={`${(summary.positive_clv_rate ?? 0).toFixed(0)}%`} positive={(summary.positive_clv_rate ?? 0) > 50} />
            <KPI label="Entradas Analisadas" value={String(summary.total_bets ?? 0)} neutral />
          </div>

          {/* CLV Accuracy */}
          {report.clv_accuracy && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border">
              <p className="text-[10px] font-mono text-muted-foreground mb-2">CLV ACCURACY</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground">Win Rate (CLV+)</p>
                  <p className="text-sm font-mono font-bold text-green-400">{(report.clv_accuracy.positive_clv_win_rate ?? 0).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Win Rate (CLV-)</p>
                  <p className="text-sm font-mono font-bold text-red-400">{(report.clv_accuracy.negative_clv_win_rate ?? 0).toFixed(0)}%</p>
                </div>
              </div>
            </div>
          )}

          {/* By Market Chart */}
          {byMarket.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">CLV POR MERCADO</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={byMarket} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                  <YAxis type="category" dataKey="market" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                    formatter={(v: number) => [`${v.toFixed(2)}%`, 'CLV Médio']}
                  />
                  <Bar dataKey="avg_clv" radius={[0, 4, 4, 0]}>
                    {byMarket.map((entry, i) => (
                      <Cell key={i} fill={entry.avg_clv >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function KPI({ label, value, positive, neutral }: { label: string; value: string; positive?: boolean; neutral?: boolean }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2.5 border border-border text-center">
      <p className="text-[9px] font-mono text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-mono font-bold", neutral ? 'text-foreground' : positive ? 'text-green-400' : 'text-red-400')}>
        {value}
      </p>
    </div>
  );
}
