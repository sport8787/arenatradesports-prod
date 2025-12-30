import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { BotVote, ShadowPlayer } from '@/types/bot';
import { useSoundEffects } from '@/hooks/useSoundEffects';

interface VoteRevealProps {
  votes: BotVote[];
  shadowPlayers: ShadowPlayer[];
  onComplete: () => void;
  revealIntervalMs?: number;
}

export function VoteReveal({
  votes,
  shadowPlayers,
  onComplete,
  revealIntervalMs = 1000
}: VoteRevealProps) {
  const [revealedCount, setRevealedCount] = useState(0);
  const { playVote, playChips, playError } = useSoundEffects();
  const hasCompletedRef = useRef(false);
  const isMountedRef = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (completeTimeoutRef.current) clearTimeout(completeTimeoutRef.current);
    };
  }, []);
  
  useEffect(() => {
    if (revealedCount >= votes.length) {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        // Small delay after last vote before completing
        completeTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            onComplete();
          }
        }, 800);
      }
      return;
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      
      // Play sound effect for each vote reveal
      const vote = votes[revealedCount];
      if (vote.vote === 'believe') {
        playChips();
      } else {
        playError();
      }
      
      setRevealedCount(prev => prev + 1);
    }, revealIntervalMs);
    
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [revealedCount, votes.length, revealIntervalMs, onComplete, playVote, playChips, playError, votes]);
  
  return (
    <div className="space-y-6 py-4">
      <h3 className="font-orbitron text-lg text-center text-foreground">
        Votos dos Jogadores
      </h3>
      
      <div className="grid grid-cols-3 gap-4">
        {votes.map((vote, i) => {
          const player = shadowPlayers.find(p => p.id === vote.botId);
          const isRevealed = i < revealedCount;
          const isNextToReveal = i === revealedCount;
          
          return (
            <div
              key={`vote-${vote.botId}-${i}`}
              className="relative"
            >
              {/* Unrevealed state - card back */}
              {!isRevealed ? (
                <motion.div
                  initial={{ rotateY: 0 }}
                  animate={{ 
                    rotateY: 0,
                    scale: isNextToReveal ? [1, 1.02, 1] : 1
                  }}
                  transition={{ 
                    scale: { duration: 0.5, repeat: isNextToReveal ? Infinity : 0 }
                  }}
                  className={`p-4 rounded-lg border-2 text-center transition-all duration-300 ${
                    isNextToReveal 
                      ? 'bg-primary/10 border-primary/50 shadow-lg shadow-primary/20' 
                      : 'bg-secondary/30 border-border/30'
                  }`}
                  style={{ perspective: '1000px' }}
                >
                  <span className="text-3xl opacity-50">{player?.avatar}</span>
                  <p className="font-orbitron text-xs mt-2 text-muted-foreground">{vote.botName}</p>
                  <div className="mt-2 h-6 flex items-center justify-center">
                    {isNextToReveal ? (
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="text-xs text-primary font-semibold"
                      >
                        Revelando...
                      </motion.div>
                    ) : (
                      <div className="text-xs text-muted-foreground">• • •</div>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ rotateY: 90, scale: 0.8 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ 
                    type: 'spring',
                    stiffness: 300,
                    damping: 20
                  }}
                  className={`p-4 rounded-lg border-2 text-center ${
                    vote.vote === 'believe' 
                      ? 'bg-success/10 border-success/50' 
                      : 'bg-destructive/10 border-destructive/50'
                  }`}
                >
                  <motion.span 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 400 }}
                    className="text-3xl block"
                  >
                    {player?.avatar}
                  </motion.span>
                  <p className="font-orbitron text-xs mt-2">{vote.botName}</p>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className={`font-bold text-sm mt-2 flex items-center justify-center gap-1 ${
                      vote.vote === 'believe' ? 'text-success' : 'text-destructive'
                    }`}
                  >
                    {vote.vote === 'believe' ? (
                      <>
                        <Check className="w-4 h-4" />
                        CLARO
                      </>
                    ) : (
                      <>
                        <X className="w-4 h-4" />
                        BLEFE
                      </>
                    )}
                  </motion.div>
                </motion.div>
              )}
              
              {/* Impact effect when revealing */}
              {isRevealed && i === revealedCount - 1 && (
                <motion.div
                  initial={{ scale: 0.5, opacity: 1 }}
                  animate={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className={`absolute inset-0 rounded-lg border-4 pointer-events-none ${
                    vote.vote === 'believe' ? 'border-success' : 'border-destructive'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      
      {/* Vote count summary - only show after all revealed */}
      <AnimatePresence>
        {revealedCount >= votes.length && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center space-y-2"
          >
            <div className="flex justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm text-success font-orbitron">
                  {votes.filter(v => v.vote === 'believe').length} CLARO
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span className="text-sm text-destructive font-orbitron">
                  {votes.filter(v => v.vote === 'doubt').length} BLEFE
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
