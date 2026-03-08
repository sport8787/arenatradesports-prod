import { useState } from 'react';
import { ensembleService, type EnsembleInput, type EnsembleResult } from '@/services/ensembleService';
import { Layers, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts';

export default function EnsemblePanel() {
  const [result, setResult] = useState<EnsembleResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    match_id: '',
    home_team: '',
    away_team: '',
    market: 'home_win',
    poisson_prob: 0.55,
    xg_prob: 0.52,
    elo_prob: 0.50,
    market_prob: 0.48,
    current_odd: 2.10,
  });

  async function calculate() {
    setLoading(true);
    setError('');
    try {
      const data = await ensembleService.calculate({
        ...form,
        match_id: form.match_id || 'manual',
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erro');
    } finally {
      setLoading(false);
    }
  }

  const F = (key: string, val: number) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs font-bold text-foreground">ENSEMBLE MODELS</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Prob. Poisson', key: 'poisson_prob' },
          { label: 'Prob. xG', key: 'xg_prob' },
          { label: 'Prob. ELO', key: 'elo_prob' },
          { label: 'Prob. Mercado', key: 'market_prob' },
        ].map(({ label, key }) => (
          <div key={key}>
            <label className="text-[8px] font-mono text-muted-foreground">{label}</label>
            <input type="number" value={(form as any)[key]} onChange={e => F(key, Number(e.target.value))}
              step={0.01} min={0} max={1}
              className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        ))}
      </div>
      <div>
        <label className="text-[8px] font-mono text-muted-foreground">Odd Atual</label>
        <input type="number" value={form.current_odd} onChange={e => F('current_odd', Number(e.target.value))}
          step={0.01} min={1.01}
          className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      <button onClick={calculate} disabled={loading}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50">
        <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        {loading ? 'PROCESSANDO...' : 'CALCULAR ENSEMBLE'}
      </button>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Main Result */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
              <p className="text-[8px] font-mono text-muted-foreground">PROB. ENSEMBLE</p>
              <p className="text-xl font-mono font-bold text-primary">{result.ensemble_probability}%</p>
              <p className="text-[9px] font-mono text-muted-foreground">Fair Odd: {result.fair_odd}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
              <p className="text-[8px] font-mono text-muted-foreground">EDGE</p>
              <p className={cn("text-xl font-mono font-bold", (result.edge || 0) > 0 ? "text-green-400" : "text-red-400")}>
                {result.edge?.toFixed(1) || '—'}%
              </p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
              <p className="text-[8px] font-mono text-muted-foreground">CONCORDÂNCIA</p>
              <p className={cn("text-xl font-mono font-bold",
                result.model_agreement > 75 ? "text-green-400" : result.model_agreement > 50 ? "text-yellow-400" : "text-red-400"
              )}>{result.model_agreement}%</p>
            </div>
          </div>

          {/* Recommendation */}
          <div className={cn("text-center py-2 rounded-lg border font-mono text-sm font-bold",
            result.recommendation === "STRONG_VALUE" ? "bg-green-500/10 border-green-500/30 text-green-400" :
            result.recommendation === "VALUE" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
            result.recommendation === "AGAINST" ? "bg-red-500/10 border-red-500/30 text-red-400" :
            "bg-muted/30 border-border text-muted-foreground"
          )}>
            {ensembleService.getRecommendationBadge(result.recommendation)}
          </div>

          {/* Model Contributions */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2">CONTRIBUIÇÃO POR MODELO</p>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={result.contributions.filter(c => c.available)} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                <YAxis type="category" dataKey="model" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 11 }}
                  formatter={(v: number) => [`${v}%`, 'Contribuição']}
                />
                <Bar dataKey="probability" radius={[0, 4, 4, 0]}>
                  {result.contributions.filter(c => c.available).map((_, i) => (
                    <Cell key={i} fill={`hsl(var(--primary))`} opacity={0.5 + i * 0.15} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </div>
  );
}
