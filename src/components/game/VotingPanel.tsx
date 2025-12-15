import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import CountdownTimer from './CountdownTimer';
import { BluffCoinCost } from './BluffCoinDisplay';
import cartaClaro from '@/assets/carta_claro.png';
import cartaBlefe from '@/assets/carta_blefe.png';

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
          {hasVoted ? 'Aguardando outros jogadores...' : 'Escolha sua carta'}
        </p>
      </div>

      <div className="flex gap-6 justify-center">
        {/* Carta CLARO (Acreditar) */}
        <motion.button
          whileHover={{ scale: hasVoted ? 1 : 1.05, y: hasVoted ? 0 : -10 }}
          whileTap={{ scale: hasVoted ? 1 : 0.95 }}
          onClick={() => !hasVoted && !disabled && onVote('believe')}
          disabled={hasVoted || disabled}
          className={cn(
            'relative transition-all duration-300',
            hasVoted && votedFor !== 'believe' && 'opacity-30 scale-90',
            hasVoted && votedFor === 'believe' && 'ring-4 ring-success ring-offset-4 ring-offset-background rounded-2xl'
          )}
        >
          <img 
            src={cartaClaro} 
            alt="CLARO - Acreditar" 
            className="w-32 h-48 object-cover rounded-xl shadow-lg"
          />
          {hasVoted && votedFor === 'believe' && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin text-success" />
            </div>
          )}
          <p className="text-xs text-center mt-2 text-muted-foreground">Grátis</p>
        </motion.button>

        {/* Carta BLEFE (Duvidar) */}
        <motion.button
          whileHover={{ scale: hasVoted || !canAffordDoubt ? 1 : 1.05, y: hasVoted || !canAffordDoubt ? 0 : -10 }}
          whileTap={{ scale: hasVoted || !canAffordDoubt ? 1 : 0.95 }}
          onClick={() => canDoubt && onVote('doubt')}
          disabled={hasVoted || disabled || !canAffordDoubt}
          className={cn(
            'relative transition-all duration-300',
            hasVoted && votedFor !== 'doubt' && 'opacity-30 scale-90',
            hasVoted && votedFor === 'doubt' && 'ring-4 ring-destructive ring-offset-4 ring-offset-background rounded-2xl',
            !canAffordDoubt && !hasVoted && 'opacity-50 cursor-not-allowed grayscale'
          )}
        >
          <img 
            src={cartaBlefe} 
            alt="BLEFE - Duvidar" 
            className="w-32 h-48 object-cover rounded-xl shadow-lg"
          />
          {hasVoted && votedFor === 'doubt' && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin text-destructive" />
            </div>
          )}
          {doubtCost > 0 && (
            <div className="text-center mt-2">
              <BluffCoinCost amount={doubtCost} className={cn('text-xs', !canAffordDoubt && 'text-destructive')} />
            </div>
          )}
        </motion.button>
      </div>
    </motion.div>
  );
}
