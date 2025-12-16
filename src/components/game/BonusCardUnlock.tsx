import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sparkles } from 'lucide-react';

interface BonusCardUnlockProps {
  show: boolean;
  safeAmount: number;
  onComplete?: () => void;
}

export default function BonusCardUnlock({ show, safeAmount, onComplete }: BonusCardUnlockProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onAnimationComplete={() => {
            setTimeout(() => onComplete?.(), 3000);
          }}
        >
          {/* Radial glow background */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-[600px] h-[600px] rounded-full bg-gradient-radial from-gold/30 via-gold/10 to-transparent blur-3xl" />
          </motion.div>

          {/* Sparkles particles */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ 
                opacity: 0, 
                scale: 0,
                x: 0,
                y: 0
              }}
              animate={{ 
                opacity: [0, 1, 0],
                scale: [0, 1, 0],
                x: Math.cos(i * 30 * Math.PI / 180) * 150,
                y: Math.sin(i * 30 * Math.PI / 180) * 150,
              }}
              transition={{ 
                duration: 1.5,
                delay: 0.3 + i * 0.05,
                ease: "easeOut"
              }}
            >
              <Sparkles className="w-6 h-6 text-gold" />
            </motion.div>
          ))}

          {/* Main card container */}
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0, rotateY: 180 }}
            animate={{ scale: 1, rotateY: 0 }}
            transition={{ 
              type: "spring",
              stiffness: 200,
              damping: 15,
              delay: 0.2
            }}
          >
            {/* Shield icon with glow */}
            <motion.div
              className="relative"
              animate={{
                filter: [
                  'drop-shadow(0 0 20px rgba(212, 175, 55, 0.5))',
                  'drop-shadow(0 0 40px rgba(212, 175, 55, 0.8))',
                  'drop-shadow(0 0 20px rgba(212, 175, 55, 0.5))',
                ],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <motion.div
                className="w-32 h-32 rounded-full bg-gradient-to-br from-gold via-amber-400 to-gold flex items-center justify-center"
                animate={{
                  boxShadow: [
                    '0 0 30px rgba(212, 175, 55, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.3)',
                    '0 0 60px rgba(212, 175, 55, 0.8), inset 0 0 30px rgba(255, 255, 255, 0.5)',
                    '0 0 30px rgba(212, 175, 55, 0.5), inset 0 0 20px rgba(255, 255, 255, 0.3)',
                  ],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <Shield className="w-16 h-16 text-background" fill="currentColor" />
              </motion.div>

              {/* Rotating ring */}
              <motion.div
                className="absolute inset-0 w-32 h-32 rounded-full border-2 border-gold/50 border-dashed"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 8,
                  repeat: Infinity,
                  ease: "linear"
                }}
              />
            </motion.div>

            {/* Title */}
            <motion.h2
              className="mt-6 text-3xl font-black text-gold tracking-wider"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{
                textShadow: '0 0 20px rgba(212, 175, 55, 0.5), 0 0 40px rgba(212, 175, 55, 0.3)'
              }}
            >
              🛡️ CARTA BÔNUS
            </motion.h2>

            <motion.p
              className="text-xl font-bold text-gold/80 mt-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              PRÊMIO GARANTIDO
            </motion.p>

            {/* Protected amount */}
            <motion.div
              className="mt-4 px-6 py-3 bg-gold/20 border border-gold/40 rounded-lg"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
            >
              <p className="text-sm text-gold/70 text-center">Valor Protegido</p>
              <motion.p
                className="text-2xl font-black text-gold text-center"
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {safeAmount.toLocaleString()} BC
              </motion.p>
            </motion.div>

            {/* Subtitle */}
            <motion.p
              className="mt-4 text-sm text-muted-foreground text-center max-w-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Se for eliminado, você leva este valor para casa!
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
