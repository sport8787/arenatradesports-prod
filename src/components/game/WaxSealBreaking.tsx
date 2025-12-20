import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';

interface WaxSealBreakingProps {
  isVisible: boolean;
  onAnimationComplete?: () => void;
}

export default function WaxSealBreaking({ isVisible, onAnimationComplete }: WaxSealBreakingProps) {
  const [phase, setPhase] = useState<'seal' | 'crack' | 'shatter' | 'done'>('seal');

  useEffect(() => {
    if (isVisible) {
      setPhase('seal');
      
      // Crack phase
      const crackTimer = setTimeout(() => setPhase('crack'), 600);
      // Shatter phase
      const shatterTimer = setTimeout(() => setPhase('shatter'), 1200);
      // Done
      const doneTimer = setTimeout(() => {
        setPhase('done');
        onAnimationComplete?.();
      }, 2200);
      
      return () => {
        clearTimeout(crackTimer);
        clearTimeout(shatterTimer);
        clearTimeout(doneTimer);
      };
    }
  }, [isVisible, onAnimationComplete]);

  // Generate random shards
  const shards = Array.from({ length: 12 }, (_, i) => ({
    id: i,
    angle: (360 / 12) * i + Math.random() * 30 - 15,
    distance: 80 + Math.random() * 120,
    rotation: Math.random() * 720 - 360,
    size: 8 + Math.random() * 16,
    delay: Math.random() * 0.2,
  }));

  return (
    <AnimatePresence>
      {isVisible && phase !== 'done' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none"
        >
          {/* Dark overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.9 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black"
          />
          
          <div className="relative">
            {/* Main seal */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={
                phase === 'shatter' 
                  ? { scale: 1.3, opacity: 0 }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ 
                duration: phase === 'shatter' ? 0.3 : 0.5,
                ease: phase === 'shatter' ? 'easeOut' : 'easeOut'
              }}
              className="relative"
            >
              {/* Outer ring */}
              <div className={`
                w-40 h-40 rounded-full 
                bg-gradient-to-br from-red-800 via-red-900 to-red-950
                shadow-[0_0_30px_rgba(220,38,38,0.5),inset_0_-4px_10px_rgba(0,0,0,0.4)]
                flex items-center justify-center
                ${phase === 'crack' ? 'animate-pulse' : ''}
              `}>
                {/* Inner design */}
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center shadow-inner">
                  {/* Horus eye symbol */}
                  <motion.div
                    animate={phase === 'crack' ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.3, repeat: phase === 'crack' ? Infinity : 0 }}
                    className="text-5xl"
                  >
                    👁️
                  </motion.div>
                </div>
              </div>
              
              {/* Crack lines overlay */}
              <AnimatePresence>
                {phase === 'crack' && (
                  <motion.svg
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 w-40 h-40"
                    viewBox="0 0 160 160"
                  >
                    {/* Crack lines */}
                    <motion.path
                      d="M80 0 L78 40 L85 60 L75 80 L82 100 L78 160"
                      fill="none"
                      stroke="rgba(0,0,0,0.8)"
                      strokeWidth="3"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4 }}
                    />
                    <motion.path
                      d="M0 80 L50 78 L70 85 L90 75 L120 82 L160 78"
                      fill="none"
                      stroke="rgba(0,0,0,0.8)"
                      strokeWidth="3"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, delay: 0.1 }}
                    />
                    <motion.path
                      d="M20 20 L50 50 L80 80 L110 110 L140 140"
                      fill="none"
                      stroke="rgba(0,0,0,0.7)"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.3, delay: 0.2 }}
                    />
                    <motion.path
                      d="M140 20 L110 50 L80 80 L50 110 L20 140"
                      fill="none"
                      stroke="rgba(0,0,0,0.7)"
                      strokeWidth="2"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.3, delay: 0.25 }}
                    />
                  </motion.svg>
                )}
              </AnimatePresence>
              
              {/* Glow effect when cracking */}
              {phase === 'crack' && (
                <motion.div
                  initial={{ opacity: 0, scale: 1 }}
                  animate={{ opacity: [0, 0.8, 0], scale: [1, 1.5, 2] }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 rounded-full bg-red-500/30 blur-xl"
                />
              )}
            </motion.div>
            
            {/* Shattering pieces */}
            <AnimatePresence>
              {phase === 'shatter' && shards.map((shard) => (
                <motion.div
                  key={shard.id}
                  initial={{ 
                    x: 0, 
                    y: 0, 
                    rotate: 0, 
                    opacity: 1,
                    scale: 1
                  }}
                  animate={{ 
                    x: Math.cos(shard.angle * Math.PI / 180) * shard.distance,
                    y: Math.sin(shard.angle * Math.PI / 180) * shard.distance + 50,
                    rotate: shard.rotation,
                    opacity: 0,
                    scale: 0.5
                  }}
                  transition={{ 
                    duration: 0.8, 
                    delay: shard.delay,
                    ease: 'easeOut'
                  }}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{
                    width: shard.size,
                    height: shard.size,
                  }}
                >
                  <div 
                    className="w-full h-full bg-gradient-to-br from-red-700 to-red-900 rounded-sm shadow-lg"
                    style={{
                      clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Impact flash */}
            {phase === 'shatter' && (
              <motion.div
                initial={{ opacity: 1, scale: 0.5 }}
                animate={{ opacity: 0, scale: 3 }}
                transition={{ duration: 0.5 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-red-500/50 rounded-full blur-2xl"
              />
            )}
            
            {/* Text reveal */}
            <AnimatePresence>
              {phase === 'shatter' && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 80, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                  className="absolute left-1/2 -translate-x-1/2 text-center"
                >
                  <p className="font-orbitron text-2xl text-destructive font-bold tracking-wider">
                    DESTINO REVELADO
                  </p>
                  <motion.div
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-sm text-muted-foreground mt-2"
                  >
                    A escolha foi feita...
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
