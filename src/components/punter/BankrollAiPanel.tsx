import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { quickKelly, getRiskColor } from '@/services/bankrollAiService';
import { useBankroll } from '@/hooks/useBankroll';
import { Calculator, DollarSign, TrendingDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function BankrollAiPanel() {
  const { user } = useAuth();
  const { bankroll } = useBankroll();
  const [probability, setProbability] = useState(55);
  const [odd, setOdd] = useState(1.90);

  const balance = bankroll?.balance || 10000;
  const initialBalance = bankroll?.initial_balance || 10000;
  const drawdownPct = ((initialBalance - balance) / initialBalance) * 100;

  const kelly = quickKelly(probability / 100, odd, balance);

  // Drawdown protection visualization
  const drawdownLevel = drawdownPct >= 30 ? 'EXTREME' : drawdownPct >= 20 ? 'HIGH' : drawdownPct >= 10 ? 'MEDIUM' : 'LOW';
  const drawdownReduction = drawdownPct >= 30 ? 75 : drawdownPct >= 20 ? 50 : drawdownPct >= 10 ? 25 : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="w-4 h-4 text-primary" />
        <span className="font-mono text-xs font-bold text-foreground">BANKROLL AI — KELLY CRITERION</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] font-mono text-muted-foreground block mb-1">PROBABILIDADE (%)</label>
          <input
            type="number"
            value={probability}
            onChange={e => setProbability(Number(e.target.value))}
            min={1} max={99} step={1}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="text-[9px] font-mono text-muted-foreground block mb-1">ODD</label>
          <input
            type="number"
            value={odd}
            onChange={e => setOdd(Number(e.target.value))}
            min={1.01} max={100} step={0.01}
            className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <motion.div key={`${probability}-${odd}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
        {/* Kelly Result */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
            <DollarSign className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-[9px] font-mono text-muted-foreground">STAKE KELLY ¼</p>
            <p className="text-lg font-mono font-bold text-primary">
              {kelly.stakePercent > 0 ? `${kelly.stakePercent}%` : '—'}
            </p>
            <p className="text-[10px] font-mono text-muted-foreground">
              R$ {kelly.stakeAmount.toFixed(2)}
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
            <TrendingDown className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-[9px] font-mono text-muted-foreground">EDGE</p>
            <p className={cn("text-lg font-mono font-bold", kelly.edge > 0 ? 'text-green-400' : 'text-red-400')}>
              {kelly.edge.toFixed(1)}%
            </p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 border border-border text-center">
            <Shield className="w-4 h-4 mx-auto text-accent mb-1" />
            <p className="text-[9px] font-mono text-muted-foreground">RISCO</p>
            <p className={cn("text-sm font-mono font-bold", getRiskColor(drawdownLevel as any))}>
              {drawdownLevel}
            </p>
          </div>
        </div>

        {/* Drawdown Protection */}
        <div className="bg-muted/30 rounded-lg p-3 border border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-muted-foreground">PROTEÇÃO DE DRAWDOWN</span>
            <span className={cn("text-[10px] font-mono font-bold", drawdownReduction > 0 ? 'text-orange-400' : 'text-green-400')}>
              {drawdownReduction > 0 ? `−${drawdownReduction}% stake` : 'NORMAL'}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={cn("h-2 rounded-full transition-all",
                drawdownPct >= 30 ? 'bg-red-500' : drawdownPct >= 20 ? 'bg-orange-500' : drawdownPct >= 10 ? 'bg-yellow-500' : 'bg-green-500'
              )}
              style={{ width: `${Math.min(100, Math.max(0, drawdownPct * 3.33))}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[8px] font-mono text-muted-foreground">0%</span>
            <span className="text-[8px] font-mono text-muted-foreground">DD: {drawdownPct.toFixed(1)}%</span>
            <span className="text-[8px] font-mono text-muted-foreground">30%</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
