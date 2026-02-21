import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Lock } from 'lucide-react';
import { ACHIEVEMENTS, getTierColor, type Achievement } from '@/services/traderAchievementsService';

interface Props {
  unlockedIds: string[];
}

export default function AchievementsPanel({ unlockedIds }: Props) {
  return (
    <div className="bg-[#111111] border border-amber-900/30 rounded-xl p-4">
      <h3 className="font-orbitron text-xs font-bold text-amber-400/80 uppercase mb-3 flex items-center gap-2">
        <Trophy className="w-4 h-4" />
        Conquistas ({unlockedIds.length}/{ACHIEVEMENTS.length})
      </h3>
      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
        {ACHIEVEMENTS.map((ach) => {
          const unlocked = unlockedIds.includes(ach.id);
          return (
            <div
              key={ach.id}
              className={`relative rounded-lg border p-2 text-center transition-all ${
                unlocked
                  ? getTierColor(ach.tier)
                  : 'border-white/10 bg-white/5 opacity-40'
              }`}
            >
              <div className="text-xl mb-1">{unlocked ? ach.icon : '🔒'}</div>
              <p className="text-[10px] font-bold leading-tight">{ach.name}</p>
              <p className="text-[8px] opacity-70 mt-0.5 leading-tight">{ach.description}</p>
              {unlocked && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center"
                >
                  <span className="text-[8px] text-black font-bold">✓</span>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
