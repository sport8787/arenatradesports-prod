import { motion } from 'framer-motion';
import { Zap, Gem, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BalanceHeaderProps {
  ntBalance: number;
  bcBalance: number;
  score?: number;
  showScore?: boolean;
  className?: string;
}

export function BalanceHeader({ 
  ntBalance, 
  bcBalance, 
  score = 0, 
  showScore = false,
  className 
}: BalanceHeaderProps) {
  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "bg-background/90 backdrop-blur-md border-b border-border/50",
        "px-4 py-2",
        className
      )}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-4 md:gap-8">
        {/* Neuro-Tokens (Blue) */}
        <motion.div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30"
          whileHover={{ scale: 1.05 }}
        >
          <Zap className="w-4 h-4 text-blue-400" />
          <span className="font-orbitron text-sm font-bold text-blue-400">
            {ntBalance.toLocaleString()}
          </span>
          <span className="text-xs text-blue-400/70 hidden sm:inline">NT</span>
        </motion.div>

        {/* BleffCoins (Green) */}
        <motion.div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30"
          whileHover={{ scale: 1.05 }}
        >
          <Gem className="w-4 h-4 text-emerald-400" />
          <span className="font-orbitron text-sm font-bold text-emerald-400">
            {bcBalance.toLocaleString()}
          </span>
          <span className="text-xs text-emerald-400/70 hidden sm:inline">BC</span>
        </motion.div>

        {/* Score (Gold) - only during game */}
        {showScore && (
          <motion.div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/30"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
          >
            <Trophy className="w-4 h-4 text-primary" />
            <span className="font-orbitron text-sm font-bold text-primary">
              {score.toLocaleString()}
            </span>
            <span className="text-xs text-primary/70 hidden sm:inline">SCORE</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
