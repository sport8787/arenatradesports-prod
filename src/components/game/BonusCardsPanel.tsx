import { motion } from 'framer-motion';
import { Shield, ShieldCheck, ShieldOff, Lock, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BonusCardsPanelProps {
  hasGuaranteedPrize: boolean;
  safeAmount: number;
  hasImmunityCard: boolean;
  immunityCardUsed: boolean;
}

const formatPrize = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(0)}M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return amount.toString();
};

export default function BonusCardsPanel({
  hasGuaranteedPrize,
  safeAmount,
  hasImmunityCard,
  immunityCardUsed,
}: BonusCardsPanelProps) {
  return (
    <div className="bg-secondary/30 rounded-lg border border-border/50 p-3 space-y-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Trophy className="w-4 h-4 text-gold" />
        <span className="font-semibold uppercase tracking-wide">Cartas Bônus</span>
      </div>

      <div className="space-y-2">
        {/* Carta Prêmio Garantido */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "relative overflow-hidden rounded-lg p-3 border transition-all",
            hasGuaranteedPrize
              ? "bg-gradient-to-r from-gold/10 via-amber-500/5 to-transparent border-gold/40"
              : "bg-muted/20 border-border/30"
          )}
        >
          {/* Glow effect when active */}
          {hasGuaranteedPrize && (
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-gold/20 via-transparent to-transparent"
            />
          )}

          <div className="relative z-10 flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              hasGuaranteedPrize
                ? "bg-gold/20 border border-gold/40"
                : "bg-muted/30 border border-border/30"
            )}>
              {hasGuaranteedPrize ? (
                <Shield className="w-5 h-5 text-gold" />
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold text-sm",
                hasGuaranteedPrize ? "text-gold" : "text-muted-foreground"
              )}>
                Prêmio Garantido
              </p>
              {hasGuaranteedPrize ? (
                <p className="text-xs text-gold/70">
                  {formatPrize(safeAmount)} BC protegidos
                </p>
              ) : (
                <p className="text-xs text-muted-foreground/60">
                  2+ votos CLARO para desbloquear
                </p>
              )}
            </div>

            {hasGuaranteedPrize && (
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-gold text-lg"
              >
                ✓
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Carta Imunidade */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "relative overflow-hidden rounded-lg p-3 border transition-all",
            hasImmunityCard && !immunityCardUsed
              ? "bg-gradient-to-r from-cyan-500/10 via-cyan-400/5 to-transparent border-cyan-500/40"
              : hasImmunityCard && immunityCardUsed
                ? "bg-muted/20 border-border/30"
                : "bg-muted/20 border-border/30"
          )}
        >
          {/* Pulsing glow effect when active */}
          {hasImmunityCard && !immunityCardUsed && (
            <motion.div
              animate={{
                opacity: [0.2, 0.5, 0.2],
                scale: [1, 1.02, 1],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-cyan-400/10 to-transparent"
            />
          )}

          <div className="relative z-10 flex items-start gap-3">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 relative",
              hasImmunityCard && !immunityCardUsed
                ? "bg-cyan-500/20 border border-cyan-500/40"
                : hasImmunityCard && immunityCardUsed
                  ? "bg-muted/30 border border-border/30"
                  : "bg-muted/30 border border-border/30"
            )}>
              {/* Pulsing ring for active immunity */}
              {hasImmunityCard && !immunityCardUsed && (
                <motion.div
                  animate={{
                    boxShadow: [
                      '0 0 0 0 hsl(180 100% 50% / 0)',
                      '0 0 0 8px hsl(180 100% 50% / 0.3)',
                      '0 0 0 0 hsl(180 100% 50% / 0)',
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 rounded-lg"
                />
              )}
              
              {hasImmunityCard ? (
                immunityCardUsed ? (
                  <ShieldOff className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                )
              ) : (
                <Lock className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className={cn(
                "font-semibold text-sm",
                hasImmunityCard && !immunityCardUsed 
                  ? "text-cyan-400" 
                  : "text-muted-foreground"
              )}>
                Imunidade
              </p>
              {hasImmunityCard ? (
                immunityCardUsed ? (
                  <p className="text-xs text-muted-foreground/60">
                    Já utilizada nesta partida
                  </p>
                ) : (
                  <p className="text-xs text-cyan-400/70">
                    1 uso disponível (exceto rodada 15)
                  </p>
                )
              ) : (
                <p className="text-xs text-muted-foreground/60">
                  3+ votos CLARO para desbloquear
                </p>
              )}
            </div>

            {hasImmunityCard && !immunityCardUsed && (
              <motion.div
                animate={{ 
                  scale: [1, 1.2, 1],
                  opacity: [0.8, 1, 0.8]
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-cyan-400 text-lg"
              >
                🛡️
              </motion.div>
            )}
            
            {hasImmunityCard && immunityCardUsed && (
              <span className="text-muted-foreground/50 text-lg">✗</span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Info text */}
      {!hasGuaranteedPrize && !hasImmunityCard && (
        <p className="text-[10px] text-muted-foreground/50 text-center">
          Convença o júri para desbloquear cartas bônus!
        </p>
      )}
    </div>
  );
}
