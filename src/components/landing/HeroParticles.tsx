import { motion } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
  type: 'coin' | 'sparkle' | 'dust';
}

export const HeroParticles = () => {
  const [isActive, setIsActive] = useState(true);

  const particles = useMemo(() => {
    const items: Particle[] = [];
    
    // Golden coins
    for (let i = 0; i < 15; i++) {
      items.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 10 + 6,
        delay: Math.random() * 5,
        duration: Math.random() * 8 + 6,
        opacity: Math.random() * 0.4 + 0.2,
        type: 'coin',
      });
    }
    
    // Sparkles
    for (let i = 15; i < 35; i++) {
      items.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2,
        delay: Math.random() * 3,
        duration: Math.random() * 4 + 3,
        opacity: Math.random() * 0.6 + 0.3,
        type: 'sparkle',
      });
    }
    
    // Dust particles
    for (let i = 35; i < 60; i++) {
      items.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 4,
        duration: Math.random() * 10 + 8,
        opacity: Math.random() * 0.3 + 0.1,
        type: 'dust',
      });
    }
    
    return items;
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, particle.opacity, particle.opacity, 0],
            scale: [0, 1, 1, 0.5],
            y: [0, -50 - Math.random() * 100],
            x: particle.type === 'dust' ? [0, (Math.random() - 0.5) * 50] : 0,
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {particle.type === 'coin' && (
            <div
              className="rounded-full bg-gradient-to-br from-yellow-300 via-primary to-yellow-600"
              style={{
                width: particle.size,
                height: particle.size,
                boxShadow: `0 0 ${particle.size}px hsl(var(--primary) / 0.4)`,
              }}
            />
          )}
          {particle.type === 'sparkle' && (
            <div
              className="bg-primary rotate-45"
              style={{
                width: particle.size,
                height: particle.size,
                boxShadow: `0 0 ${particle.size * 2}px hsl(var(--primary) / 0.6)`,
              }}
            />
          )}
          {particle.type === 'dust' && (
            <div
              className="rounded-full bg-primary/60"
              style={{
                width: particle.size,
                height: particle.size,
              }}
            />
          )}
        </motion.div>
      ))}

      {/* Floating orbs */}
      <motion.div
        className="absolute top-1/4 left-1/6 w-2 h-2 rounded-full bg-primary"
        animate={{
          y: [0, -20, 0],
          opacity: [0.3, 0.8, 0.3],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.5)' }}
      />
      <motion.div
        className="absolute top-1/3 right-1/4 w-3 h-3 rounded-full bg-mycroft-green"
        animate={{
          y: [0, -30, 0],
          opacity: [0.3, 0.7, 0.3],
          scale: [1, 1.3, 1],
        }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        style={{ boxShadow: '0 0 25px hsl(var(--mycroft-green) / 0.5)' }}
      />
      <motion.div
        className="absolute bottom-1/3 left-1/4 w-2.5 h-2.5 rounded-full bg-primary"
        animate={{
          y: [0, -25, 0],
          opacity: [0.2, 0.6, 0.2],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        style={{ boxShadow: '0 0 15px hsl(var(--primary) / 0.4)' }}
      />
    </div>
  );
};
