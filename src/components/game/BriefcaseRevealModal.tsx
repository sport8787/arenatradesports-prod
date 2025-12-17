import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Sparkles, Coins } from 'lucide-react';
import { useState, useEffect } from 'react';
import GoldButton from './GoldButton';

interface BriefcaseRevealModalProps {
  show: boolean;
  prizeAmount: number;
  onContinue: () => void;
}

const formatPrize = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${Math.round(amount / 1000).toLocaleString()}k`;
  return amount.toLocaleString();
};

export default function BriefcaseRevealModal({ show, prizeAmount, onContinue }: BriefcaseRevealModalProps) {
  const [revealed, setRevealed] = useState(false);
  const [countingUp, setCountingUp] = useState(0);

  useEffect(() => {
    if (show) {
      setRevealed(false);
      setCountingUp(0);
      
      // Start reveal animation
      const revealTimer = setTimeout(() => {
        setRevealed(true);
        
        // Count up animation
        const duration = 2000;
        const steps = 30;
        const increment = prizeAmount / steps;
        let current = 0;
        
        const countInterval = setInterval(() => {
          current += increment;
          if (current >= prizeAmount) {
            setCountingUp(prizeAmount);
            clearInterval(countInterval);
          } else {
            setCountingUp(Math.floor(current));
          }
        }, duration / steps);
        
        return () => clearInterval(countInterval);
      }, 1500);
      
      return () => clearTimeout(revealTimer);
    }
  }, [show, prizeAmount]);

  const isGoodPrize = prizeAmount >= 100000;
  const isBadPrize = prizeAmount < 10000;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95"
        >
          <div className="w-full max-w-lg text-center">
            {!revealed ? (
              // Opening animation
              <motion.div className="space-y-8">
                <motion.div
                  animate={{
                    scale: [1, 1.1, 1],
                    rotateY: [0, 180, 360],
                  }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="w-48 h-32 mx-auto bg-gradient-to-br from-gray-900 via-gray-800 to-black rounded-lg border-4 border-gold/60 flex items-center justify-center relative"
                >
                  <motion.div
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.5, repeat: 3 }}
                    className="absolute inset-0 bg-gold/30 rounded-lg"
                  />
                  <Briefcase className="w-20 h-20 text-gold" />
                </motion.div>
                
                <motion.h3
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="font-orbitron text-xl text-gold"
                >
                  ABRINDO A MALETA...
                </motion.h3>
              </motion.div>
            ) : (
              // Revealed prize
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 15 }}
                className="space-y-6"
              >
                {/* Sparkle explosion */}
                {isGoodPrize && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.5, 0] }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 pointer-events-none flex items-center justify-center"
                  >
                    {[...Array(12)].map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ x: 0, y: 0, opacity: 1 }}
                        animate={{
                          x: Math.cos((i * 30 * Math.PI) / 180) * 200,
                          y: Math.sin((i * 30 * Math.PI) / 180) * 200,
                          opacity: 0,
                        }}
                        transition={{ duration: 1, delay: 0.2 }}
                      >
                        <Sparkles className="w-6 h-6 text-gold" />
                      </motion.div>
                    ))}
                  </motion.div>
                )}

                {/* Prize display */}
                <motion.div
                  animate={isGoodPrize ? {
                    boxShadow: [
                      '0 0 30px hsl(var(--gold)/0.5)',
                      '0 0 80px hsl(var(--gold)/0.8)',
                      '0 0 30px hsl(var(--gold)/0.5)',
                    ],
                  } : undefined}
                  transition={{ duration: 2, repeat: Infinity }}
                  className={`p-8 rounded-2xl border-2 ${
                    isGoodPrize 
                      ? 'bg-gradient-to-b from-gold/20 to-gold/5 border-gold' 
                      : isBadPrize
                        ? 'bg-gradient-to-b from-destructive/20 to-destructive/5 border-destructive/50'
                        : 'bg-gradient-to-b from-secondary to-background border-border'
                  }`}
                >
                  <motion.div
                    animate={isGoodPrize ? { scale: [1, 1.1, 1] } : undefined}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    <Coins className={`w-16 h-16 mx-auto mb-4 ${
                      isGoodPrize ? 'text-gold' : isBadPrize ? 'text-destructive' : 'text-primary'
                    }`} />
                  </motion.div>

                  <h2 className={`font-orbitron text-lg mb-2 ${
                    isGoodPrize ? 'text-gold' : isBadPrize ? 'text-destructive' : 'text-foreground'
                  }`}>
                    {isGoodPrize ? '🎉 GRANDE PRÊMIO!' : isBadPrize ? '😬 Opa...' : 'Você ganhou:'}
                  </h2>
                  
                  <motion.p
                    className={`font-orbitron text-5xl font-bold ${
                      isGoodPrize ? 'text-gold' : isBadPrize ? 'text-destructive' : 'text-primary'
                    }`}
                  >
                    {formatPrize(countingUp)}
                  </motion.p>
                  
                  <p className="text-muted-foreground mt-2">BluffCoins</p>
                </motion.div>

                {/* Message */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-muted-foreground"
                >
                  {isGoodPrize 
                    ? 'A sorte estava do seu lado!' 
                    : isBadPrize 
                      ? 'Talvez a pergunta de 1M fosse melhor...'
                      : 'Um prêmio razoável. Sem riscos!'
                  }
                </motion.p>

                {/* Continue button */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                >
                  <GoldButton onClick={onContinue} size="lg" className="w-full max-w-xs mx-auto">
                    CONTINUAR
                  </GoldButton>
                </motion.div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
