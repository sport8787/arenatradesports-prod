import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

interface ImmunityCardUnlockProps {
  show: boolean;
  onComplete?: () => void;
}

export default function ImmunityCardUnlock({ show, onComplete }: ImmunityCardUnlockProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          onAnimationComplete={() => {
            if (show) {
              setTimeout(() => onComplete?.(), 3000);
            }
          }}
        >
          {/* Radial glow effect */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 2.5, opacity: [0, 0.8, 0.4] }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="absolute w-64 h-64 rounded-full bg-cyan-500/30 blur-3xl"
          />

          {/* Sparkling effects */}
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={i}
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
                y: Math.sin(i * 30 * Math.PI / 180) * 150
              }}
              transition={{ 
                duration: 1.5, 
                delay: 0.3 + i * 0.05,
                ease: 'easeOut'
              }}
              className="absolute w-3 h-3 bg-cyan-400 rounded-full blur-sm"
            />
          ))}

          <div className="relative text-center space-y-6 p-8">
            {/* Shield icon with glow */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 1, delay: 0.2 }}
              className="relative mx-auto"
            >
              {/* Pulsing glow behind shield */}
              <motion.div
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 w-32 h-32 bg-cyan-500/40 rounded-full blur-xl mx-auto"
                style={{ left: '50%', transform: 'translateX(-50%)' }}
              />
              
              {/* Rotating ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                className="absolute inset-0 w-36 h-36 border-2 border-dashed border-cyan-400/40 rounded-full mx-auto"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              />

              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px hsl(180 100% 50% / 0.3)',
                    '0 0 60px hsl(180 100% 50% / 0.6)',
                    '0 0 20px hsl(180 100% 50% / 0.3)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="relative z-10 w-32 h-32 flex items-center justify-center bg-gradient-to-br from-cyan-900/80 to-cyan-950/80 rounded-full border-4 border-cyan-400 mx-auto"
              >
                <Shield className="w-16 h-16 text-cyan-400" />
              </motion.div>
            </motion.div>

            {/* Text content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="space-y-3"
            >
              <motion.h2
                animate={{ 
                  textShadow: [
                    '0 0 10px hsl(180 100% 50% / 0.5)',
                    '0 0 30px hsl(180 100% 50% / 0.8)',
                    '0 0 10px hsl(180 100% 50% / 0.5)'
                  ]
                }}
                transition={{ duration: 2, repeat: Infinity }}
                className="font-orbitron text-3xl font-bold text-cyan-400 tracking-wider"
              >
                CARTA BÔNUS
              </motion.h2>
              
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="font-orbitron text-xl text-cyan-300/90"
              >
                IMUNIDADE
              </motion.p>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.5 }}
                className="pt-4 space-y-2"
              >
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  Se todos votarem BLEFE em uma rodada futura, você será salvo!
                </p>
                <p className="text-cyan-400/60 text-xs">
                  (Válida uma única vez • Exceto rodada final)
                </p>
              </motion.div>
            </motion.div>

            {/* Success checkmark */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 2 }}
              className="text-cyan-400 text-4xl"
            >
              ✓
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
