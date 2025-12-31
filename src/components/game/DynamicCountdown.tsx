import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicCountdownProps {
  duration: number;
  visible: boolean;
  pressureLevel: number;
  onComplete: () => void;
  onTick?: (secondsLeft: number) => void;
  isActive: boolean;
  className?: string;
}

export default function DynamicCountdown({
  duration,
  visible,
  pressureLevel,
  onComplete,
  onTick,
  isActive,
  className,
}: DynamicCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(duration);
  const [isUrgent, setIsUrgent] = useState(false);
  const isMountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);

  // Keep refs updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTickRef.current = onTick;
  }, [onComplete, onTick]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Reset when duration changes or becomes active
  useEffect(() => {
    if (!isActive) {
      setSecondsLeft(duration);
      setIsUrgent(false);
      return;
    }

    setSecondsLeft(duration);

    const interval = setInterval(() => {
      if (!isMountedRef.current) {
        clearInterval(interval);
        return;
      }

      setSecondsLeft((prev) => {
        const newValue = prev - 1;

        // Urgent threshold based on pressure
        const urgentThreshold = pressureLevel >= 80 ? 8 : 5;

        if (newValue <= urgentThreshold && newValue > 0) {
          setIsUrgent(true);
          onTickRef.current?.(newValue);
        }

        if (newValue <= 0) {
          clearInterval(interval);
          if (isMountedRef.current) {
            onCompleteRef.current();
          }
          return 0;
        }

        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, duration, pressureLevel]);

  // If not visible (Round 15), show mystery indicator
  if (!visible) {
    return (
      <div className={cn('flex flex-col items-center gap-2', className)}>
        <motion.div
          animate={{
            opacity: [0.3, 0.7, 0.3],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative w-24 h-24 flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-full bg-destructive/20 blur-xl" />
          <div className="relative z-10 flex flex-col items-center gap-1">
            <EyeOff className="w-8 h-8 text-destructive" />
            <span className="text-xs text-destructive font-bold">???</span>
          </div>
        </motion.div>
        <div className="flex items-center gap-1 text-destructive text-sm font-medium">
          <Clock className="w-4 h-4" />
          <span>Tempo Oculto</span>
        </div>
      </div>
    );
  }

  const percentage = (secondsLeft / duration) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Color based on pressure and urgency
  const getColor = () => {
    if (isUrgent) return 'hsl(var(--destructive))';
    if (pressureLevel >= 80) return 'hsl(var(--warning, 38 92% 50%))';
    if (pressureLevel >= 60) return 'hsl(var(--primary))';
    return 'hsl(var(--primary))';
  };

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative w-24 h-24">
        {/* Pressure glow effect */}
        {pressureLevel >= 60 && (
          <motion.div
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(circle, ${getColor()}40 0%, transparent 70%)`,
            }}
          />
        )}

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
            stroke={getColor()}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <AnimatePresence mode="sync">
            <motion.span
              key={secondsLeft}
              initial={{ scale: 1.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'font-orbitron text-2xl font-bold',
                isUrgent ? 'text-destructive' : pressureLevel >= 60 ? 'text-primary' : 'text-primary'
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
            transition={{ repeat: Infinity, duration: 0.8 }}
          />
        )}
      </div>

      <div className="flex items-center gap-1 text-muted-foreground text-sm">
        <Clock className="w-4 h-4" />
        <span>
          {pressureLevel >= 80 ? 'PRESSÃO MÁXIMA' : 'Tempo restante'}
        </span>
      </div>

      {/* Duration indicator for context */}
      {duration !== 30 && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-muted-foreground/60"
        >
          {duration}s (reduzido)
        </motion.div>
      )}
    </div>
  );
}
