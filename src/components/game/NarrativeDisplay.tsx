import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Zap, AlertTriangle, Crown, Skull } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ActConfig, NarrativeAct } from '@/services/narrativeEngine';

interface NarrativeDisplayProps {
  currentAct: ActConfig;
  round: number;
  silentObserverActive: boolean;
  className?: string;
}

const ACT_ICONS: Record<NarrativeAct, React.ReactNode> = {
  initiation: <Eye className="w-4 h-4" />,
  trial: <Zap className="w-4 h-4" />,
  ascension: <Crown className="w-4 h-4" />,
  fall: <AlertTriangle className="w-4 h-4" />,
  climax: <Skull className="w-4 h-4" />,
};

const ACT_COLORS: Record<NarrativeAct, string> = {
  initiation: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  trial: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  ascension: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  fall: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  climax: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function NarrativeDisplay({
  currentAct,
  round,
  silentObserverActive,
  className,
}: NarrativeDisplayProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Act indicator */}
      <motion.div
        key={currentAct.id}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-medium',
          ACT_COLORS[currentAct.id]
        )}
      >
        {ACT_ICONS[currentAct.id]}
        <span className="hidden sm:inline">{currentAct.name}</span>
        <span className="sm:hidden">Ato {['I', 'II', 'III', 'IV', 'V'][Object.keys(ACT_COLORS).indexOf(currentAct.id)]}</span>
      </motion.div>

      {/* Round counter */}
      <div className="text-xs text-muted-foreground">
        R{round}/15
      </div>

      {/* Silent Observer indicator */}
      <AnimatePresence mode="sync">
        {silentObserverActive && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30"
          >
            <Eye className="w-3 h-3" />
            <span className="text-xs hidden sm:inline">Observador</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pressure indicator */}
      {currentAct.pressureLevel >= 60 && (
        <motion.div
          animate={{
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
          }}
          className="flex items-center gap-1 text-xs text-destructive"
        >
          <AlertTriangle className="w-3 h-3" />
          <span className="hidden sm:inline">Pressão Alta</span>
        </motion.div>
      )}
    </div>
  );
}
