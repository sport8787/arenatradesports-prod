import { motion } from 'framer-motion';

interface UserStatsProps {
  matchesPlayed: number;
  wins: number;
  winRate?: number;
  streak?: number;
}

export default function UserStats({ matchesPlayed, wins, winRate, streak }: UserStatsProps) {
  const calculatedWinRate = winRate ?? (matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0);
  
  const stats = [
    { 
      icon: '🎮', 
      label: 'Partidas', 
      value: matchesPlayed,
      colorClass: 'border-blue-500/50 before:bg-blue-500'
    },
    { 
      icon: '🏆', 
      label: 'Vitórias', 
      value: wins,
      colorClass: 'border-gold/50 before:bg-gold'
    },
    { 
      icon: '🎯', 
      label: 'Taxa', 
      value: `${calculatedWinRate}%`,
      colorClass: 'border-emerald-500/50 before:bg-emerald-500'
    },
    { 
      icon: '🔥', 
      label: 'Sequência', 
      value: streak ?? 0,
      colorClass: 'border-orange-500/50 before:bg-orange-500'
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-4 gap-2"
    >
      {stats.map((stat, index) => (
        <motion.div 
          key={stat.label}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 * index }}
          className={`
            relative bg-gradient-to-b from-background/80 to-background/40 
            border rounded-lg p-2 text-center overflow-hidden
            before:absolute before:left-0 before:top-0 before:w-1 before:h-full before:shadow-lg
            ${stat.colorClass}
          `}
        >
          <div className="text-lg mb-0.5 filter drop-shadow-md">{stat.icon}</div>
          <div className="font-orbitron font-bold text-sm text-foreground">{stat.value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</div>
        </motion.div>
      ))}
    </motion.div>
  );
}
