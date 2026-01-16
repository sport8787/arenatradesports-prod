import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Trophy, Shield, Briefcase, Target, Flame, X, Award, Zap } from 'lucide-react';
import { GameRewardsTracker, getRewardsBreakdown, calculateTotalRewards } from '@/services/bcRewardsService';
import BluffCoinDisplay from './BluffCoinDisplay';

interface RewardsSummaryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  tracker: GameRewardsTracker;
  gamePhase?: string;
}

const getIconForReward = (label: string) => {
  if (label.includes('Resposta')) return Target;
  if (label.includes('Blefe')) return Flame;
  if (label.includes('Hórus')) return Zap;
  if (label.includes('Porto Seguro')) return Shield;
  if (label.includes('Imunidade')) return Shield;
  if (label.includes('Maleta')) return Briefcase;
  if (label.includes('Vitória')) return Trophy;
  if (label.includes('Partida')) return Award;
  if (label.includes('Desafiante')) return Target;
  return Coins;
};

export default function RewardsSummaryPanel({ 
  isOpen, 
  onClose, 
  tracker, 
  gamePhase = 'Modo Extremo' 
}: RewardsSummaryPanelProps) {
  const breakdown = getRewardsBreakdown(tracker);
  const totalBC = calculateTotalRewards(tracker);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-gradient-to-br from-background via-secondary/30 to-background border-2 border-gold/50 rounded-2xl overflow-hidden shadow-2xl shadow-gold/20"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-gold/20 via-primary/20 to-gold/20 p-6 border-b border-gold/30">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-background/50 hover:bg-background transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="inline-block mb-3"
                >
                  <Trophy className="w-12 h-12 text-gold" />
                </motion.div>
                <h2 className="font-orbitron text-xl font-bold text-gold uppercase tracking-wider">
                  Resumo de Recompensas
                </h2>
                <p className="text-sm text-muted-foreground mt-1">{gamePhase}</p>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {breakdown.length > 0 ? (
                <>
                  {breakdown.map((reward, index) => {
                    const Icon = getIconForReward(reward.label);
                    return (
                      <motion.div
                        key={reward.label}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.1 * index }}
                        className="flex items-center justify-between p-3 bg-secondary/30 rounded-xl border border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gold/10 rounded-lg">
                            <Icon className="w-5 h-5 text-gold" />
                          </div>
                          <span className="text-foreground font-medium">{reward.label}</span>
                        </div>
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1 * index + 0.2, type: 'spring' }}
                          className="font-orbitron font-bold text-gold"
                        >
                          +{reward.amount} BC
                        </motion.span>
                      </motion.div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Nenhuma recompensa nesta partida</p>
                </div>
              )}
            </div>

            {/* Footer - Total */}
            <div className="p-6 bg-gradient-to-r from-gold/10 via-primary/10 to-gold/10 border-t border-gold/30">
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-between"
              >
                <span className="font-orbitron text-lg text-foreground">TOTAL GANHO:</span>
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 1 }}
                  >
                    <Coins className="w-6 h-6 text-gold" />
                  </motion.div>
                  <span className="font-orbitron text-2xl font-black text-gold text-glow-gold">
                    {totalBC} BC
                  </span>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
