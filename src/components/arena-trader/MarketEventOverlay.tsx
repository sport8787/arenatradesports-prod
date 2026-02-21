import { motion, AnimatePresence } from 'framer-motion';
import { Zap, TrendingDown, TrendingUp, Newspaper } from 'lucide-react';

export type MarketEventType = 'flash_crash' | 'pump_dump' | 'breaking_news';

export interface MarketEvent {
  type: MarketEventType;
  title: string;
  description: string;
  priceImpact: number; // percentage, negative for crash
  active: boolean;
}

interface MarketEventOverlayProps {
  event: MarketEvent | null;
}

const EVENT_CONFIG: Record<MarketEventType, { icon: typeof Zap; color: string; bgClass: string }> = {
  flash_crash: { icon: TrendingDown, color: 'text-red-400', bgClass: 'from-red-900/40 to-transparent' },
  pump_dump: { icon: TrendingUp, color: 'text-amber-400', bgClass: 'from-amber-900/30 to-transparent' },
  breaking_news: { icon: Newspaper, color: 'text-cyan-400', bgClass: 'from-cyan-900/30 to-transparent' },
};

export default function MarketEventOverlay({ event }: MarketEventOverlayProps) {
  if (!event?.active) return null;

  const config = EVENT_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-[90vw]`}
      >
        <motion.div
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className={`bg-gradient-to-b ${config.bgClass} border border-white/10 rounded-xl p-4 backdrop-blur-lg shadow-2xl`}
        >
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
              className={`w-10 h-10 rounded-full bg-white/10 flex items-center justify-center`}
            >
              <Icon className={`w-5 h-5 ${config.color}`} />
            </motion.div>
            <div className="flex-1">
              <h3 className={`font-orbitron text-sm font-bold ${config.color} uppercase`}>
                {event.title}
              </h3>
              <p className="text-xs text-white/70 mt-0.5">{event.description}</p>
            </div>
            <div className={`font-orbitron text-lg font-bold ${event.priceImpact >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {event.priceImpact >= 0 ? '+' : ''}{event.priceImpact}%
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
