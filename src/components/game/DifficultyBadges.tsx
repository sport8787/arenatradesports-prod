import { motion } from 'framer-motion';

interface DifficultyMode {
  id: string;
  label: string;
  difficulty: number;
  icon: string;
  reward: string;
  time: string;
  colorClass: string;
  bgClass: string;
}

export default function DifficultyBadges() {
  const modes: DifficultyMode[] = [
    { 
      id: 'quick',
      label: 'Aquecimento', 
      difficulty: 1, 
      icon: '⚡',
      reward: '100 BC',
      time: '3-5 min',
      colorClass: 'text-emerald-400 border-emerald-500/50',
      bgClass: 'from-emerald-500/20 to-emerald-500/5'
    },
    { 
      id: 'standard',
      label: 'Desafio', 
      difficulty: 2, 
      icon: '🎯',
      reward: '500 BC',
      time: '8-12 min',
      colorClass: 'text-amber-400 border-amber-500/50',
      bgClass: 'from-amber-500/20 to-amber-500/5'
    },
    { 
      id: 'extreme',
      label: 'Extremo', 
      difficulty: 3, 
      icon: '💀',
      reward: '2.000 BC',
      time: '15-20 min',
      colorClass: 'text-red-400 border-red-500/50',
      bgClass: 'from-red-500/20 to-red-500/5'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="grid grid-cols-3 gap-2"
    >
      {modes.map((mode, index) => (
        <motion.div
          key={mode.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * index }}
          className={`
            bg-gradient-to-b ${mode.bgClass}
            border ${mode.colorClass} rounded-lg p-2 text-center
          `}
        >
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="text-base">{mode.icon}</span>
            <span className={`text-xs font-bold ${mode.colorClass}`}>{mode.label}</span>
          </div>
          
          <div className="flex justify-center gap-0.5 mb-1">
            {[...Array(3)].map((_, i) => (
              <span 
                key={i}
                className={`text-xs ${i < mode.difficulty ? mode.colorClass : 'text-muted-foreground/30'}`}
              >
                ★
              </span>
            ))}
          </div>
          
          <div className="space-y-0.5 text-[10px] text-muted-foreground">
            <div className="flex items-center justify-center gap-1">
              <span>🏆</span>
              <span>{mode.reward}</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <span>⏱️</span>
              <span>{mode.time}</span>
            </div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
