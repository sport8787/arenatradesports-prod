import { motion } from 'framer-motion';
import { Coins, Trophy, Shield, Briefcase, Target, Flame, Zap, Award, CheckCircle } from 'lucide-react';
import { GameRewardsTracker, getRewardsBreakdown, calculateTotalRewards } from '@/services/bcRewardsService';

interface RewardsBreakdownInlineProps {
  tracker: GameRewardsTracker;
  showSavedConfirmation?: boolean;
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

export default function RewardsBreakdownInline({ 
  tracker, 
  showSavedConfirmation = true 
}: RewardsBreakdownInlineProps) {
  const breakdown = getRewardsBreakdown(tracker);
  const totalBC = calculateTotalRewards(tracker);

  if (totalBC === 0 && breakdown.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="w-full max-w-sm mx-auto"
    >
      {/* Breakdown List */}
      <div className="bg-secondary/40 rounded-xl border border-gold/30 overflow-hidden">
        <div className="p-3 bg-gold/10 border-b border-gold/20">
          <h3 className="font-orbitron text-sm font-bold text-gold uppercase tracking-wider text-center flex items-center justify-center gap-2">
            <Coins className="w-4 h-4" />
            Recompensas Ganhas
          </h3>
        </div>
        
        <div className="p-3 space-y-2 max-h-48 overflow-y-auto">
          {breakdown.map((reward, index) => {
            const Icon = getIconForReward(reward.label);
            return (
              <motion.div
                key={reward.label}
                initial={{ x: -10, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 * index + 0.6 }}
                className="flex items-center justify-between py-1.5 px-2 bg-background/30 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-gold/70" />
                  <span className="text-sm text-foreground/80">{reward.label}</span>
                </div>
                <span className="font-orbitron text-sm font-bold text-gold">
                  +{reward.amount}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Total + Saved Confirmation */}
        <div className="p-3 bg-gradient-to-r from-gold/20 via-primary/10 to-gold/20 border-t border-gold/30">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
            className="flex items-center justify-between"
          >
            <span className="font-orbitron text-sm text-foreground font-medium">TOTAL:</span>
            <div className="flex items-center gap-1.5">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.8, repeat: 2 }}
              >
                <Coins className="w-5 h-5 text-gold" />
              </motion.div>
              <span className="font-orbitron text-xl font-black text-gold text-glow-gold">
                {totalBC} BC
              </span>
            </div>
          </motion.div>

          {/* Saved Confirmation */}
          {showSavedConfirmation && totalBC > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className="mt-2 flex items-center justify-center gap-2 text-emerald-400"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-medium">Salvo no seu cofre!</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}