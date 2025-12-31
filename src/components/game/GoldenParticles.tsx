import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  rotation: number;
}

interface GoldenParticlesProps {
  isActive: boolean;
  onComplete?: () => void;
}

export const GoldenParticles = ({ isActive, onComplete }: GoldenParticlesProps) => {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (isActive) {
      const newParticles: Particle[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 12 + 4,
        delay: Math.random() * 0.5,
        duration: Math.random() * 1.5 + 1,
        rotation: Math.random() * 360,
      }));
      setParticles(newParticles);

      const timer = setTimeout(() => {
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    } else {
      setParticles([]);
    }
  }, [isActive, onComplete]);

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Golden glow overlay */}
          <motion.div
            className="absolute inset-0 bg-gradient-radial from-gold/20 via-transparent to-transparent"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.5, 0], scale: [0.5, 1.5, 2] }}
            transition={{ duration: 2.5, ease: "easeOut" }}
          />

          {/* Particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
              }}
              initial={{ 
                opacity: 0, 
                scale: 0,
                y: 0,
                rotate: 0
              }}
              animate={{ 
                opacity: [0, 1, 1, 0],
                scale: [0, 1.2, 1, 0.5],
                y: [0, -100 - Math.random() * 200],
                rotate: [0, particle.rotation]
              }}
              transition={{
                duration: particle.duration + 1,
                delay: particle.delay,
                ease: "easeOut"
              }}
            >
              {/* Coin-like particle */}
              <div 
                className="rounded-full bg-gradient-to-br from-yellow-300 via-gold to-yellow-600 shadow-lg"
                style={{
                  width: particle.size,
                  height: particle.size,
                  boxShadow: `0 0 ${particle.size}px rgba(255, 215, 0, 0.6), 0 0 ${particle.size * 2}px rgba(255, 215, 0, 0.3)`
                }}
              />
            </motion.div>
          ))}

          {/* Sparkle bursts */}
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={`sparkle-${i}`}
              className="absolute left-1/2 top-1/2"
              initial={{ opacity: 0, scale: 0 }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 2, 3],
                x: Math.cos((i / 8) * Math.PI * 2) * 150,
                y: Math.sin((i / 8) * Math.PI * 2) * 150,
              }}
              transition={{
                duration: 1.5,
                delay: 0.2 + i * 0.05,
                ease: "easeOut"
              }}
            >
              <div className="w-3 h-3 bg-gold rotate-45 shadow-[0_0_10px_#FFD700,0_0_20px_#FFD700]" />
            </motion.div>
          ))}

          {/* Central burst */}
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ 
              opacity: [0, 1, 0],
              scale: [0, 3, 5]
            }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <div className="w-20 h-20 rounded-full bg-gradient-radial from-gold/80 via-yellow-400/50 to-transparent blur-sm" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
