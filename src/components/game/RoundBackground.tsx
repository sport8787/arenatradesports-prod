import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import cenario1 from '@/assets/cenario-1.png';
import cenario2 from '@/assets/cenario-2.png';
import cenario3 from '@/assets/cenario-3.png';

interface RoundBackgroundProps {
  round: number;
  className?: string;
}

export function getScenarioForRound(round: number): { image: string; name: string; phase: number } {
  if (round >= 11) {
    return { image: cenario3, name: 'O Grande Final', phase: 3 };
  } else if (round >= 6) {
    return { image: cenario2, name: 'A Pressão', phase: 2 };
  } else {
    return { image: cenario1, name: 'Backstage VIP', phase: 1 };
  }
}

export default function RoundBackground({ round, className = '' }: RoundBackgroundProps) {
  const scenario = getScenarioForRound(round);
  const [showFlash, setShowFlash] = useState(false);
  const [showPhaseName, setShowPhaseName] = useState(false);
  const previousPhaseRef = useRef(scenario.phase);
  
  // Detect phase change and trigger dramatic transition
  useEffect(() => {
    if (previousPhaseRef.current !== scenario.phase && round > 1) {
      // Trigger flash and phase name display
      setShowFlash(true);
      setShowPhaseName(true);
      
      // Hide flash after animation
      const flashTimer = setTimeout(() => setShowFlash(false), 800);
      
      // Hide phase name after display
      const nameTimer = setTimeout(() => setShowPhaseName(false), 3500);
      
      previousPhaseRef.current = scenario.phase;
      
      return () => {
        clearTimeout(flashTimer);
        clearTimeout(nameTimer);
      };
    }
  }, [scenario.phase, round]);
  
  return (
    <>
      {/* Flash Effect on Phase Change */}
      <AnimatePresence>
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, times: [0, 0.1, 0.3, 1] }}
            className="fixed inset-0 z-50 pointer-events-none"
            style={{
              background: scenario.phase === 3 
                ? 'radial-gradient(circle, rgba(255,50,50,0.9) 0%, rgba(139,0,0,0.7) 50%, transparent 100%)'
                : scenario.phase === 2
                ? 'radial-gradient(circle, rgba(255,165,0,0.9) 0%, rgba(255,100,0,0.7) 50%, transparent 100%)'
                : 'radial-gradient(circle, rgba(255,215,0,0.9) 0%, rgba(218,165,32,0.7) 50%, transparent 100%)'
            }}
          />
        )}
      </AnimatePresence>

      {/* Phase Name Overlay */}
      <AnimatePresence>
        {showPhaseName && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ 
              duration: 0.6, 
              ease: [0.34, 1.56, 0.64, 1]
            }}
            className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -50, opacity: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-center"
            >
              {/* Glowing background for text */}
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(255,215,0,0.3)',
                    '0 0 60px rgba(255,215,0,0.6)',
                    '0 0 20px rgba(255,215,0,0.3)'
                  ]
                }}
                transition={{ duration: 1.5, repeat: 1 }}
                className="px-12 py-6 rounded-2xl bg-background/80 backdrop-blur-md border-2 border-gold/50"
              >
                <motion.p
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 1.5, repeat: 1 }}
                  className="text-gold/80 font-orbitron text-sm uppercase tracking-[0.3em] mb-2"
                >
                  {scenario.phase === 3 ? 'Fase Final' : scenario.phase === 2 ? 'Fase 2' : 'Fase 1'}
                </motion.p>
                <motion.h2
                  initial={{ letterSpacing: '0.1em' }}
                  animate={{ letterSpacing: '0.2em' }}
                  transition={{ duration: 1 }}
                  className={`font-orbitron text-3xl md:text-5xl font-black uppercase ${
                    scenario.phase === 3 
                      ? 'text-red-500 drop-shadow-[0_0_30px_rgba(255,50,50,0.8)]' 
                      : scenario.phase === 2
                      ? 'text-orange-500 drop-shadow-[0_0_30px_rgba(255,165,0,0.8)]'
                      : 'text-gold drop-shadow-[0_0_30px_rgba(255,215,0,0.8)]'
                  }`}
                >
                  {scenario.name}
                </motion.h2>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Image with Zoom Effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scenario.name}
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ 
            duration: 1.5, 
            ease: [0.4, 0, 0.2, 1],
            scale: { duration: 2, ease: 'easeOut' }
          }}
          className={`fixed inset-0 z-0 ${className}`}
        >
          {/* Background Image with subtle continuous zoom */}
          <motion.div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${scenario.image})` }}
            animate={{ 
              scale: [1, 1.02, 1],
            }}
            transition={{ 
              duration: 20, 
              repeat: Infinity, 
              ease: 'easeInOut' 
            }}
          />
          
          {/* Dark overlay for readability - varies by phase */}
          <div 
            className={`absolute inset-0 transition-colors duration-1000 ${
              scenario.phase === 3 
                ? 'bg-gradient-to-b from-background/60 via-red-950/30 to-background/80'
                : scenario.phase === 2
                ? 'bg-gradient-to-b from-background/60 via-orange-950/20 to-background/80'
                : 'bg-gradient-to-b from-background/70 via-background/60 to-background/80'
            }`}
          />
          
          {/* Vignette effect */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_hsl(var(--background))_100%)] opacity-50" />
          
          {/* Animated particles/sparkles for dramatic effect */}
          {scenario.phase >= 2 && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(scenario.phase === 3 ? 12 : 6)].map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-1 h-1 rounded-full ${
                    scenario.phase === 3 ? 'bg-red-400' : 'bg-orange-400'
                  }`}
                  initial={{ 
                    x: `${Math.random() * 100}%`,
                    y: '100%',
                    opacity: 0 
                  }}
                  animate={{ 
                    y: '-10%',
                    opacity: [0, 1, 1, 0]
                  }}
                  transition={{
                    duration: 4 + Math.random() * 3,
                    repeat: Infinity,
                    delay: Math.random() * 5,
                    ease: 'linear'
                  }}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
