import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { selfLearningService, type LearningAnalysis } from '@/services/selfLearningService';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';
import { Brain, RefreshCw, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function SelfLearningPanel() {
  const { user } = useAuth();
  const [analysis, setAnalysis] = useState<LearningAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function runAnalysis() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await selfLearningService.analyze(user.id);
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message || 'Erro na análise');
    } finally {
      setLoading(false);
    }
  }

  async function runRecalibrate() {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const data = await selfLearningService.recalibrate(user.id);
      setAnalysis(data);
    } catch (e: any) {
      setError(e.message || 'Erro na recalibração');
    } finally {
      setLoading(false);
    }
  }

  const tierData = analysis?.analysis?.by_tier || [];
  const marketData = analysis?.analysis?.by_market || [];

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="font-mono text-xs font-bold text-foreground">SELF LEARNING ENGINE</span>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
            ANALISAR
          </button>
          <button
            onClick={runRecalibrate}
            disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50"
          >
            <Zap className="w-3 h-3" />
            RECALIBRAR
          </button>
        </div>
      </div>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {!analysis && !loading && (
        <p className="text-xs text-muted-foreground text-center py-6 font-mono">
          O motor aprende com seus resultados para otimizar os pesos do Asset Score
        </p>
      )}

      {analysis && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Status */}
          <div className="bg-muted/30 rounded-lg p-3 border border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-muted-foreground">STATUS</span>
              <span className={cn("text-[10px] font-mono font-bold",
                analysis.status === 'recalibrated' ? 'text-green-400' :
                analysis.status === 'analysis_complete' ? 'text-primary' : 'text-yellow-400'
              )}>
                {analysis.status === 'recalibrated' ? '✅ RECALIBRADO' :
                 analysis.status === 'analysis_complete' ? '📊 ANÁLISE COMPLETA' : '⚠️ DADOS INSUFICIENTES'}
              </span>
            </div>
            {analysis.message && <p className="text-[10px] text-muted-foreground mt-1">{analysis.message}</p>}
          </div>

          {/* Weight Changes */}
          {analysis.changes && Object.keys(analysis.changes).length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">AJUSTES DE PESO</p>
              <div className="space-y-1.5">
                {Object.entries(analysis.changes).map(([key, change]) => (
                  <div key={key} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 border border-border">
                    <span className="text-[10px] font-mono text-foreground">{key}</span>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-muted-foreground">{(change.old * 100).toFixed(1)}%</span>
                      <ArrowRight className="w-3 h-3 text-primary" />
                      <span className={cn(change.new > change.old ? 'text-green-400' : 'text-red-400')}>
                        {(change.new * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier Performance */}
          {tierData.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">PERFORMANCE POR TIER</p>
              <div className="space-y-1">
                {tierData.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-muted/20 rounded-lg px-3 py-2 border border-border">
                    <span className="text-[10px] font-mono font-bold text-foreground">{t.tier}</span>
                    <div className="flex gap-3 text-[10px] font-mono">
                      <span className="text-muted-foreground">{t.total} bets</span>
                      <span className={cn(t.roi >= 0 ? 'text-green-400' : 'text-red-400')}>ROI {t.roi.toFixed(1)}%</span>
                      <span className="text-primary">WR {t.win_rate.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market Performance Chart */}
          {marketData.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-muted-foreground mb-2">ROI POR MERCADO</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={marketData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'ROI']}
                  />
                  <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                    {marketData.map((entry, i) => (
                      <Cell key={i} fill={entry.roi >= 0 ? 'hsl(var(--success))' : 'hsl(var(--destructive))'} />
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
