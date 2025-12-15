import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CountdownTimer from './CountdownTimer';
import { BluffCoinCost } from './BluffCoinDisplay';

interface VotingPanelProps {
  onVote: (vote: 'believe' | 'doubt') => void;
  hasVoted: boolean;
  votedFor?: 'believe' | 'doubt';
  disabled?: boolean;
  onTimerComplete?: () => void;
  onTimerTick?: (secondsLeft: number) => void;
  timerActive?: boolean;
  doubtCost?: number;
  canAffordDoubt?: boolean;
}

export default function VotingPanel({ 
  onVote, 
  hasVoted, 
  votedFor, 
  disabled,
  onTimerComplete,
  onTimerTick,
  timerActive = true,
  doubtCost = 0,
  canAffordDoubt = true
}: VotingPanelProps) {
  const canDoubt = canAffordDoubt && !hasVoted && !disabled;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      {/* Timer */}
      <div className="flex justify-center">
        <CountdownTimer
          duration={30}
          isActive={timerActive && !hasVoted}
          onComplete={() => onTimerComplete?.()}
          onTick={onTimerTick}
        />
      </div>

      <div className="text-center">
        <h3 className="font-orbitron text-xl text-foreground mb-2">
          O Veredito
        </h3>
        <p className="text-muted-foreground">
          {hasVoted ? 'Aguardando outros jogadores...' : 'Você acredita ou duvida?'}
        </p>
      </div>

      <div className="flex gap-4">
        <motion.button
          whileHover={{ scale: hasVoted ? 1 : 1.03 }}
          whileTap={{ scale: hasVoted ? 1 : 0.97 }}
          onClick={() => !hasVoted && !disabled && onVote('believe')}
          disabled={hasVoted || disabled}
          className={cn(
            'vote-believe flex-1 py-6 rounded-xl flex flex-col items-center gap-3 transition-all',
            hasVoted && votedFor !== 'believe' && 'opacity-30',
            hasVoted && votedFor === 'believe' && 'ring-2 ring-success ring-offset-2 ring-offset-background'
          )}
        >
          {hasVoted && votedFor === 'believe' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <ThumbsUp className="w-8 h-8" />
          )}
          <span className="text-lg">Acreditar</span>
          <span className="text-xs text-muted-foreground">Grátis</span>
        </motion.button>

        <motion.button
          whileHover={{ scale: hasVoted || !canAffordDoubt ? 1 : 1.03 }}
          whileTap={{ scale: hasVoted || !canAffordDoubt ? 1 : 0.97 }}
          onClick={() => canDoubt && onVote('doubt')}
          disabled={hasVoted || disabled || !canAffordDoubt}
          className={cn(
            'vote-doubt flex-1 py-6 rounded-xl flex flex-col items-center gap-3 transition-all',
            hasVoted && votedFor !== 'doubt' && 'opacity-30',
            hasVoted && votedFor === 'doubt' && 'ring-2 ring-destructive ring-offset-2 ring-offset-background',
            !canAffordDoubt && !hasVoted && 'opacity-50 cursor-not-allowed'
          )}
        >
          {hasVoted && votedFor === 'doubt' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <ThumbsDown className="w-8 h-8" />
          )}
          <span className="text-lg">Duvidar</span>
          {doubtCost > 0 && (
            <BluffCoinCost amount={doubtCost} className={cn(!canAffordDoubt && 'text-destructive')} />
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
