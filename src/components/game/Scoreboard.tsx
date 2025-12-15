import { motion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { Player } from '@/types/game';
import { formatScore, getAvatarColor, getInitials } from '@/lib/gameUtils';
import { cn } from '@/lib/utils';
import BluffCoinDisplay from './BluffCoinDisplay';

interface ScoreboardProps {
  players: Player[];
  currentPlayerId?: string;
}

export default function Scoreboard({ players, currentPlayerId }: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.bluffcoins - a.bluffcoins);

  return (
    <div className="luxury-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
          Placar
        </h3>
      </div>

      <div className="space-y-2">
        {sortedPlayers.map((player, index) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className={cn(
              'flex items-center gap-3 p-2 rounded-lg transition-colors',
              player.id === currentPlayerId && 'bg-primary/10 border border-primary/30'
            )}
          >
            <span className="w-5 text-center font-orbitron text-xs text-muted-foreground">
              {index + 1}º
            </span>
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br',
                getAvatarColor(players.findIndex(p => p.id === player.id))
              )}
            >
              {getInitials(player.nickname)}
            </div>
            <span className="flex-1 text-sm font-medium truncate">
              {player.nickname}
            </span>
            <BluffCoinDisplay amount={player.bluffcoins} size="sm" showChange={false} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
