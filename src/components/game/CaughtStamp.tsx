import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Target } from 'lucide-react';

interface CaughtStampProps {
  show: boolean;
  onComplete?: () => void;
}

export default function CaughtStamp({ show, onComplete }: CaughtStampProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onAnimationComplete={() => {
            setTimeout(() => onComplete?.(), 2500);
          }}
        >
          {/* Background flash effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.5, 0] }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 bg-destructive"
          />

          {/* Radial scan lines */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 left-1/2 w-[200%] h-1 bg-gradient-to-r from-transparent via-destructive/50 to-transparent origin-left"
                style={{ rotate: `${i * 30}deg` }}
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: [0, 1, 0] }}
                transition={{ duration: 0.8, delay: i * 0.03 }}
              />
            ))}
          </div>

          {/* Main stamp container */}
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ 
              type: 'spring', 
              damping: 12, 
              stiffness: 200,
              duration: 0.5 
            }}
            className="relative"
          >
            {/* Stamp outer border */}
            <div className="relative px-12 py-8 border-8 border-destructive rounded-lg bg-black/90 transform -rotate-6">
              {/* Corner decorations */}
              <div className="absolute -top-2 -left-2 w-4 h-4 border-t-4 border-l-4 border-destructive" />
              <div className="absolute -top-2 -right-2 w-4 h-4 border-t-4 border-r-4 border-destructive" />
              <div className="absolute -bottom-2 -left-2 w-4 h-4 border-b-4 border-l-4 border-destructive" />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 border-b-4 border-r-4 border-destructive" />

              {/* Inner content */}
              <div className="text-center space-y-2">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring' }}
                  className="flex justify-center gap-2 mb-4"
                >
                  <Eye className="w-10 h-10 text-destructive" />
                  <Target className="w-10 h-10 text-destructive" />
                </motion.div>

                {/* Main text */}
                <motion.h2
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="font-orbitron text-4xl md:text-5xl font-black text-destructive tracking-wider"
                  style={{ textShadow: '0 0 20px hsl(var(--destructive))' }}
                >
                  PEGO NO PULO!
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="font-orbitron text-lg text-destructive/80 tracking-[0.2em]"
                >
                  LEITURA PERFEITA DO JÚRI
                </motion.p>

                {/* Decorative line */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 0.3 }}
                  className="h-1 bg-gradient-to-r from-transparent via-destructive to-transparent mt-4"
                />

                {/* Bottom text */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="text-muted-foreground text-sm mt-2"
                >
                  Todos viram através do blefe
                </motion.p>
              </div>

              {/* Ink splatter effects */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.3 }}
                transition={{ delay: 0.1 }}
                className="absolute -top-4 -right-4 w-16 h-16 bg-destructive rounded-full blur-xl"
              />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.2 }}
                transition={{ delay: 0.15 }}
                className="absolute -bottom-4 -left-4 w-12 h-12 bg-destructive rounded-full blur-lg"
              />
            </div>

            {/* Pulsing glow */}
            <motion.div
              animate={{ 
                boxShadow: [
                  '0 0 20px hsl(var(--destructive) / 0.5)',
                  '0 0 60px hsl(var(--destructive) / 0.8)',
                  '0 0 20px hsl(var(--destructive) / 0.5)'
                ]
              }}
              transition={{ duration: 1, repeat: 2 }}
              className="absolute inset-0 rounded-lg pointer-events-none"
            />
          </motion.div>

          {/* Bottom message */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5 }}
            className="absolute bottom-20 text-lg text-muted-foreground font-medium"
          >
            Preparando sucessão...
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
