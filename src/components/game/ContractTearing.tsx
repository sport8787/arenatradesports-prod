import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Coins, Sparkles } from 'lucide-react';

interface ContractTearingProps {
  isVisible: boolean;
  prizeAmount?: number;
  onAnimationComplete?: () => void;
}

export default function ContractTearing({ isVisible, prizeAmount = 0, onAnimationComplete }: ContractTearingProps) {
  const [phase, setPhase] = useState<'contract' | 'tearing' | 'celebration' | 'done'>('contract');

  useEffect(() => {
    if (isVisible) {
      setPhase('contract');
      
      // Tearing phase
      const tearTimer = setTimeout(() => setPhase('tearing'), 800);
      // Celebration phase  
      const celebrationTimer = setTimeout(() => setPhase('celebration'), 1800);
      // Done
      const doneTimer = setTimeout(() => {
        setPhase('done');
        onAnimationComplete?.();
      }, 3200);
      
      return () => {
        clearTimeout(tearTimer);
        clearTimeout(celebrationTimer);
        clearTimeout(doneTimer);
      };
    }
  }, [isVisible, onAnimationComplete]);

  // Paper tear pieces
  const tearPieces = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    isLeft: i < 4,
    yOffset: i % 4 * 40 - 60,
    rotation: (Math.random() - 0.5) * 40,
    delay: i * 0.05,
  }));

  // Celebration sparkles
  const sparkles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: (Math.random() - 0.5) * 300,
    y: -100 - Math.random() * 200,
    delay: Math.random() * 0.5,
    duration: 1 + Math.random() * 0.5,
    size: 8 + Math.random() * 12,
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
          {/* Dark overlay with gold tint */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: 0.9,
              background: phase === 'celebration' 
                ? 'radial-gradient(circle, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)'
                : 'rgba(0,0,0,0.9)'
            }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
          />
          
          <div className="relative">
            {/* Contract document */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={
                phase === 'tearing' || phase === 'celebration'
                  ? { scale: 0.9, opacity: 0 }
                  : { scale: 1, opacity: 1, y: 0 }
              }
              transition={{ duration: 0.5 }}
              className="relative"
            >
              {/* Main paper */}
              <div className="w-64 h-80 bg-gradient-to-b from-amber-100 to-amber-200 rounded-sm shadow-2xl p-4 relative overflow-hidden">
                {/* Paper texture */}
                <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiLz48L3N2Zz4=')]" />
                
                {/* Header */}
                <div className="text-center border-b-2 border-amber-800/30 pb-3 mb-4">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="text-2xl mb-1"
                  >
                    ⚖️
                  </motion.div>
                  <p className="font-orbitron text-sm text-amber-900 font-bold">
                    ACORDO DE OURO
                  </p>
                </div>
                
                {/* Contract lines */}
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div 
                      key={i}
                      className="h-2 bg-amber-800/20 rounded"
                      style={{ width: `${70 + Math.random() * 30}%` }}
                    />
                  ))}
                </div>
                
                {/* Signature area */}
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="border-t-2 border-amber-800/40 pt-2">
                    <p className="text-xs text-amber-800/60 text-center">Assinatura do Jogador</p>
                    <div className="text-center mt-1">
                      <span className="font-script text-xl text-amber-900/80 italic">✓ Aceito</span>
                    </div>
                  </div>
                </div>
                
                {/* Gold wax seal */}
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute -bottom-2 -right-2 w-16 h-16 bg-gradient-to-br from-gold via-amber-400 to-gold rounded-full shadow-lg flex items-center justify-center border-4 border-gold/80"
                >
                  <span className="text-2xl">👁️</span>
                </motion.div>
              </div>
            </motion.div>
            
            {/* Tearing animation - paper pieces */}
            <AnimatePresence>
              {(phase === 'tearing' || phase === 'celebration') && tearPieces.map((piece) => (
                <motion.div
                  key={piece.id}
                  initial={{ 
                    x: 0, 
                    y: piece.yOffset, 
                    rotate: 0,
                    opacity: 1
                  }}
                  animate={{ 
                    x: piece.isLeft ? -150 : 150,
                    y: piece.yOffset + 200,
                    rotate: piece.rotation + (piece.isLeft ? -30 : 30),
                    opacity: 0
                  }}
                  transition={{ 
                    duration: 0.8,
                    delay: piece.delay,
                    ease: 'easeOut'
                  }}
                  className="absolute top-0 left-1/2"
                  style={{
                    marginLeft: piece.isLeft ? -64 : 0,
                  }}
                >
                  <div 
                    className="w-32 h-20 bg-gradient-to-b from-amber-100 to-amber-200 shadow-lg"
                    style={{
                      clipPath: piece.isLeft 
                        ? 'polygon(0 0, 100% 10%, 90% 100%, 0 90%)'
                        : 'polygon(0 10%, 100% 0, 100% 90%, 10% 100%)'
                    }}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
            
            {/* Tear flash effect */}
            {phase === 'tearing' && (
              <motion.div
                initial={{ opacity: 1, scaleX: 0.1 }}
                animate={{ opacity: 0, scaleX: 3 }}
                transition={{ duration: 0.4 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-80 bg-white/80 blur-sm"
              />
            )}
            
            {/* Celebration phase */}
            <AnimatePresence>
              {phase === 'celebration' && (
                <>
                  {/* Gold sparkles falling */}
                  {sparkles.map((sparkle) => (
                    <motion.div
                      key={sparkle.id}
                      initial={{ 
                        x: sparkle.x, 
                        y: sparkle.y,
                        opacity: 1,
                        scale: 0
                      }}
                      animate={{ 
                        y: sparkle.y + 400,
                        opacity: [1, 1, 0],
                        scale: [0, 1, 0.5],
                        rotate: 360
                      }}
                      transition={{ 
                        duration: sparkle.duration,
                        delay: sparkle.delay,
                        ease: 'easeOut'
                      }}
                      className="absolute left-1/2"
                    >
                      <Sparkles 
                        className="text-gold" 
                        style={{ width: sparkle.size, height: sparkle.size }}
                      />
                    </motion.div>
                  ))}
                  
                  {/* Prize reveal */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"
                  >
                    <motion.div
                      animate={{ 
                        scale: [1, 1.1, 1],
                        textShadow: [
                          '0 0 20px hsl(var(--gold))',
                          '0 0 40px hsl(var(--gold))',
                          '0 0 20px hsl(var(--gold))'
                        ]
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="font-orbitron text-3xl text-gold font-bold mb-2"
                    >
                      ACORDO ACEITO!
                    </motion.div>
                    
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="flex items-center justify-center gap-2 text-2xl"
                    >
                      <Coins className="w-8 h-8 text-gold" />
                      <span className="font-orbitron text-gold font-bold">
                        {prizeAmount.toLocaleString('pt-BR')} BC
                      </span>
                    </motion.div>
                    
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.7 }}
                      className="text-sm text-muted-foreground mt-3"
                    >
                      Você saiu com o prêmio garantido!
                    </motion.p>
                  </motion.div>
                  
                  {/* Gold glow */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ 
                      opacity: [0, 0.5, 0.3],
                      scale: [0.5, 1.5, 2]
                    }}
                    transition={{ duration: 1.5 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gold/30 rounded-full blur-3xl"
                  />
                </>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
