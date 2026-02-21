import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { getTierColor, type Achievement } from '@/services/traderAchievementsService';

interface Props {
  achievement: Achievement;
  onClose: () => void;
}

export default function AchievementToast({ achievement, onClose }: Props) {
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      onAnimationComplete={() => setTimeout(onClose, 4000)}
      className={`fixed top-20 right-4 z-50 rounded-xl border p-4 backdrop-blur-lg shadow-2xl max-w-xs ${getTierColor(achievement.tier)}`}
    >
      <div className="flex items-center gap-3">
        <div className="text-3xl">{achievement.icon}</div>
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Trophy className="w-3 h-3" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Conquista Desbloqueada!</span>
          </div>
          <p className="font-orbitron text-sm font-bold">{achievement.name}</p>
          <p className="text-xs opacity-80">{achievement.description}</p>
        </div>
      </div>
    </motion.div>
  );
}
