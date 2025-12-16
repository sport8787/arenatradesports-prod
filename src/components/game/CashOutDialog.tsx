import { motion, AnimatePresence } from 'framer-motion';
import { Banknote, X, AlertTriangle } from 'lucide-react';
import GoldButton from './GoldButton';

interface CashOutDialogProps {
  show: boolean;
  currentRound: number;
  maxRounds: number;
  accumulatedPrize: number;
  potentialPrize: number; // What they could win if they complete all rounds
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CashOutDialog({
  show,
  currentRound,
  maxRounds,
  accumulatedPrize,
  potentialPrize,
  onConfirm,
  onCancel,
}: CashOutDialogProps) {
  const remainingRounds = maxRounds - currentRound;
  const missedPrize = potentialPrize - accumulatedPrize;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-md bg-gradient-to-b from-background via-background to-background/95 border border-gold/30 rounded-2xl overflow-hidden"
            initial={{ scale: 0.8, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 50 }}
            transition={{ type: "spring", damping: 20 }}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-gold/20">
              <button
                onClick={onCancel}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
              
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center"
                  animate={{
                    boxShadow: [
                      '0 0 20px rgba(34, 197, 94, 0.3)',
                      '0 0 40px rgba(34, 197, 94, 0.5)',
                      '0 0 20px rgba(34, 197, 94, 0.3)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Banknote className="w-6 h-6 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">Cash Out</h2>
                  <p className="text-sm text-muted-foreground">Sair com o prêmio</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Current Prize */}
              <div className="text-center p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                <p className="text-sm text-green-400 mb-1">Você leva agora</p>
                <motion.p
                  className="text-3xl font-black text-green-400"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {accumulatedPrize.toLocaleString()} BC
                </motion.p>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="text-amber-400 font-medium">
                    Faltam {remainingRounds} rodada{remainingRounds !== 1 ? 's' : ''}
                  </p>
                  <p className="text-muted-foreground">
                    Você deixará de ganhar até{' '}
                    <span className="text-amber-400 font-semibold">
                      {missedPrize.toLocaleString()} BC
                    </span>
                  </p>
                </div>
              </div>

              {/* Progress indicator */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progresso</span>
                  <span>{currentRound}/{maxRounds} rodadas</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-gold to-amber-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentRound / maxRounds) * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 pt-2 space-y-3">
              <GoldButton onClick={onConfirm} className="w-full">
                <Banknote className="w-5 h-5 mr-2" />
                CONFIRMAR CASH OUT
              </GoldButton>
              
              <button
                onClick={onCancel}
                className="w-full py-3 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              >
                Continuar Jogando
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
