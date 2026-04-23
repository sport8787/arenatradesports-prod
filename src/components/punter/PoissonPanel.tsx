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

      <div className="bg-muted/20 border border-border/60 rounded-lg p-2.5">
        <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">Como ler:</span> os percentuais abaixo são as
          <span className="text-foreground"> probabilidades estimadas do RESULTADO FINAL do jogo</span> (90 min),
          calculadas a partir dos gols esperados (xG). Não representam o que está acontecendo ao vivo.
          Cada <span className="text-foreground">Odd</span> exibida é a <span className="text-foreground">odd justa</span> (= 100 ÷ probabilidade): se a casa pagar acima dela, há valor.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-2">
        <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder="Time Casa"
          className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder="Time Fora"
          className="bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">xG Casa (gols esperados)</label>
          <input type="number" value={homeXg} onChange={e => setHomeXg(Number(e.target.value))} step={0.1} min={0}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-[8px] font-mono text-muted-foreground">xG Fora (gols esperados)</label>
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
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1.5">
              RESULTADO FINAL (1X2) — <span className="text-foreground/80">probabilidade de cada desfecho ao fim dos 90 min</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="VITÓRIA CASA" value={`${result.home_win}%`} sub={`Odd justa ${(100 / result.home_win).toFixed(2)}`} color="text-green-400" />
              <Stat label="EMPATE" value={`${result.draw}%`} sub={`Odd justa ${(100 / result.draw).toFixed(2)}`} color="text-yellow-400" />
              <Stat label="VITÓRIA FORA" value={`${result.away_win}%`} sub={`Odd justa ${(100 / result.away_win).toFixed(2)}`} color="text-red-400" />
            </div>
          </div>

          {/* Totals */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1.5">
              TOTAL DE GOLS — <span className="text-foreground/80">probabilidade do jogo terminar com mais que X gols somados</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Mais de 1.5 gols" value={`${result.over_1_5}%`} sub={`Odd justa ${(100 / result.over_1_5).toFixed(2)}`} />
              <Stat label="Mais de 2.5 gols" value={`${result.over_2_5}%`} sub={`Odd justa ${(100 / result.over_2_5).toFixed(2)}`} />
              <Stat label="Mais de 3.5 gols" value={`${result.over_3_5}%`} sub={`Odd justa ${(100 / result.over_3_5).toFixed(2)}`} />
            </div>
          </div>

          {/* BTTS + Lambda */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-1.5">
              AMBOS MARCAM (BTTS) & MÉDIA DE GOLS (λ)
            </p>
            <div className="grid grid-cols-4 gap-2">
              <Stat label="Ambos marcam: SIM" value={`${result.btts_yes}%`} />
              <Stat label="Ambos marcam: NÃO" value={`${result.btts_no}%`} />
              <Stat label="λ Casa (gols esp.)" value={String(result.home_lambda)} color="text-primary" />
              <Stat label="λ Fora (gols esp.)" value={String(result.away_lambda)} color="text-accent" />
            </div>
            <p className="text-[9px] font-mono text-muted-foreground/70 mt-1.5 leading-relaxed">
              λ (lambda) é a média de gols esperados por time já ajustada pela liga. É o que alimenta a fórmula de Poisson para gerar todas as probabilidades acima.
            </p>
          </div>

          {/* Most Likely Scores */}
          <div>
            <p className="text-[10px] font-mono text-muted-foreground mb-2">
              PLACARES EXATOS MAIS PROVÁVEIS — <span className="text-foreground/80">probabilidade de o jogo terminar exatamente nesse resultado</span>
            </p>
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
