import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { portfolioOptimizationService, type PortfolioAnalysis } from '@/services/portfolioOptimizationService';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Shield, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function PortfolioPanel() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<PortfolioAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function analyze() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await portfolioOptimizationService.analyze(user.id);
      setPortfolio(data);
    } catch (e: any) {
      setError(e.message || 'Erro na análise');
    } finally {
      setLoading(false);
    }
  }

  const diversData = portfolio ? [
    { name: 'Diversificação', value: portfolio.diversification_score },
    { name: 'Restante', value: 100 - portfolio.diversification_score },
  ] : [];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">PORTFOLIO OPTIMIZER</span>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
          {loading ? 'ANALISANDO...' : 'OTIMIZAR'}
        </button>
      </div>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {!portfolio && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          Analise correlação e exposição das posições abertas
        </p>
      )}

      {portfolio && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Risk + Diversification */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground mb-1">RISCO</p>
              <p className={cn("text-sm font-mono font-bold", portfolioOptimizationService.getRiskColor(portfolio.risk_level))}>
                {portfolioOptimizationService.getRiskBadge(portfolio.risk_level)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Score: {portfolio.risk_score}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
              <p className="text-[9px] font-mono text-muted-foreground mb-1">DIVERSIFICAÇÃO</p>
              <div className="flex items-center justify-center">
                <ResponsiveContainer width={60} height={60}>
                  <PieChart>
                    <Pie data={diversData} cx="50%" cy="50%" innerRadius={18} outerRadius={28} dataKey="value" startAngle={90} endAngle={-270}>
                      <Cell fill="hsl(var(--primary))" />
                      <Cell fill="hsl(var(--muted))" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <span className="text-lg font-mono font-bold text-foreground ml-1">{portfolio.diversification_score}%</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Posições" value={String(portfolio.total_bets)} />
            <Stat label="Ligas" value={String(portfolio.unique_leagues)} />
            <Stat label="Exposição" value={`${portfolio.exposure_pct.toFixed(1)}%`} />
          </div>

          {/* Adjustments */}
          {portfolio.adjustments.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">⚠️ AJUSTES SUGERIDOS</p>
              <div className="space-y-1.5">
                {portfolio.adjustments.slice(0, 5).map((adj, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 border border-border">
                    <span className="text-[10px] font-mono text-foreground">{adj.market}</span>
                    <span className="text-[10px] font-mono text-orange-400">
                      R${adj.original_stake.toFixed(0)} → R${adj.adjusted_stake.toFixed(0)} ({adj.reduction_pct.toFixed(0)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {portfolio.recommendations.length > 0 && (
            <div className="space-y-1">
              {portfolio.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-[10px] font-mono text-muted-foreground">
                  <AlertCircle className="w-3 h-3 mt-0.5 text-primary shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
      <p className="text-[9px] font-mono text-muted-foreground">{label}</p>
      <p className="text-sm font-mono font-bold text-foreground">{value}</p>
    </div>
  );
}
