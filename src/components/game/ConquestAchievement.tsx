import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Skull } from 'lucide-react';

interface ConquestAchievementProps {
  show: boolean;
  eliminatedHostName: string;
  onComplete?: () => void;
}

export default function ConquestAchievement({ show, eliminatedHostName, onComplete }: ConquestAchievementProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onAnimationComplete={() => {
            setTimeout(() => onComplete?.(), 4000);
          }}
        >
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Radial glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_hsl(45,100%,50%,0.3)_0%,_transparent_50%)]" />
            
            {/* Animated particles */}
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-2 h-2 bg-gold rounded-full"
                initial={{
                  x: '50%',
                  y: '50%',
                  scale: 0,
                }}
                animate={{
                  x: `${Math.random() * 100}%`,
                  y: `${Math.random() * 100}%`,
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  delay: Math.random() * 1,
                  repeat: Infinity,
                  repeatDelay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center px-8">
            {/* Crown Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 1, delay: 0.2 }}
              className="relative mb-6"
            >
              <Crown className="w-24 h-24 mx-auto text-gold drop-shadow-[0_0_30px_hsl(45,100%,50%,0.8)]" />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.8 }}
                className="absolute -bottom-2 -right-2"
              >
                <Skull className="w-10 h-10 text-destructive" />
              </motion.div>
            </motion.div>

            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="font-orbitron text-lg text-muted-foreground tracking-[0.3em] mb-2"
            >
              CONQUISTA DESBLOQUEADA
            </motion.h2>

            {/* Main Message */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.8, type: 'spring' }}
              className="mb-4"
            >
              <h3 className="font-orbitron text-4xl md:text-5xl font-bold text-gold tracking-wider mb-2">
                ELIMINEI O JOGADOR
              </h3>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="text-5xl"
              >
                💀
              </motion.span>
            </motion.div>

            {/* Subtext */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
              className="text-muted-foreground text-lg max-w-md mx-auto"
            >
              Você é o novo dono da mesa. Defenda seu posto.
            </motion.p>

            {/* Eliminated Host Name */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2 }}
              className="mt-6 py-3 px-6 bg-destructive/20 border border-destructive/40 rounded-lg inline-block"
            >
              <p className="text-sm text-destructive">
                <span className="font-bold">{eliminatedHostName}</span> foi destronado
              </p>
            </motion.div>

            {/* Pulsing continue hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ delay: 3, duration: 2, repeat: Infinity }}
              className="mt-8 text-sm text-muted-foreground"
            >
              Preparando sua ascensão...
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
