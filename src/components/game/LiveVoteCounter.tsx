/**
 * LiveVoteCounter - Contador de votos em tempo real (CLARO vs BLEFE)
 * Exibido para todos os jogadores durante a votação
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JuryVote {
  playerId: string;
  nickname: string;
  voteType: 'believe' | 'doubt';
  timestamp: number;
}

interface LiveVoteCounterProps {
  votes: JuryVote[];
  totalJuryMembers: number;
  showDetails?: boolean;
  compact?: boolean;
}

export function LiveVoteCounter({ 
  votes, 
  totalJuryMembers, 
  showDetails = false,
  compact = false
}: LiveVoteCounterProps) {
  const believeVotes = votes.filter(v => v.voteType === 'believe').length;
  const doubtVotes = votes.filter(v => v.voteType === 'doubt').length;
  const totalVotes = votes.length;
  const allVoted = totalVotes >= totalJuryMembers && totalJuryMembers > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/50">
            <ThumbsUp className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-emerald-400">{believeVotes}</span>
          </div>
          <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50">
            <ThumbsDown className="w-4 h-4 text-red-400" />
            <span className="font-bold text-red-400">{doubtVotes}</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalVotes}/{totalJuryMembers} votos
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30"
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          Votação em Tempo Real
        </h4>
        <span className={cn(
          "text-sm px-2 py-1 rounded-full",
          allVoted 
            ? "bg-success/20 text-success border border-success/50"
            : "bg-muted text-muted-foreground"
        )}>
          {totalVotes}/{totalJuryMembers} votos
        </span>
      </div>

      {/* Vote Progress Bars */}
      <div className="space-y-3">
        {/* CLARO (Believe) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-emerald-400">
              <ThumbsUp className="w-4 h-4" />
              CLARO
            </span>
            <span className="font-bold text-emerald-400">{believeVotes}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ 
                width: totalVotes > 0 ? `${(believeVotes / totalVotes) * 100}%` : '0%' 
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            />
          </div>
        </div>

        {/* BLEFE (Doubt) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-red-400">
              <ThumbsDown className="w-4 h-4" />
              BLEFE
            </span>
            <span className="font-bold text-red-400">{doubtVotes}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ 
                width: totalVotes > 0 ? `${(doubtVotes / totalVotes) * 100}%` : '0%' 
              }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-red-500 to-red-400"
            />
          </div>
        </div>
      </div>

      {/* Vote Details */}
      {showDetails && votes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/30">
          <p className="text-xs text-muted-foreground mb-2">Votos recebidos:</p>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence>
              {votes.map((vote) => (
                <motion.span
                  key={vote.playerId}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    vote.voteType === 'believe'
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-red-500/20 text-red-400 border border-red-500/30"
                  )}
                >
                  {vote.nickname}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* All Voted Celebration */}
      <AnimatePresence>
        {allVoted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-3 rounded-lg bg-gold/20 border border-gold/50 text-center"
          >
            <span className="text-sm font-medium text-gold flex items-center justify-center gap-2">
              ✨ Todos votaram!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default LiveVoteCounter;
