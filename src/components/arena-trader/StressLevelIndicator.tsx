import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

interface StressLevelIndicatorProps {
  level: 'Baixo' | 'Médio' | 'Crítico';
  balance: number;
  initialBalance: number;
}

const STRESS_CONFIG = {
  'Baixo': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'TRANQUILO', pulse: false },
  'Médio': { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'ATENÇÃO', pulse: false },
  'Crítico': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/40', label: 'CRÍTICO', pulse: true },
};

export default function StressLevelIndicator({ level, balance, initialBalance }: StressLevelIndicatorProps) {
  const config = STRESS_CONFIG[level] || STRESS_CONFIG['Baixo'];
  const balancePercent = Math.round((balance / initialBalance) * 100);

  return (
    <motion.div
      animate={config.pulse ? { borderColor: ['rgba(239,68,68,0.4)', 'rgba(239,68,68,0.8)', 'rgba(239,68,68,0.4)'] } : {}}
      transition={config.pulse ? { duration: 1.2, repeat: Infinity } : {}}
      className={`${config.bg} border ${config.border} rounded-lg p-2.5 flex items-center gap-2`}
    >
      <motion.div
        animate={config.pulse ? { scale: [1, 1.2, 1] } : {}}
        transition={config.pulse ? { duration: 0.8, repeat: Infinity } : {}}
      >
        <Activity className={`w-4 h-4 ${config.color}`} />
      </motion.div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-orbitron font-bold ${config.color} uppercase`}>
            {config.label}
          </span>
          <span className="text-[10px] text-white/40">{balancePercent}% da banca</span>
        </div>
        <div className="h-1 bg-white/5 rounded-full mt-1 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${balancePercent}%` }}
            className={`h-full rounded-full ${
              balancePercent > 80 ? 'bg-emerald-400' :
              balancePercent > 50 ? 'bg-amber-400' : 'bg-red-400'
            }`}
          />
        </div>
      </div>
    </motion.div>
  );
}
