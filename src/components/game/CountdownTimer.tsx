import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  duration: number; // in seconds
  onComplete: () => void;
  onTick?: (secondsLeft: number) => void;
  isActive: boolean;
}

export default function CountdownTimer({ 
  duration, 
  onComplete, 
  onTick,
  isActive 
}: CountdownTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setSecondsLeft(duration);
      setIsUrgent(false);
      return;
    }

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        const newValue = prev - 1;
        
        if (newValue <= 5 && newValue > 0) {
          setIsUrgent(true);
          onTick?.(newValue);
        }
        
        if (newValue <= 0) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration, onComplete, onTick]);

  const percentage = (secondsLeft / duration) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        {/* Background circle */}
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="45"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="6"
          />
          {/* Progress circle */}
          <motion.circle
            cx="48"
            cy="48"
            r="45"
            fill="none"
            stroke={isUrgent ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={secondsLeft}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'font-orbitron text-2xl font-bold',
                isUrgent ? 'text-destructive' : 'text-primary'
              )}
            >
              {secondsLeft}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Urgent pulse effect */}
        {isUrgent && (
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-destructive"
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 1 }}
          />
        )}
      </div>

      <div className="flex items-center gap-1 text-muted-foreground text-sm">
        <Clock className="w-4 h-4" />
        <span>Tempo restante</span>
      </div>
    </div>
  );
}
