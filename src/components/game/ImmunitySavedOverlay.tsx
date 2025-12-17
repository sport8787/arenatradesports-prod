import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

interface ImmunitySavedOverlayProps {
  show: boolean;
  onComplete?: () => void;
}

export default function ImmunitySavedOverlay({ show, onComplete }: ImmunitySavedOverlayProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md"
          onAnimationComplete={() => {
            if (show) {
              setTimeout(() => onComplete?.(), 4000);
            }
          }}
        >
          {/* Radial pulse effect */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ 
              scale: [0.5, 3, 3],
              opacity: [0, 0.6, 0]
            }}
            transition={{ duration: 2, ease: 'easeOut' }}
            className="absolute w-64 h-64 rounded-full bg-cyan-500/40"
          />

          {/* Shield barrier effect */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ 
              scale: [0, 1.5, 1.2],
              opacity: [0, 0.8, 0.3]
            }}
            transition={{ duration: 1.5, delay: 0.3 }}
            className="absolute w-80 h-80 rounded-full border-4 border-cyan-400/60"
          />

          <div className="relative text-center space-y-6 p-8">
            {/* Shield icon with protective glow */}
            <motion.div
              initial={{ scale: 0, y: -50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', duration: 1, delay: 0.2 }}
              className="relative mx-auto"
            >
              {/* Protective barrier animation */}
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.4, 0.8, 0.4]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 w-40 h-40 bg-cyan-500/30 rounded-full blur-2xl mx-auto"
                style={{ left: '50%', transform: 'translateX(-50%)' }}
              />

              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 30px hsl(180 100% 50% / 0.4)',
                    '0 0 80px hsl(180 100% 50% / 0.8)',
                    '0 0 30px hsl(180 100% 50% / 0.4)'
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="relative z-10 w-32 h-32 flex items-center justify-center bg-gradient-to-br from-cyan-800/90 to-cyan-950/90 rounded-full border-4 border-cyan-300 mx-auto"
              >
                <Shield className="w-16 h-16 text-cyan-300" />
              </motion.div>
            </motion.div>

            {/* Text content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="space-y-4"
            >
              <motion.h2
                animate={{ 
                  textShadow: [
                    '0 0 15px hsl(180 100% 50% / 0.6)',
                    '0 0 40px hsl(180 100% 50% / 1)',
                    '0 0 15px hsl(180 100% 50% / 0.6)'
                  ]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="font-orbitron text-4xl font-bold text-cyan-300 tracking-wider"
              >
                VOCÊ FOI SALVO!
              </motion.h2>
              
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.2 }}
                className="space-y-2"
              >
                <p className="font-orbitron text-xl text-cyan-400/90">
                  CARTA IMUNIDADE ATIVADA
                </p>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  Todos votaram BLEFE, mas sua carta de imunidade te protegeu da eliminação!
                </p>
              </motion.div>

              {/* Card used indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                className="pt-4"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-950/50 border border-cyan-500/30 rounded-full">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400/80 text-sm font-medium">Carta consumida</span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
