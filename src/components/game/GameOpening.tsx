import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GameOpeningProps {
  onComplete: () => void;
}

export const GameOpening: React.FC<GameOpeningProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // 1. Início do Áudio: abertura_completa Mixada com Callum v3
    const audio = new Audio('/audio/horus/abertura_completa.mp3');
    audio.play().catch(console.error);

    // 2. Cronograma de Sincronia (Roteiro de 15s)
    const timers = [
      setTimeout(() => setStage(1), 3000),  // 03s: Entrada da Voz
      setTimeout(() => setStage(2), 8000),  // 08s: Crescendo / Avatar
      setTimeout(() => setStage(3), 12000), // 12s: Golpe Final / Logo Glow
      setTimeout(() => onComplete(), 15500) // 15s: Fim da abertura
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
      <motion.div className="relative w-full h-full flex items-center justify-center">
        {/* Fundo: Efeito de Spotlights pulsando com a música */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: stage >= 1 ? 0.4 : 0.1 
          }}
          transition={{ 
            scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 0.5 }
          }}
          className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.15)_0%,transparent_70%)]"
        />

        {/* Partículas de ouro flutuando */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 20,
                opacity: 0
              }}
              animate={{ 
                y: -20,
                opacity: [0, 0.8, 0]
              }}
              transition={{
                duration: 4 + Math.random() * 3,
                repeat: Infinity,
                delay: Math.random() * 3,
                ease: "linear"
              }}
              className="absolute w-1 h-1 bg-amber-400 rounded-full"
              style={{
                boxShadow: '0 0 6px 2px rgba(212, 175, 55, 0.6)'
              }}
            />
          ))}
        </div>

        {/* 00-03s: Logo Inicial com Fumaça */}
        <AnimatePresence>
          {stage >= 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ 
                scale: stage >= 3 ? 1.1 : 1, 
                opacity: 1 
              }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="relative z-10 text-center"
            >
              {/* Efeito de fumaça/névoa */}
              <motion.div
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 -m-20 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.1)_0%,transparent_70%)] blur-xl"
              />

              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
                className={cn(
                  "text-6xl md:text-8xl font-bold tracking-wider",
                  "bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600",
                  "bg-clip-text text-transparent",
                  "drop-shadow-[0_0_30px_rgba(212,175,55,0.5)]"
                )}
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: stage >= 2 ? '0 0 40px rgba(212, 175, 55, 0.8)' : 'none'
                }}
              >
                O BLEFADOR
              </motion.h1>

              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.8 }}
                className={cn(
                  "text-4xl md:text-6xl font-bold tracking-[0.3em] mt-2",
                  "bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700",
                  "bg-clip-text text-transparent"
                )}
                style={{
                  fontFamily: "'Cinzel', serif",
                  textShadow: stage >= 2 ? '0 0 30px rgba(212, 175, 55, 0.6)' : 'none'
                }}
              >
                MILIONÁRIO
              </motion.h2>

              {/* Linha decorativa */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="mx-auto mt-6 h-0.5 w-48 md:w-64 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
              />

              {/* Efeito de brilho intenso no clímax final (12s) */}
              {stage === 3 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 2.5] }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="absolute inset-0 -m-40 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.4)_0%,transparent_60%)]"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 08s: Surgimento das Sombras do Hórus */}
        <AnimatePresence>
          {stage >= 2 && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2"
            >
              {/* Silhueta do olho de Hórus */}
              <motion.div
                animate={{
                  opacity: [0.6, 1, 0.6],
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="text-amber-500/80 text-2xl md:text-3xl tracking-widest font-light"
                style={{ fontFamily: "'Cinzel', serif" }}
              >
                ⟨ HÓRUS ESTÁ OBSERVANDO ⟩
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 03-12s: Legendas Estilizadas */}
      <div className="absolute bottom-32 left-0 right-0 text-center z-20">
        <AnimatePresence mode="wait">
          {stage === 1 && (
            <motion.p
              key="subtitle-1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="text-amber-200/90 text-lg md:text-xl tracking-wide italic"
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
