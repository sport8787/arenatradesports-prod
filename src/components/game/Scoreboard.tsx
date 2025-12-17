import { motion } from 'framer-motion';
import { Trophy, Search, Crown } from 'lucide-react';
import { Player } from '@/types/game';
import { formatScore, getAvatarColor, getInitials } from '@/lib/gameUtils';
import { cn } from '@/lib/utils';
import BluffCoinDisplay from './BluffCoinDisplay';
import RoleBadge from './RoleBadge';

interface ScoreboardProps {
  players: Player[];
  currentPlayerId?: string;
  hostSessionId?: string;
}

export default function Scoreboard({ players, currentPlayerId, hostSessionId }: ScoreboardProps) {
  const sortedPlayers = [...players].sort((a, b) => b.bluffcoins - a.bluffcoins);
  
  // Find the jury member with highest detective_score (potential successor)
  const juryMembers = players.filter(p => !(hostSessionId && p.session_id === hostSessionId));
  const topDetective = juryMembers.length > 0 
    ? juryMembers.reduce((top, p) => (p.detective_score > top.detective_score ? p : top), juryMembers[0])
    : null;
  const hasTopDetective = topDetective && topDetective.detective_score > 0;

  return (
    <div className="luxury-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-primary" />
        <h3 className="font-orbitron text-sm uppercase tracking-wider text-primary">
          Placar
        </h3>
      </div>

      <div className="space-y-2">
        {sortedPlayers.map((player, index) => {
          const isHost = hostSessionId && player.session_id === hostSessionId;
          const isTopDetective = hasTopDetective && player.id === topDetective?.id;
          
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg transition-colors relative',
                player.id === currentPlayerId && 'bg-primary/10 border border-primary/30',
                isHost && 'border-l-2 border-l-primary',
                isTopDetective && 'bg-cyan-500/10 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
              )}
            >
              {/* Potential successor indicator */}
              {isTopDetective && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="absolute -top-1 -right-1"
                >
                  <div className="relative">
                    <Crown className="w-4 h-4 text-cyan-400" />
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 blur-sm"
                    >
                      <Crown className="w-4 h-4 text-cyan-400" />
                    </motion.div>
                  </div>
                </motion.div>
              )}
              
              <span className="w-5 text-center font-orbitron text-xs text-muted-foreground">
                {index + 1}º
              </span>
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br shrink-0',
                  getAvatarColor(players.findIndex(p => p.id === player.id)),
                  isTopDetective && 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-background'
                )}
              >
                {getInitials(player.nickname)}
              </div>
              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-sm font-medium truncate block',
                  isTopDetective && 'text-cyan-300'
                )}>
                  {player.nickname}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <RoleBadge role={isHost ? 'host' : 'jury'} size="sm" />
                  {!isHost && player.detective_score > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={cn(
                        'flex items-center gap-0.5 px-1.5 py-0.5 rounded border',
                        isTopDetective 
                          ? 'bg-cyan-500/30 border-cyan-400/50' 
                          : 'bg-cyan-500/20 border-cyan-500/30'
                      )}
                    >
                      <Search className="w-3 h-3 text-cyan-400" />
                      <span className="text-[10px] font-orbitron text-cyan-400 font-bold">
                        {player.detective_score}
                      </span>
                    </motion.div>
                  )}
                  {isTopDetective && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[9px] font-orbitron text-cyan-400/80 uppercase tracking-wider"
                    >
                      Sucessor
                    </motion.span>
                  )}
                </div>
              </div>
              <BluffCoinDisplay amount={player.bluffcoins} size="sm" showChange={false} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
