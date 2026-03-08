import { useState } from 'react';
import { poissonService, type PoissonInput, type PoissonResult } from '@/services/poissonService';
import { Calculator, RefreshCw, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function PoissonPanel() {
  const [result, setResult] = useState<PoissonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [homeXg, setHomeXg] = useState(1.5);
  const [awayXg, setAwayXg] = useState(1.2);

  async function calculate() {
    if (!homeTeam || !awayTeam) return;
    setLoading(true);
    setError('');
    try {
      const data = await poissonService.calculate({
        home_team: homeTeam,
        away_team: awayTeam,
        home_xg: homeXg,
        away_xg: awayXg,
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Erro no cálculo');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs font-bold text-foreground">POISSON / DIXON-COLES</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Time Casa"
          className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Time Fora"
          className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">xG Casa</label>
          <input type="number" value={homeXg} onChange={e => setHomeXg(Number(e.target.value))} step={0.1} min={0}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">xG Fora</label>
          <input type="number" value={awayXg} onChange={e => setAwayXg(Number(e.target.value))} step={0.1} min={0}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>

      <button onClick={calculate} disabled={loading || !homeTeam || !awayTeam}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono rounded-lg transition-colors disabled:opacity-50">
        <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
        {loading ? 'CALCULANDO...' : 'CALCULAR POISSON'}
      </button>

      {error && <p className="text-[10px] text-destructive font-mono">{error}</p>}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* 1X2 */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="CASA" value={`${result.home_win}%`} sub={`Odd ${(100 / result.home_win).toFixed(2)}`} color="text-green-400" />
            <Stat label="EMPATE" value={`${result.draw}%`} sub={`Odd ${(100 / result.draw).toFixed(2)}`} color="text-yellow-400" />
            <Stat label="FORA" value={`${result.away_win}%`} sub={`Odd ${(100 / result.away_win).toFixed(2)}`} color="text-red-400" />
          </div>

          {/* Totals */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Over 1.5" value={`${result.over_1_5}%`} sub={`Odd ${(100 / result.over_1_5).toFixed(2)}`} />
            <Stat label="Over 2.5" value={`${result.over_2_5}%`} sub={`Odd ${(100 / result.over_2_5).toFixed(2)}`} />
            <Stat label="Over 3.5" value={`${result.over_3_5}%`} sub={`Odd ${(100 / result.over_3_5).toFixed(2)}`} />
          </div>

          {/* BTTS + Lambda */}
          <div className="grid grid-cols-4 gap-2">
            <Stat label="BTTS Sim" value={`${result.btts_yes}%`} />
            <Stat label="BTTS Não" value={`${result.btts_no}%`} />
            <Stat label="λ Casa" value={String(result.home_lambda)} color="text-primary" />
            <Stat label="λ Fora" value={String(result.away_lambda)} color="text-accent" />
          </div>

          {/* Most Likely Scores */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2">PLACARES MAIS PROVÁVEIS</p>
            <div className="flex flex-wrap gap-1.5">
              {result.most_likely_scores.slice(0, 8).map((s, i) => (
                <span key={i} className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-mono border",
                  i === 0 ? "bg-primary/10 border-primary/30 text-primary font-bold" : "bg-muted/30 border-border text-foreground"
                )}>
                  {s.home}-{s.away} ({s.probability}%)
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2 border border-border text-center">
      <p className="text-[8px] font-mono text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-mono font-bold", color || "text-foreground")}>{value}</p>
      {sub && <p className="text-[8px] font-mono text-muted-foreground">{sub}</p>}
    </div>
  );
}
