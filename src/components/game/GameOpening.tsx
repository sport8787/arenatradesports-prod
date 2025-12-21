import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GameOpeningProps {
  onComplete: () => void;
}

// Hieroglyphs for decorative effect
const HIEROGLYPHS = ['𓂀', '𓃀', '𓆣', '𓅓', '𓊪', '𓋹', '𓌂', '𓏲', '𓎡', '𓇳', '𓆑', '𓈖'];

export const GameOpening: React.FC<GameOpeningProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  // Pre-calculate particle positions to avoid window reference issues
  const particles = useMemo(() => 
    [...Array(40)].map((_, i) => ({
      id: i,
      startX: Math.random() * 100,
      delay: Math.random() * 3,
      duration: 4 + Math.random() * 4,
      size: Math.random() > 0.7 ? 'large' : Math.random() > 0.4 ? 'medium' : 'small',
      type: Math.random() > 0.8 ? 'hieroglyph' : 'particle',
      hieroglyph: HIEROGLYPHS[Math.floor(Math.random() * HIEROGLYPHS.length)]
    })),
  []);

  // Ember particles
  const embers = useMemo(() =>
    [...Array(25)].map((_, i) => ({
      id: i,
      startX: 40 + Math.random() * 20,
      startY: 60 + Math.random() * 20,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2,
    })),
  []);

  useEffect(() => {
    const audio = new Audio('/audio/horus/abertura_completa.mp3');
    audio.play().catch(console.error);

    const timers = [
      setTimeout(() => setStage(1), 3000),
      setTimeout(() => setStage(2), 8000),
      setTimeout(() => setStage(3), 12000),
      setTimeout(() => onComplete(), 15500)
    ];

    return () => {
      timers.forEach(clearTimeout);
      audio.pause();
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden"
    >
      {/* Animated scanlines overlay */}
      <div 
        className="absolute inset-0 pointer-events-none z-30 opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)'
        }}
      />

      {/* Vignette effect */}
      <div className="absolute inset-0 pointer-events-none z-20 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.7)_100%)]" />

      <motion.div className="relative w-full h-full flex items-center justify-center">
        {/* Multiple layered spotlights */}
        <motion.div
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, 5, 0],
            opacity: stage >= 1 ? 0.5 : 0.15 
          }}
          transition={{ 
            scale: { duration: 3, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 5, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 0.5 }
          }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.2)_0%,transparent_60%)]"
        />
        <motion.div
          animate={{ 
            scale: [1.2, 1, 1.2],
            rotate: [0, -3, 0],
          }}
          transition={{ 
            duration: 4, repeat: Infinity, ease: "easeInOut"
          }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(139,90,43,0.15)_0%,transparent_50%)]"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
          }}
          transition={{ 
            duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5
          }}
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(255,215,0,0.1)_0%,transparent_40%)]"
        />

        {/* Gold dust particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {particles.map((p) => (
            <motion.div
              key={p.id}
              initial={{ 
                left: `${p.startX}%`,
                bottom: '-5%',
                opacity: 0
              }}
              animate={{ 
                bottom: '105%',
                opacity: [0, p.type === 'hieroglyph' ? 0.4 : 0.9, 0],
                x: [0, (Math.random() - 0.5) * 100, (Math.random() - 0.5) * 150]
              }}
              transition={{
                duration: p.duration,
                repeat: Infinity,
                delay: p.delay,
                ease: "linear"
              }}
              className={cn(
                "absolute",
                p.type === 'hieroglyph' 
                  ? "text-amber-500/30 text-xl md:text-2xl" 
                  : cn(
                      "rounded-full",
                      p.size === 'large' ? 'w-2 h-2 bg-amber-300' :
                      p.size === 'medium' ? 'w-1.5 h-1.5 bg-amber-400' :
                      'w-1 h-1 bg-amber-500'
                    )
              )}
              style={p.type !== 'hieroglyph' ? {
                boxShadow: p.size === 'large' 
                  ? '0 0 12px 4px rgba(255, 215, 0, 0.6)' 
                  : '0 0 6px 2px rgba(212, 175, 55, 0.5)'
              } : undefined}
            >
              {p.type === 'hieroglyph' && p.hieroglyph}
            </motion.div>
          ))}
        </div>

        {/* Silhouette of Horus Eye emerging from below */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ y: 200, opacity: 0, scale: 0.5 }}
              animate={{ 
                y: 0, 
                opacity: [0, 0.8, 0.6],
                scale: 1
              }}
              transition={{ duration: 2, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              {/* Giant Eye of Horus SVG silhouette */}
              <motion.svg
                viewBox="0 0 200 120"
                className="w-[80vw] h-[50vh] max-w-[800px]"
                animate={{
                  opacity: [0.15, 0.25, 0.15],
                  scale: [1, 1.02, 1]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {/* Eye of Horus stylized shape */}
                <defs>
                  <linearGradient id="horusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(212, 175, 55, 0.4)" />
                    <stop offset="50%" stopColor="rgba(255, 215, 0, 0.6)" />
                    <stop offset="100%" stopColor="rgba(139, 90, 43, 0.3)" />
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
                
                {/* Main eye shape */}
                <path
                  d="M30 60 Q60 20 100 20 Q140 20 170 60 Q140 100 100 100 Q60 100 30 60 Z"
                  fill="none"
                  stroke="url(#horusGradient)"
                  strokeWidth="2"
                  filter="url(#glow)"
                />
                
                {/* Pupil */}
                <circle
                  cx="100"
                  cy="60"
                  r="20"
                  fill="none"
                  stroke="url(#horusGradient)"
                  strokeWidth="2"
                  filter="url(#glow)"
                />
                <circle
                  cx="100"
                  cy="60"
                  r="8"
                  fill="rgba(212, 175, 55, 0.3)"
                  filter="url(#glow)"
                />
                
                {/* Decorative lines (falcon markings) */}
                <path
                  d="M30 60 L10 80 L20 90 Q30 85 40 75"
                  fill="none"
                  stroke="url(#horusGradient)"
                  strokeWidth="1.5"
                  filter="url(#glow)"
                />
                <path
                  d="M170 60 L190 80 L180 90 Q170 85 160 75"
                  fill="none"
                  stroke="url(#horusGradient)"
                  strokeWidth="1.5"
                  filter="url(#glow)"
                />
                
                {/* Eyebrow arc */}
                <path
                  d="M20 50 Q60 10 100 10 Q140 10 180 50"
                  fill="none"
                  stroke="url(#horusGradient)"
                  strokeWidth="1.5"
                  filter="url(#glow)"
                />
              </motion.svg>

              {/* Ember particles around the eye */}
              {stage >= 2 && embers.map((e) => (
                <motion.div
                  key={`ember-${e.id}`}
                  initial={{
                    left: `${e.startX}%`,
                    top: `${e.startY}%`,
                    opacity: 0,
                    scale: 0
                  }}
                  animate={{
                    top: [`${e.startY}%`, `${e.startY - 30}%`],
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.5],
                    x: [(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 100]
                  }}
                  transition={{
                    duration: e.duration,
                    repeat: Infinity,
                    delay: e.delay,
                    ease: "easeOut"
                  }}
                  className="absolute w-1 h-1 bg-orange-500 rounded-full"
                  style={{
                    boxShadow: '0 0 8px 3px rgba(255, 100, 0, 0.6)'
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logo */}
        <AnimatePresence>
          {stage >= 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: stage >= 3 ? 1.15 : 1, 
                opacity: 1 
              }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative z-10 text-center"
            >
              {/* Pulsing aura behind text */}
              <motion.div
                animate={{
                  opacity: [0.2, 0.5, 0.2],
                  scale: [1, 1.2, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 -m-32 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.15)_0%,transparent_60%)] blur-2xl"
              />

              {/* Hieroglyph decorations on sides */}
              <div className="absolute -left-16 md:-left-24 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-30">
                {['𓂀', '𓃀', '𓆣'].map((h, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 0.5, x: 0 }}
                    transition={{ delay: 1 + i * 0.2, duration: 0.5 }}
                    className="text-amber-500 text-2xl md:text-3xl"
                  >
                    {h}
                  </motion.span>
                ))}
              </div>
              <div className="absolute -right-16 md:-right-24 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-30">
                {['𓋹', '𓌂', '𓏲'].map((h, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 0.5, x: 0 }}
                    transition={{ delay: 1 + i * 0.2, duration: 0.5 }}
                    className="text-amber-500 text-2xl md:text-3xl"
                  >
                    {h}
                  </motion.span>
                ))}
              </div>

              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className={cn(
                  "text-5xl md:text-8xl font-bold tracking-wider",
                  "bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600",
                  "bg-clip-text text-transparent",
                  "drop-shadow-[0_0_40px_rgba(212,175,55,0.6)]"
                )}
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: stage >= 2 ? '0 0 60px rgba(212, 175, 55, 0.9)' : 'none'
                }}
              >
                O BLEFADOR
              </motion.h1>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className={cn(
                  "text-3xl md:text-6xl font-bold tracking-[0.3em] mt-2",
                  "bg-gradient-to-b from-amber-200 via-amber-500 to-amber-800",
                  "bg-clip-text text-transparent"
                )}
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: stage >= 2 ? '0 0 40px rgba(212, 175, 55, 0.7)' : 'none'
                }}
              >
                MILIONÁRIO
              </motion.h2>

              {/* Animated decorative line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="mx-auto mt-6 h-0.5 w-48 md:w-72 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500 to-transparent" />
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent w-1/3"
                />
              </motion.div>

              {/* Climax burst */}
              {stage === 3 && (
                <>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: [0, 0.8, 0], scale: [0.5, 3, 4] }}
                    transition={{ duration: 2, ease: "easeOut" }}
                    className="absolute inset-0 -m-60 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.5)_0%,transparent_50%)]"
                  />
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.3, times: [0, 0.1, 1] }}
                    className="absolute inset-0 -m-40 bg-white/20"
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Horus watching text */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20"
            >
              <motion.div
                animate={{
                  opacity: [0.5, 1, 0.5],
                  textShadow: [
                    '0 0 20px rgba(212, 175, 55, 0.5)',
                    '0 0 40px rgba(212, 175, 55, 0.8)',
                    '0 0 20px rgba(212, 175, 55, 0.5)'
                  ]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="text-amber-400/90 text-xl md:text-2xl tracking-[0.4em] font-light flex items-center gap-4"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                <span className="text-2xl">𓂀</span>
                HÓRUS ESTÁ OBSERVANDO
                <span className="text-2xl">𓂀</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Subtitles */}
      <div className="absolute bottom-28 left-0 right-0 text-center z-30">
        <AnimatePresence mode="wait">
          {stage === 1 && (
            <motion.p
              key="subtitle-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="text-amber-200/80 text-lg md:text-xl tracking-wide italic"
              style={{ fontFamily: "'Cinzel', serif" }}
            >
              Prepare-se para o Santuário
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
