import { motion } from 'framer-motion';
import { Skull, X } from 'lucide-react';
import { Player } from '@/types/game';
import { getAvatarColor, getInitials } from '@/lib/gameUtils';
import { useEffect, useState } from 'react';

interface EliminationAnimationProps {
  player: Player;
  onComplete?: () => void;
}

export default function EliminationAnimation({ player, onComplete }: EliminationAnimationProps) {
  const [phase, setPhase] = useState<'shake' | 'crack' | 'shatter' | 'skull'>('shake');

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('crack'), 800),
      setTimeout(() => setPhase('shatter'), 1600),
      setTimeout(() => setPhase('skull'), 2400),
      setTimeout(() => onComplete?.(), 4000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onComplete]);

  return (
    <div className="relative flex flex-col items-center justify-center py-8">
      {/* Background flash effect */}
      <motion.div
        className="absolute inset-0 bg-destructive/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'shake' ? [0, 0.5, 0] : 0 }}
        transition={{ duration: 0.3, repeat: phase === 'shake' ? 2 : 0 }}
      />

      {/* Falling X marks */}
      {phase === 'shatter' && (
        <>
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-destructive"
              initial={{ 
                opacity: 1, 
                x: 0, 
                y: 0,
                rotate: 0,
                scale: 1
              }}
              animate={{ 
                opacity: 0, 
                x: (Math.random() - 0.5) * 200,
                y: Math.random() * 150 + 50,
                rotate: Math.random() * 360,
                scale: 0
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ))}
        </>
      )}

      {/* Main avatar with effects */}
      <motion.div
        className="relative z-10"
        animate={
          phase === 'shake' 
            ? { x: [-10, 10, -10, 10, 0], rotate: [-5, 5, -5, 5, 0] }
            : phase === 'crack'
            ? { scale: [1, 1.1, 0.9, 1.05, 1] }
            : {}
        }
        transition={{ duration: 0.5, repeat: phase === 'shake' ? 2 : 0 }}
      >
        {phase !== 'skull' ? (
          <motion.div
            className={`w-24 h-24 rounded-full flex items-center justify-center font-orbitron font-bold text-2xl bg-gradient-to-br ${getAvatarColor(0)} relative overflow-hidden`}
            animate={
              phase === 'shatter' 
                ? { scale: [1, 0], opacity: [1, 0], rotate: [0, 180] }
                : {}
            }
            transition={{ duration: 0.8, ease: 'easeIn' }}
          >
            {getInitials(player.nickname)}
            
            {/* Crack overlay */}
            {phase === 'crack' && (
              <motion.div
                className="absolute inset-0 bg-destructive/50"
                initial={{ clipPath: 'polygon(50% 0%, 50% 0%, 50% 100%, 50% 100%)' }}
                animate={{ clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)' }}
                transition={{ duration: 0.8 }}
              >
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                  <motion.path
                    d="M50 0 L45 30 L55 35 L48 50 L58 55 L45 75 L52 100"
                    stroke="hsl(var(--destructive))"
                    strokeWidth="3"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.6 }}
                  />
                  <motion.path
                    d="M30 50 L50 48 L70 52"
                    stroke="hsl(var(--destructive))"
                    strokeWidth="2"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.4, delay: 0.3 }}
                  />
                </svg>
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div
            className="w-24 h-24 rounded-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 border-2 border-destructive"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 10 }}
          >
            <Skull className="w-12 h-12 text-destructive" />
          </motion.div>
        )}
      </motion.div>

      {/* Player name */}
      <motion.div
        className="mt-4 text-center"
        initial={{ opacity: 1 }}
        animate={{ opacity: phase === 'skull' ? 1 : 0.8 }}
      >
        <motion.p 
          className="font-orbitron text-xl text-foreground"
          animate={phase === 'skull' ? { color: 'hsl(var(--destructive))' } : {}}
        >
          {player.nickname}
        </motion.p>
      </motion.div>

      {/* ELIMINADO text */}
      {phase === 'skull' && (
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', damping: 8, delay: 0.3 }}
        >
          <h2 className="font-orbitron text-3xl text-destructive tracking-wider">
            ELIMINADO
          </h2>
          <motion.div
            className="h-1 bg-destructive mt-2 mx-auto"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.5, delay: 0.5 }}
          />
        </motion.div>
      )}

      {/* Blood drip effect */}
      {phase === 'skull' && (
        <div className="absolute top-0 left-0 right-0 flex justify-center gap-8 overflow-hidden h-32 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={i}
              className="w-2 bg-destructive rounded-full"
              initial={{ height: 0, y: -20 }}
              animate={{ height: [0, 40, 60, 80], y: [0, 20, 40, 60] }}
              transition={{ 
                duration: 2, 
                delay: i * 0.2,
                ease: 'easeIn'
              }}
              style={{ marginLeft: (i - 2) * 30 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
