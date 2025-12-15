import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface BluffCoinDisplayProps {
  amount: number;
  size?: 'sm' | 'md' | 'lg';
  showChange?: boolean;
  className?: string;
}

export default function BluffCoinDisplay({ 
  amount, 
  size = 'md',
  showChange = true,
  className 
}: BluffCoinDisplayProps) {
  const [displayAmount, setDisplayAmount] = useState(amount);
  const [change, setChange] = useState<number | null>(null);
  const prevAmount = useRef(amount);

  useEffect(() => {
    if (amount !== prevAmount.current && showChange) {
      const diff = amount - prevAmount.current;
      setChange(diff);
      
      // Animate the number change
      const steps = 20;
      const stepValue = diff / steps;
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep++;
        setDisplayAmount(prev => Math.round(prev + stepValue));
        if (currentStep >= steps) {
          clearInterval(interval);
          setDisplayAmount(amount);
        }
      }, 30);

      // Clear change indicator after animation
      setTimeout(() => setChange(null), 2000);
      
      prevAmount.current = amount;
      return () => clearInterval(interval);
    } else {
      setDisplayAmount(amount);
      prevAmount.current = amount;
    }
  }, [amount, showChange]);

  const sizeClasses = {
    sm: 'text-sm gap-1',
    md: 'text-base gap-2',
    lg: 'text-xl gap-2',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
  };

  return (
    <div className={cn('flex items-center', sizeClasses[size], className)}>
      {/* BluffCoin Icon */}
      <div className={cn(
        'relative flex items-center justify-center rounded-full bg-gradient-to-br from-gold via-primary to-gold-dark shadow-lg',
        iconSizes[size]
      )}>
        <span className="font-orbitron font-black text-background text-xs">B</span>
        <div className="absolute inset-0 rounded-full bg-gradient-to-t from-transparent to-white/30" />
      </div>

      {/* Amount */}
      <motion.span 
        key={displayAmount}
        initial={change ? { scale: 1.2 } : false}
        animate={{ scale: 1 }}
        className={cn(
          'font-orbitron font-bold tabular-nums transition-colors duration-300',
          change && change > 0 && 'text-success',
          change && change < 0 && 'text-destructive',
          !change && 'text-gold'
        )}
      >
        {displayAmount.toLocaleString('pt-BR')}
      </motion.span>

      {/* Change Indicator */}
      <AnimatePresence>
        {change && (
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            className={cn(
              'text-xs font-bold',
              change > 0 ? 'text-success' : 'text-destructive'
            )}
          >
            {change > 0 ? '+' : ''}{change.toLocaleString('pt-BR')}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

// Inline BluffCoin icon for buttons
export function BluffCoinIcon({ className }: { className?: string }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-4 h-4 rounded-full bg-gradient-to-br from-gold via-primary to-gold-dark text-background text-[8px] font-orbitron font-black',
      className
    )}>
      B
    </span>
  );
}

// Cost display for buttons
export function BluffCoinCost({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm', className)}>
      <span className="text-gold">-{amount}</span>
      <BluffCoinIcon />
    </span>
  );
}
