import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getAvatarColor, getInitials, formatScore } from '@/lib/gameUtils';
import { Player } from '@/types/game';
import { Crown } from 'lucide-react';

interface PlayerAvatarProps {
  player: Player;
  index: number;
  isCurrentPlayer?: boolean;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function PlayerAvatar({ 
  player, 
  index, 
  isCurrentPlayer = false, 
  showScore = true,
  size = 'md' 
}: PlayerAvatarProps) {
  const sizes = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-base',
    lg: 'w-20 h-20 text-xl',
  };

  return (
    <motion.div 
      className="flex flex-col items-center gap-2"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="relative">
        {player.is_host && (
          <Crown className="absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 text-primary" />
        )}
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-orbitron font-bold bg-gradient-to-br',
            sizes[size],
            getAvatarColor(index),
            isCurrentPlayer && 'ring-2 ring-primary ring-offset-2 ring-offset-background animate-pulse-glow'
          )}
        >
          {getInitials(player.nickname)}
        </div>
        {isCurrentPlayer && (
          <motion.div
            className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          />
        )}
      </div>
      <span className="text-sm font-medium text-foreground/80 truncate max-w-[80px]">
        {player.nickname}
      </span>
      {showScore && (
        <span className="text-xs font-orbitron text-primary">
          {formatScore(player.score)}
        </span>
      )}
    </motion.div>
  );
}
