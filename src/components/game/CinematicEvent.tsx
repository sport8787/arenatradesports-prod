import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { playHorusAudio } from '@/services/horusLocalAudio';

interface CinematicEventProps {
  show: boolean;
  type: 'epic_moment' | 'blefe_perfeito' | 'carta_bonus' | 'evento_oculto' | 'climax';
  title?: string;
  subtitle?: string;
  audioPath?: string;
  onComplete?: () => void;
  duration?: number;
  cardType?: 'porto_seguro' | 'imunidade';
}

const CinematicEvent = ({
  show,
  type,
  title,
  subtitle,
  audioPath,
  onComplete,
  duration = 4000,
  cardType = 'porto_seguro'
}: CinematicEventProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      
      // Play audio if provided
      if (audioPath) {
        playHorusAudio(audioPath);
      }
      
      // Show card animation after black bars appear
      if (type === 'blefe_perfeito' || type === 'carta_bonus') {
        setTimeout(() => setShowCard(true), 600);
      }
      
      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        setShowCard(false);
        setTimeout(() => {
          setIsVisible(false);
          onComplete?.();
        }, 500);
      }, duration);
      
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      setShowCard(false);
    }
  }, [show, audioPath, duration, type, onComplete]);

  const getCardImage = () => {
    if (type === 'blefe_perfeito') {
      return '/carta_blefe.png';
    }
    if (type === 'carta_bonus') {
      return cardType === 'imunidade' ? '/carta_blefe.png' : '/carta_claro.png';
    }
    return '/carta_claro.png';
  };

  const getCardGlow = () => {
    if (type === 'blefe_perfeito') return 'shadow-[0_0_60px_rgba(255,215,0,0.8)]';
    if (type === 'carta_bonus') {
      return cardType === 'imunidade' 
        ? 'shadow-[0_0_60px_rgba(147,51,234,0.8)]' 
        : 'shadow-[0_0_60px_rgba(34,197,94,0.8)]';
    }
    return 'shadow-[0_0_40px_rgba(255,215,0,0.6)]';
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Dark overlay */}
          <motion.div 
            className="absolute inset-0 bg-black/80"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
          
          {/* Top cinematic bar */}
          <motion.div
            className="absolute top-0 left-0 right-0 bg-black"
            initial={{ height: 0 }}
            animate={{ height: '12%' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          
          {/* Bottom cinematic bar */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-black"
            initial={{ height: 0 }}
            animate={{ height: '12%' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
          
          {/* Content container */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Spinning Card Animation for Blefe Perfeito / Carta Bonus */}
            {(type === 'blefe_perfeito' || type === 'carta_bonus') && (
              <AnimatePresence>
                {showCard && (
                  <motion.div
                    className="relative"
                    initial={{ 
                      scale: 0, 
                      rotateY: 0,
                      opacity: 0 
                    }}
                    animate={{ 
                      scale: [0, 1.2, 1],
                      rotateY: [0, 360, 720, 1080],
                      opacity: 1
                    }}
                    exit={{ 
                      scale: 0,
                      opacity: 0,
                      rotateY: 1440
                    }}
                    transition={{ 
                      duration: 2,
                      ease: 'easeOut',
                      rotateY: { duration: 2.5, ease: 'easeInOut' }
                    }}
                    style={{ perspective: 1000 }}
                  >
                    {/* Golden glow behind card */}
                    <motion.div
                      className="absolute inset-0 rounded-xl blur-xl"
                      style={{
                        background: type === 'blefe_perfeito' 
                          ? 'radial-gradient(circle, rgba(255,215,0,0.6) 0%, transparent 70%)'
                          : cardType === 'imunidade'
                            ? 'radial-gradient(circle, rgba(147,51,234,0.6) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(34,197,94,0.6) 0%, transparent 70%)'
                      }}
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.6, 1, 0.6]
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />
                    
                    {/* Card image */}
                    <motion.img
                      src={getCardImage()}
                      alt="Carta Bônus"
                      className={`w-48 h-72 object-cover rounded-xl ${getCardGlow()}`}
                      style={{ transformStyle: 'preserve-3d' }}
                    />
                    
                    {/* Sparkle particles */}
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-yellow-400 rounded-full"
                        style={{
                          top: '50%',
                          left: '50%',
                        }}
                        animate={{
                          x: [0, Math.cos(i * 30 * Math.PI / 180) * 120],
                          y: [0, Math.sin(i * 30 * Math.PI / 180) * 120],
                          opacity: [1, 0],
                          scale: [1, 0]
                        }}
                        transition={{
                          duration: 1,
                          delay: 0.5,
                          ease: 'easeOut'
                        }}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            )}
            
            {/* Title text */}
            {title && (
              <motion.div
                className="text-center mt-8"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ delay: 0.8, duration: 0.5 }}
              >
                <h2 className="text-3xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-lg md:text-xl text-amber-200/80 mt-2 italic">
                    {subtitle}
                  </p>
                )}
              </motion.div>
            )}
            
            {/* Epic moment visual for evento_oculto */}
            {type === 'evento_oculto' && (
              <motion.div
                className="relative"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.8, type: 'spring' }}
              >
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-600 via-violet-500 to-purple-800 flex items-center justify-center shadow-[0_0_60px_rgba(147,51,234,0.8)]">
                  <motion.span
                    className="text-6xl"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  >
                    👁️
                  </motion.span>
                </div>
              </motion.div>
            )}
            
            {/* Climax visual */}
            {type === 'climax' && (
              <motion.div
                className="relative"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="text-8xl"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    textShadow: [
                      '0 0 20px rgba(255,0,0,0.5)',
                      '0 0 60px rgba(255,0,0,0.8)',
                      '0 0 20px rgba(255,0,0,0.5)'
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  🎰
                </motion.div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CinematicEvent;
