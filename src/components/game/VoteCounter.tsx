import { motion, AnimatePresence } from 'framer-motion';
import { Vote, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoteCounterProps {
  totalJurors: number;
  votesReceived: number;
  className?: string;
}

export default function VoteCounter({ totalJurors, votesReceived, className }: VoteCounterProps) {
  const allVoted = votesReceived >= totalJurors;
  const percentage = totalJurors > 0 ? (votesReceived / totalJurors) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col items-center gap-3 p-4 rounded-xl',
        'bg-gradient-to-br from-secondary/60 to-secondary/30 border border-border/50',
        className
      )}
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
        <AnimatePresence mode="wait">
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
        </AnimatePresence>
      </div>

      {/* Status text */}
      <motion.p
        key={votesReceived}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'text-sm font-medium',
          allVoted ? 'text-green-400' : 'text-muted-foreground'
        )}
      >
        {allVoted ? (
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4" /> Todos votaram!
          </span>
        ) : (
          <>
            <span className="font-orbitron text-mycroft-cyan">{votesReceived}</span>
            <span className="mx-1">de</span>
            <span className="font-orbitron">{totalJurors}</span>
            <span className="ml-1">votos recebidos</span>
          </>
        )}
      </motion.p>
    </motion.div>
  );
}
