import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEARNING_CONFIG } from '@/lib/learningEngineConfig';

interface OddsPoint {
  timestamp: string;
  odd: number;
}

interface OddsEvolutionProps {
  matchId: string;
  market: string;
  currentOdd: number;
  openOdd?: number;
}

export default function OddsEvolution({ matchId, market, currentOdd, openOdd }: OddsEvolutionProps) {
  const [history, setHistory] = useState<OddsPoint[]>([]);

  // For now we derive from open/current; real implementation would query The Odds API
  useEffect(() => {
    if (!openOdd || openOdd === currentOdd) return;

    // Simulate intermediate points
    const steps = 5;
    const diff = currentOdd - openOdd;
    const points: OddsPoint[] = [];
    const now = new Date();

    for (let i = 0; i <= steps; i++) {
      const t = new Date(now.getTime() - (steps - i) * 3600000);
      const jitter = i > 0 && i < steps ? (Math.random() - 0.5) * 0.02 : 0;
      points.push({
        timestamp: t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        odd: Math.round((openOdd + (diff * i / steps) + jitter) * 1000) / 1000,
      });
    }
    setHistory(points);
  }, [matchId, openOdd, currentOdd]);

  if (!openOdd || history.length === 0) return null;

  const movement = currentOdd - openOdd;
  const movementPct = ((movement) / openOdd) * 100;
  const isSuspicious = Math.abs(movementPct / 100) > LEARNING_CONFIG.ODI_SUSPICIOUS_THRESHOLD;
  const direction = movement > 0.01 ? 'up' : movement < -0.01 ? 'down' : 'flat';

  // Max/min for sparkline
  const odds = history.map(h => h.odd);
  const minOdd = Math.min(...odds);
  const maxOdd = Math.max(...odds);
  const range = maxOdd - minOdd || 0.01;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="border border-border rounded-lg bg-card p-3"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-muted-foreground tracking-wider">ODDS MOVEMENT</span>
        {isSuspicious && (
          <div className="flex items-center gap-1 text-warning">
            <AlertTriangle className="w-3 h-3" />
            <span className="text-[9px] font-mono font-semibold">SUSPEITO</span>
          </div>
        )}
      </div>

      {/* Sparkline */}
      <div className="h-8 flex items-end gap-px mb-2">
        {history.map((point, i) => {
          const height = ((point.odd - minOdd) / range) * 100;
          return (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-t-sm min-h-[2px] transition-all",
                direction === 'down' ? 'bg-success/60' : direction === 'up' ? 'bg-destructive/60' : 'bg-muted-foreground/30'
              )}
              style={{ height: `${Math.max(5, height)}%` }}
              title={`${point.timestamp}: ${point.odd.toFixed(3)}`}
            />
          );
        })}
      </div>

      {/* Values */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs font-mono">
          <div>
            <span className="text-muted-foreground">OPEN </span>
            <span className="text-foreground font-semibold">{openOdd.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            {direction === 'down' ? (
              <TrendingDown className="w-3 h-3 text-success" />
            ) : direction === 'up' ? (
              <TrendingUp className="w-3 h-3 text-destructive" />
            ) : (
              <Minus className="w-3 h-3 text-muted-foreground" />
            )}
            <span className={cn(
              "font-semibold",
              direction === 'down' ? 'text-success' : direction === 'up' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {movementPct >= 0 ? '+' : ''}{movementPct.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">CURRENT </span>
            <span className="text-foreground font-semibold">{currentOdd.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ODI label */}
      <div className="mt-1.5 text-[9px] font-mono text-muted-foreground">
        ODI: {movementPct >= 0 ? '+' : ''}{movementPct.toFixed(1)}%
        {isSuspicious && (
          <span className="text-warning ml-2">• Mercado pode estar precificando errado</span>
        )}
      </div>
    </motion.div>
  );
}
