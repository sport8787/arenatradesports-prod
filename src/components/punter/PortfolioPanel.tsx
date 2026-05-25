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

          {/* Alertas Contextuais Inteligentes */}
          <div className="space-y-3 mt-4 border-t border-border/50 pt-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-foreground font-bold">
                <span>✅</span>
                <span>{portfolio.total_bets} POSIÇÕES ABERTAS (jogos futuros)</span>
              </div>
              <div className="flex items-start gap-1.5 text-[10px] font-mono text-muted-foreground ml-1.5 border-l border-border/50 pl-2">
                <span className="text-muted-foreground/50 leading-none mt-0.5">└─</span>
                <span className="leading-tight">Exposição {portfolio.exposure_pct.toFixed(0)}% é normal para entradas antecipadas</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-foreground font-bold">
                <span>💡</span>
                <span>CLV MÉDIO: {(portfolio.avg_clv || 0) > 0 ? '+' : ''}{(portfolio.avg_clv || 0).toFixed(2)}%</span>
              </div>
              <div className="flex flex-col text-[10px] font-mono text-muted-foreground ml-1.5 border-l border-border/50 pl-2 gap-1">
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground/50 leading-none mt-0.5">├─</span>
                  <span className="leading-tight">Você está entrando cedo (sharps fazem isso!)</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground/50 leading-none mt-0.5">└─</span>
                  <span className="leading-tight">Odd média {(portfolio.avg_clv || 0) >= 0 ? 'melhorou' : 'piorou'} {(portfolio.avg_clv || 0) > 0 ? '+' : ''}{(portfolio.avg_clv || 0).toFixed(2)}% desde sua entrada</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-foreground font-bold">
                <span>📊</span>
                <span>DIVERSIFICAÇÃO: {portfolio.diversification_score}%</span>
              </div>
              <div className="flex flex-col text-[10px] font-mono text-muted-foreground ml-1.5 border-l border-border/50 pl-2 gap-1">
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground/50 leading-none mt-0.5">├─</span>
                  <span className="leading-tight">{portfolio.unique_leagues} ligas diferentes ✅</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground/50 leading-none mt-0.5">├─</span>
                  <span className="leading-tight">{portfolio.unique_markets || 1} mercados variados ✅</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground/50 leading-none mt-0.5">└─</span>
                  <span className="leading-tight">{portfolio.unique_leagues < 4 ? 'Considere adicionar mais ligas' : 'Ótima distribuição de risco'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-foreground font-bold">
                <span>ℹ️</span>
                <span>RISCO INDIVIDUAL: {(portfolio.max_stake_pct || 0) > 5 ? 'Atenção' : 'Baixo'}</span>
              </div>
              <div className="flex flex-col text-[10px] font-mono text-muted-foreground ml-1.5 border-l border-border/50 pl-2 gap-1">
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground/50 leading-none mt-0.5">├─</span>
                  <span className="leading-tight">Cada entrada usa gestão de banca</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-muted-foreground/50 leading-none mt-0.5">└─</span>
                  <span className="leading-tight">Maior stake: {(portfolio.max_stake_pct || 0).toFixed(1)}% {(portfolio.max_stake_pct || 0) > 5 ? '(alto)' : '(dentro do seguro)'}</span>
                </div>
              </div>
            </div>

            {portfolio.adjustments.length > 0 && (
              <div className="space-y-1 mt-2">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-orange-400 font-bold">
                  <span>⚠️</span>
                  <span>ALERTA REAL: Correlação Detectada</span>
                </div>
                <div className="flex flex-col text-[10px] font-mono text-orange-400/80 ml-1.5 border-l border-orange-400/30 pl-2 gap-1">
                  <div className="flex items-start gap-1.5">
                    <span className="text-orange-400/50 leading-none mt-0.5">├─</span>
                    <span className="leading-tight">{portfolio.adjustments.length} entrada(s) com conflito/correlação no mesmo jogo</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="text-orange-400/50 leading-none mt-0.5">└─</span>
                    <span className="leading-tight">Stakes reduzidas automaticamente:</span>
                  </div>
                  <div className="space-y-1 mt-1 pr-2">
                    {portfolio.adjustments.slice(0, 3).map((adj, i) => (
                      <div key={i} className="flex items-center justify-between bg-orange-400/10 rounded px-2 py-1">
                        <span className="text-[9px] font-mono">{adj.market}</span>
                        <span className="text-[9px] font-mono">
                          R${adj.original_stake.toFixed(0)} → R${adj.adjusted_stake.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
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
