import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, TrendingUp } from 'lucide-react';
import { GameRewardsTracker, calculateTotalRewards } from '@/services/bcRewardsService';

interface LiveBCCounterProps {
  tracker: GameRewardsTracker;
  className?: string;
}

export default function LiveBCCounter({ tracker, className = '' }: LiveBCCounterProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [previousValue, setPreviousValue] = useState(0);
  const [showGainAnimation, setShowGainAnimation] = useState(false);
  const [gainAmount, setGainAmount] = useState(0);

  const currentTotal = calculateTotalRewards(tracker);

  useEffect(() => {
    if (currentTotal > previousValue) {
      const gained = currentTotal - previousValue;
      setGainAmount(gained);
      setShowGainAnimation(true);
      
      // Animate the counter
      const duration = 500;
      const steps = 20;
      const increment = (currentTotal - displayValue) / steps;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        if (step >= steps) {
          setDisplayValue(currentTotal);
          clearInterval(interval);
        } else {
          setDisplayValue(prev => Math.min(prev + increment, currentTotal));
        }
      }, duration / steps);
      
      // Hide gain animation after delay
      setTimeout(() => setShowGainAnimation(false), 2000);
      
      return () => clearInterval(interval);
    }
    
    setPreviousValue(currentTotal);
    setDisplayValue(currentTotal);
  }, [currentTotal]);

  useEffect(() => {
    setPreviousValue(currentTotal);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <motion.div
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-gold/20 via-amber-500/10 to-gold/20 border border-gold/40 shadow-lg shadow-gold/10"
        animate={showGainAnimation ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          animate={showGainAnimation ? { rotate: [0, -15, 15, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <Coins className="w-5 h-5 text-gold" />
        </motion.div>
        
        <div className="flex flex-col">
          <span className="text-[10px] text-gold/70 uppercase tracking-wider font-medium">BC Ganhos</span>
          <motion.span 
            className="font-orbitron text-lg font-bold text-gold leading-tight"
            key={Math.floor(displayValue)}
          >
            +{Math.floor(displayValue)}
          </motion.span>
        </div>
      </motion.div>

      {/* Floating gain notification */}
      <AnimatePresence>
        {showGainAnimation && gainAmount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 0, x: '-50%' }}
            animate={{ opacity: 1, y: -40 }}
            exit={{ opacity: 0, y: -60 }}
            className="absolute -top-2 left-1/2 flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-sm font-bold whitespace-nowrap z-10"
          >
            <TrendingUp className="w-3 h-3" />
            +{gainAmount} BC
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sparkle effects on gain */}
      <AnimatePresence>
        {showGainAnimation && (
          <>
            {[...Array(4)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ 
                  opacity: 1, 
                  scale: 0,
                  x: 0,
                  y: 0
                }}
                animate={{ 
                  opacity: 0, 
                  scale: 1,
                  x: (i % 2 === 0 ? 1 : -1) * (20 + Math.random() * 20),
                  y: -20 - Math.random() * 30
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-gold"
                style={{ 
                  boxShadow: '0 0 6px 2px rgba(255, 215, 0, 0.6)'
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}