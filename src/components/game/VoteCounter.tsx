import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface VoteCounterProps {
  totalJurors: number;
  votesReceived: number;
  className?: string;
  onAllVoted?: () => void;
  countdownSeconds?: number;
}

export default function VoteCounter({ 
  totalJurors, 
  votesReceived, 
  className,
  onAllVoted,
  countdownSeconds = 3
}: VoteCounterProps) {
  const allVoted = votesReceived >= totalJurors && totalJurors > 0;
  const percentage = totalJurors > 0 ? (votesReceived / totalJurors) * 100 : 0;
  const [countdown, setCountdown] = useState<number | null>(null);
  const [hasTriggered, setHasTriggered] = useState(false);

  // Start countdown when all have voted
  useEffect(() => {
    if (allVoted && !hasTriggered) {
      setCountdown(countdownSeconds);
      setHasTriggered(true);
    }
  }, [allVoted, countdownSeconds, hasTriggered]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown <= 0) {
      onAllVoted?.();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, onAllVoted]);

  // Reset when votes change (new question)
  useEffect(() => {
    if (votesReceived === 0) {
      setCountdown(null);
      setHasTriggered(false);
    }
  }, [votesReceived]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center gap-3 p-4 rounded-xl',
        'bg-gradient-to-br from-secondary/60 to-secondary/30 border border-border/50',
        allVoted && 'border-green-500/50 bg-gradient-to-br from-green-500/10 to-green-500/5',
        className
      )}
    >
      {/* All voted celebration */}
      <AnimatePresence mode="sync">
        {allVoted && countdown !== null ? (
          <motion.div
            key="celebration"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="flex flex-col items-center gap-4 py-4"
          >
            {/* Sparkle animation */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
              className="relative"
            >
              <Sparkles className="w-10 h-10 text-green-400" />
              <motion.div
                className="absolute inset-0"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              >
                <Sparkles className="w-10 h-10 text-primary" />
              </motion.div>
            </motion.div>

            {/* Message */}
            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="font-orbitron text-lg text-green-400 uppercase tracking-wider"
            >
              Todos Votaram!
            </motion.p>

            {/* Countdown */}
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm text-muted-foreground">Revelando resultado em</p>
              <motion.div
                key={countdown}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative"
              >
                <motion.span 
                  className="font-orbitron text-4xl font-bold text-primary"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.5 }}
                >
                  {countdown}
                </motion.span>
                {/* Pulse ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-primary"
                  initial={{ scale: 1, opacity: 1 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity }}
                  style={{ margin: '-8px' }}
                />
              </motion.div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="voting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-full flex flex-col items-center gap-3"
          >
            <div className="flex items-center gap-2">
              <Vote className="w-5 h-5 text-mycroft-cyan" />
              <span className="font-orbitron text-sm uppercase tracking-wider text-foreground/80">
                Votos do Júri
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  allVoted
                    ? 'bg-gradient-to-r from-green-500 to-green-400'
                    : 'bg-gradient-to-r from-mycroft-cyan to-mycroft-green'
                )}
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Counter */}
            <div className="flex items-center gap-4">
              {[...Array(totalJurors)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ 
                    scale: 1, 
                    opacity: 1,
                  }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                    i < votesReceived
                      ? 'bg-mycroft-cyan/20 border-mycroft-cyan text-mycroft-cyan'
                      : 'bg-secondary/50 border-border/50 text-muted-foreground'
                  )}
                >
                  {i < votesReceived ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.div>
                  ) : (
                    <span className="text-xs font-orbitron">{i + 1}</span>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Status text */}
            <motion.p
              key={votesReceived}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-medium text-muted-foreground"
            >
              <span className="font-orbitron text-mycroft-cyan">{votesReceived}</span>
              <span className="mx-1">de</span>
              <span className="font-orbitron">{totalJurors}</span>
              <span className="ml-1">votos recebidos</span>
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
