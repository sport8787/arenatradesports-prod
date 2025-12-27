import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gem, Sparkles } from 'lucide-react';

interface CoinVaultAnimationProps {
  amount: number;
  onComplete?: () => void;
}

export function CoinVaultAnimation({ amount, onComplete }: CoinVaultAnimationProps) {
  const [coins, setCoins] = useState<{ id: number; x: number; delay: number }[]>([]);
  const [showTotal, setShowTotal] = useState(false);

  useEffect(() => {
    // Generate coin positions
    const coinCount = Math.min(Math.ceil(amount / 10), 20);
    const newCoins = Array.from({ length: coinCount }, (_, i) => ({
      id: i,
      x: Math.random() * 80 + 10, // 10-90% of container width
      delay: i * 0.1,
    }));
    setCoins(newCoins);

    // Show total after coins land
    const totalTimeout = setTimeout(() => {
      setShowTotal(true);
    }, coinCount * 100 + 500);

    // Complete animation
    const completeTimeout = setTimeout(() => {
      onComplete?.();
    }, coinCount * 100 + 2500);

    return () => {
      clearTimeout(totalTimeout);
      clearTimeout(completeTimeout);
    };
  }, [amount, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-md h-80">
        {/* Vault/Chest at bottom */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-40 h-24"
        >
          <div className="w-full h-full bg-gradient-to-b from-emerald-600 to-emerald-900 rounded-t-xl border-2 border-emerald-400/50 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-emerald-200 animate-pulse" />
          </div>
          {/* Vault glow */}
          <div className="absolute -inset-4 bg-emerald-500/20 rounded-full blur-2xl -z-10" />
        </motion.div>

        {/* Falling Coins */}
        <AnimatePresence>
          {coins.map(coin => (
            <motion.div
              key={coin.id}
              initial={{ 
                y: -100, 
                x: `${coin.x}%`,
                rotate: 0,
                opacity: 1 
              }}
              animate={{ 
                y: 180, 
                rotate: 720,
                opacity: [1, 1, 0.8]
              }}
              transition={{ 
                duration: 0.8, 
                delay: coin.delay,
                ease: 'easeIn'
              }}
              className="absolute top-0"
              style={{ left: `${coin.x}%` }}
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-emerald-300 flex items-center justify-center shadow-lg shadow-emerald-500/50">
                <Gem className="w-4 h-4 text-emerald-100" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Total Display */}
        <AnimatePresence>
          {showTotal && (
            <motion.div
              initial={{ scale: 0, y: -50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center"
            >
              <div className="text-6xl font-orbitron font-black text-emerald-400 text-glow-green mb-2">
                +{amount}
              </div>
              <div className="text-lg font-orbitron text-emerald-300">
                BleffCoins no Cofre!
              </div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="mt-4"
              >
                <Gem className="w-12 h-12 text-emerald-400 mx-auto" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
