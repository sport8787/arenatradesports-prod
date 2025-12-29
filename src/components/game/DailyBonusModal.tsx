import { motion } from 'framer-motion';
import { Zap, Gift, Sparkles, X } from 'lucide-react';
import GoldButton from './GoldButton';

interface DailyBonusModalProps {
  open: boolean;
  amount: number;
  onClaim: () => void;
  onClose?: () => void;
}

export function DailyBonusModal({ open, amount, onClaim, onClose }: DailyBonusModalProps) {
  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.8, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 15 }}
        className="max-w-sm w-full luxury-card p-6 space-y-6 text-center relative overflow-hidden"
      >
        {/* Close */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar bônus diário"
            className="absolute right-3 top-3 z-20 rounded-md p-2 bg-background/40 border border-border/40 hover:bg-background/60 transition-colors"
          >
            <X className="w-4 h-4 text-foreground" />
          </button>
        )}

        {/* Background sparkles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5],
                x: Math.random() * 100 - 50,
                y: Math.random() * 100 - 50,
              }}
              transition={{
                duration: 2,
                delay: i * 0.3,
                repeat: Infinity,
              }}
              className="absolute"
              style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
              }}
            >
              <Sparkles className="w-4 h-4 text-primary/50" />
            </motion.div>
          ))}
        </div>

        {/* Icon */}
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-10"
        >
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center border-4 border-primary/30">
            <Gift className="w-10 h-10 text-primary-foreground" />
          </div>
        </motion.div>

        {/* Title */}
        <div className="relative z-10">
          <h2 className="font-orbitron text-2xl font-bold text-primary mb-2">BÔNUS DIÁRIO!</h2>
          <p className="text-muted-foreground text-sm">Bem-vindo de volta ao jogo!</p>
        </div>

        {/* Reward */}
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3 }}
          className="relative z-10 p-4 rounded-xl bg-primary/10 border-2 border-primary/30"
        >
          <div className="flex items-center justify-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            <span className="font-orbitron text-3xl font-bold text-primary">+{amount}</span>
            <span className="text-lg text-primary/80">NT</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Neuro-Tokens para você jogar hoje</p>
        </motion.div>

        {/* Actions */}
        <div className="relative z-10 space-y-3">
          <GoldButton onClick={onClaim} className="w-full" size="lg">
            <Gift className="w-5 h-5 mr-2" />
            RESGATAR BÔNUS
          </GoldButton>

          {onClose && (
            <GoldButton onClick={onClose} className="w-full" variant="ghost" size="md">
              AGORA NÃO
            </GoldButton>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
