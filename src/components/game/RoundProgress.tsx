import { motion } from 'framer-motion';
import { Shield, Trophy, Coins, Flame, ShieldCheck, ShieldOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// Prize ladder values (in BluffCoins)
export const PRIZE_LADDER = [
  1000, 2000, 5000, 10000, 20000, 40000, 60000, 80000, 
  100000, 150000, 200000, 300000, 400000, 500000, 1000000
];

interface RoundProgressProps {
  currentRound: number;
  accumulatedPrize: number;
  hasGuaranteedPrize: boolean;
  safeAmount: number;
  isHost: boolean;
  hasImmunityCard?: boolean;
  immunityCardUsed?: boolean;
}

const formatPrize = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(0)}M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)}k`;
  return amount.toString();
};

export default function RoundProgress({
  currentRound,
  accumulatedPrize,
  hasGuaranteedPrize,
  safeAmount,
  isHost,
  hasImmunityCard = false,
  immunityCardUsed = false,
}: RoundProgressProps) {
  const nextRound = currentRound + 1;
  const nextPrize = nextRound <= 15 ? PRIZE_LADDER[nextRound - 1] : null;
  const isFinalRound = currentRound === 15;

  return (
    <div className="space-y-3">
      {/* Round Indicator */}
      <div className="flex items-center justify-between bg-secondary/50 rounded-lg p-3 border border-border">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-orbitron font-bold",
            isFinalRound 
              ? "bg-gradient-to-br from-gold via-amber-400 to-gold text-background animate-pulse" 
              : "bg-primary/20 text-primary"
          )}>
            {currentRound}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Rodada</p>
            <p className={cn(
              "font-orbitron text-sm",
              isFinalRound ? "text-gold" : "text-foreground"
            )}>
              {currentRound}/15
            </p>
          </div>
        </div>

        {isFinalRound && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-gold/20 px-3 py-1.5 rounded-full border border-gold/50"
          >
            <Flame className="w-4 h-4 text-gold animate-pulse" />
            <span className="text-gold font-orbitron text-xs font-bold">ALL-IN!</span>
          </motion.div>
        )}
      </div>

      {/* Accumulated Prize */}
      <div className="bg-gradient-to-r from-secondary via-secondary/80 to-secondary rounded-lg p-3 border border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_hsl(var(--gold)/0.1)_0%,_transparent_50%)]" />
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-gold" />
              <span className="text-xs text-muted-foreground">Acumulado</span>
            </div>
            {hasGuaranteedPrize && safeAmount > 0 && (
              <div className="flex items-center gap-1 bg-gold/20 px-2 py-0.5 rounded-full">
                <Shield className="w-3 h-3 text-gold" />
                <span className="text-[10px] text-gold font-bold">
                  {formatPrize(safeAmount)} protegido
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="font-orbitron text-2xl text-gold font-bold">
              {formatPrize(accumulatedPrize)}
            </span>
            <span className="text-xs text-muted-foreground">BluffCoins</span>
          </div>
        </div>
      </div>

      {/* Next Prize Indicator */}
      {nextPrize && currentRound < 15 && (
        <motion.div 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            "flex items-center justify-between p-3 rounded-lg border",
            nextRound === 15 
              ? "bg-gradient-to-r from-gold/10 via-amber-500/10 to-gold/10 border-gold/30"
              : "bg-secondary/30 border-border/50"
          )}
        >
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
              nextRound === 15 ? "bg-gold text-background" : "bg-primary/20 text-primary"
            )}>
              {nextRound}
            </div>
            <span className="text-xs text-muted-foreground">Próximo Prêmio</span>
          </div>
          <div className="flex items-center gap-1">
            {nextRound === 15 && <Trophy className="w-4 h-4 text-gold" />}
            <span className={cn(
              "font-orbitron font-bold",
              nextRound === 15 ? "text-gold text-lg" : "text-primary"
            )}>
              +{formatPrize(nextPrize)}
            </span>
          </div>
        </motion.div>
      )}

      {/* Prize Ladder (compact) */}
      <div className="bg-secondary/30 rounded-lg p-2 border border-border/30">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {PRIZE_LADDER.map((prize, index) => {
            const round = index + 1;
            const isCompleted = round < currentRound;
            const isCurrent = round === currentRound;
            const isProtected = hasGuaranteedPrize && prize <= safeAmount;
            
            return (
              <div
                key={round}
                className={cn(
                  "flex-shrink-0 flex flex-col items-center px-1.5 py-1 rounded transition-all",
                  isCompleted && "opacity-50",
                  isCurrent && "bg-primary/20 ring-1 ring-primary",
                  round === 15 && !isCompleted && "bg-gold/10"
                )}
              >
                <span className={cn(
                  "text-[8px] font-bold",
                  isCurrent ? "text-primary" : round === 15 ? "text-gold" : "text-muted-foreground"
                )}>
                  {round}
                </span>
                <span className={cn(
                  "text-[9px] font-orbitron whitespace-nowrap",
                  isCurrent ? "text-foreground" : round === 15 ? "text-gold" : "text-muted-foreground"
                )}>
                  {formatPrize(prize)}
                </span>
                {isProtected && (
                  <Shield className="w-2.5 h-2.5 text-cyan" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Immunity Card Status with pulsing glow */}
      {hasImmunityCard && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "relative flex items-center gap-2 text-xs rounded-lg p-2 border overflow-hidden",
            immunityCardUsed 
              ? "bg-muted/30 border-border/30 text-muted-foreground"
              : "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
          )}
        >
          {/* Pulsing glow effect when active */}
          {!immunityCardUsed && (
            <motion.div
              animate={{
                opacity: [0.3, 0.7, 0.3],
                scale: [1, 1.05, 1],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/30 via-cyan-400/20 to-cyan-500/30 rounded-lg"
            />
          )}
          
          {/* Animated ring around icon when active */}
          {!immunityCardUsed && (
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0 0 hsl(180 100% 50% / 0)',
                  '0 0 8px 2px hsl(180 100% 50% / 0.5)',
                  '0 0 0 0 hsl(180 100% 50% / 0)',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="absolute left-2 w-4 h-4 rounded-full"
            />
          )}
          
          <div className="relative z-10 flex items-center gap-2">
            {immunityCardUsed ? (
              <>
                <ShieldOff className="w-4 h-4" />
                <span>Carta Imunidade já utilizada</span>
              </>
            ) : (
              <>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <ShieldCheck className="w-4 h-4" />
                </motion.div>
                <span className="font-medium">Carta Imunidade ativa (1 uso)</span>
              </>
            )}
          </div>
        </motion.div>
      )}

      {/* Risk Warning */}
      {!hasGuaranteedPrize && accumulatedPrize > 0 && (
        <div className="flex items-center gap-2 text-xs text-destructive/80 bg-destructive/10 rounded-lg p-2 border border-destructive/20">
          <Flame className="w-4 h-4" />
          <span>Eliminação = Perde tudo ({formatPrize(accumulatedPrize)} em risco)</span>
        </div>
      )}
    </div>
  );
}
