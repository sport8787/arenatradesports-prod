import { motion } from 'framer-motion';
import { Crosshair } from 'lucide-react';

interface MilharPressureMeterProps {
  currentPrice: number;
  milharStep: number; // 1000 for WIN, 50 for WDO
  symbol: string;
}

export default function MilharPressureMeter({ currentPrice, milharStep, symbol }: MilharPressureMeterProps) {
  const nearestMilhar = Math.round(currentPrice / milharStep) * milharStep;
  const distancePoints = Math.abs(currentPrice - nearestMilhar);
  const maxZone = milharStep * 0.05; // 5% of milhar = "war zone" (50 pts for WIN)
  const pressurePct = Math.max(0, Math.min(100, (1 - distancePoints / maxZone) * 100));
  const isInWarZone = distancePoints <= 50 && symbol === 'WIN' || distancePoints <= 5 && symbol === 'WDO';
  const isAbove = currentPrice > nearestMilhar;
  const direction = isAbove ? 'ROMPENDO ↑' : 'REJEITANDO ↓';

  return (
    <div className={`rounded-xl p-3 border transition-all ${
      isInWarZone
        ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
        : 'bg-[#111111] border-white/10'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Crosshair className={`w-4 h-4 ${isInWarZone ? 'text-amber-400 animate-pulse' : 'text-white/30'}`} />
        <span className="text-[10px] font-bold text-amber-400/80 uppercase">Pressão da Milhar</span>
        <span className="ml-auto text-[10px] font-orbitron text-white/60">
          {nearestMilhar.toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pressurePct}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full rounded-full ${
            pressurePct > 80 ? 'bg-red-500' :
            pressurePct > 50 ? 'bg-amber-400' : 'bg-white/20'
          }`}
        />
      </div>

      <div className="flex items-center justify-between text-[9px]">
        <span className="text-white/40">
          {distancePoints.toFixed(0)} pts da milhar
        </span>
        {isInWarZone && (
          <span className={`font-bold ${isAbove ? 'text-emerald-400' : 'text-red-400'}`}>
            ⚔️ ZONA DE GUERRA — {direction}
          </span>
        )}
      </div>
    </div>
  );
}
