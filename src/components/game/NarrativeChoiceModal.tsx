import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trophy, Flame } from 'lucide-react';
import GoldButton from './GoldButton';

interface NarrativeChoiceModalProps {
  isOpen: boolean;
  playerName: string;
  currentBC: number;
  onCashOut: () => void;
  onContinue: () => void;
}

export default function NarrativeChoiceModal({
  isOpen,
  playerName,
  currentBC,
  onCashOut,
  onContinue,
}: NarrativeChoiceModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="narrative-choice-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-lg"
      >
        {/* Dramatic background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-gradient-radial from-primary/20 via-transparent to-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 120, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            className="absolute top-0 left-0 w-full h-full"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.1) 0%, transparent 50%), 
                               radial-gradient(circle at 80% 70%, hsl(var(--destructive) / 0.1) 0%, transparent 50%)`,
            }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0, y: 50 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 50 }}
          transition={{ type: 'spring', damping: 20 }}
          className="relative z-10 w-full max-w-lg mx-4"
        >
          {/* Card container */}
          <div className="relative p-8 rounded-2xl bg-gradient-to-b from-card/95 to-card border-2 border-primary/50 shadow-2xl">
            {/* Glowing border effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/20 via-transparent to-primary/20 blur-xl -z-10" />
            
            {/* Header with dramatic icon */}
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center mb-8"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/50 mb-4"
              >
                <AlertTriangle className="w-10 h-10 text-primary" />
              </motion.div>
              
              <h2 className="font-orbitron text-2xl md:text-3xl text-foreground mb-2">
                O MOMENTO DA VERDADE
              </h2>
              <div className="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-primary to-transparent" />
            </motion.div>

            {/* Main dialogue */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center space-y-4 mb-8"
            >
              <p className="text-lg text-muted-foreground">
                <span className="text-primary font-bold">{playerName}</span>, você tem
              </p>
              
              <motion.p
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="font-orbitron text-4xl md:text-5xl font-bold text-primary"
              >
                {currentBC.toLocaleString()}
              </motion.p>
              
              <p className="text-lg text-muted-foreground">
                BluffCoins acumulados.
              </p>

              <div className="py-4 space-y-2 text-muted-foreground">
                <p>Você pode <span className="text-success font-bold">PARAR AGORA</span> e sair vitorioso.</p>
                <p className="text-sm opacity-80">— ou —</p>
                <p>Pode <span className="text-destructive font-bold">ARRISCAR TUDO</span> pelas próximas rodadas.</p>
              </div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-xl font-orbitron text-foreground pt-2"
              >
                O que você escolhe?
              </motion.p>
            </motion.div>

            {/* Choice buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="grid grid-cols-1 gap-4"
            >
              {/* Cash out button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onCashOut}
                className="relative group w-full py-5 px-6 rounded-xl bg-gradient-to-r from-success/20 to-success/10 border-2 border-success/50 hover:border-success transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-xl bg-success/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center justify-center gap-3">
                  <Trophy className="w-6 h-6 text-success" />
                  <span className="font-orbitron text-lg text-success">
                    PARAR E SAIR VITORIOSO
                  </span>
                </div>
                <p className="relative text-sm text-success/70 mt-1">
                  Garantir {currentBC.toLocaleString()} BC
                </p>
              </motion.button>

              {/* Continue button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onContinue}
                className="relative group w-full py-5 px-6 rounded-xl bg-gradient-to-r from-destructive/20 to-destructive/10 border-2 border-destructive/50 hover:border-destructive transition-all duration-300"
              >
                <div className="absolute inset-0 rounded-xl bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative flex items-center justify-center gap-3">
                  <Flame className="w-6 h-6 text-destructive" />
                  <span className="font-orbitron text-lg text-destructive">
                    ARRISCAR TUDO
                  </span>
                </div>
                <p className="relative text-sm text-destructive/70 mt-1">
                  Continuar para as rodadas finais
                </p>
              </motion.button>
            </motion.div>

            {/* Warning footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center text-xs text-muted-foreground/60 mt-6"
            >
              ⚠️ Ao continuar, você arrisca perder tudo se for eliminado
            </motion.p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
