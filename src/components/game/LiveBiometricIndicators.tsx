/**
 * LiveBiometricIndicators Component
 * Displays real-time biometric metrics during video recording
 * Shows lip tension, blink rate, and gaze direction gauges
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Eye, MousePointer2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BiometricData {
  lipTension: number; // 0-100
  blinkRate: number; // blinks per minute
  gazeDirection: 'left' | 'right' | 'straight' | 'up' | 'down';
  stressLevel: number; // 0-100
}

interface LiveBiometricIndicatorsProps {
  data: BiometricData;
  isActive?: boolean;
  compact?: boolean;
  className?: string;
}

// Circular gauge component
function CircularGauge({ 
  value, 
  max, 
  label, 
  icon: Icon,
  unit = '%',
  thresholds = { low: 33, high: 66 },
}: {
  value: number;
  max: number;
  label: string;
  icon: React.ElementType;
  unit?: string;
  thresholds?: { low: number; high: number };
}) {
  const percentage = Math.min(100, (value / max) * 100);
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  // Determine color based on value
  const getColor = () => {
    if (percentage < thresholds.low) return 'text-emerald-500 stroke-emerald-500';
    if (percentage < thresholds.high) return 'text-yellow-500 stroke-yellow-500';
    return 'text-red-500 stroke-red-500';
  };

  const colorClass = getColor();

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="4"
            className="stroke-muted/30"
          />
          <motion.circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className={cn('transition-all duration-300', colorClass)}
            style={{
              strokeDasharray: circumference,
              strokeDashoffset,
            }}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </svg>
        
        {/* Center icon and value */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className={cn('w-3 h-3 mb-0.5', colorClass.split(' ')[0])} />
          <span className={cn('text-xs font-bold font-mono', colorClass.split(' ')[0])}>
            {Math.round(value)}{unit}
          </span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

// Gaze direction indicator
function GazeIndicator({ direction }: { direction: BiometricData['gazeDirection'] }) {
  const getPosition = () => {
    switch (direction) {
      case 'left': return { x: -8, y: 0 };
      case 'right': return { x: 8, y: 0 };
      case 'up': return { x: 0, y: -8 };
      case 'down': return { x: 0, y: 8 };
      default: return { x: 0, y: 0 };
    }
  };

  const getLabel = () => {
    switch (direction) {
      case 'left': return 'Memória';
      case 'right': return 'Construção';
      case 'up': return 'Auditivo';
      case 'down': return 'Interno';
      default: return 'Direto';
    }
  };

  const getColor = () => {
    switch (direction) {
      case 'left': return 'text-yellow-500';
      case 'right': return 'text-red-500';
      case 'straight': return 'text-emerald-500';
      default: return 'text-blue-500';
    }
  };

  const position = getPosition();

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16 rounded-full bg-muted/30 border border-muted/50">
        {/* Eye representation */}
        <div className="absolute inset-2 rounded-full bg-muted/50 flex items-center justify-center">
          {/* Iris */}
          <motion.div
            className="w-6 h-6 rounded-full bg-blue-600/80 flex items-center justify-center shadow-lg"
            animate={{ x: position.x, y: position.y }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {/* Pupil */}
            <div className="w-3 h-3 rounded-full bg-black" />
          </motion.div>
        </div>
        
        {/* Direction labels */}
        <span className="absolute -left-1 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">M</span>
        <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">C</span>
      </div>
      <span className={cn('text-[10px] font-medium', getColor())}>
        {getLabel()}
      </span>
    </div>
  );
}

export function LiveBiometricIndicators({
  data,
  isActive = true,
  compact = false,
  className,
}: LiveBiometricIndicatorsProps) {
  if (!isActive) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        className={cn(
          'bg-background/90 backdrop-blur-sm rounded-lg border border-primary/30 p-3',
          compact ? 'space-y-2' : 'space-y-3',
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground border-b border-border/50 pb-2">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-emerald-500"
          />
          <span className="font-medium">Biometria Ativa</span>
        </div>

        {/* Gauges */}
        <div className={cn(
          'flex items-center justify-between',
          compact ? 'gap-2' : 'gap-4'
        )}>
          {/* Lip Tension */}
          <CircularGauge
            value={data.lipTension}
            max={100}
            label="Tensão Labial"
            icon={Activity}
            thresholds={{ low: 30, high: 60 }}
          />

          {/* Gaze Direction */}
          <GazeIndicator direction={data.gazeDirection} />

          {/* Blink Rate */}
          <CircularGauge
            value={data.blinkRate}
            max={60}
            label="Piscadas/min"
            icon={Eye}
            unit=""
            thresholds={{ low: 15, high: 25 }}
          />
        </div>

        {/* Overall stress bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Índice de Tensão</span>
            <span className={cn(
              'font-mono font-bold',
              data.stressLevel < 33 ? 'text-emerald-500' :
              data.stressLevel < 66 ? 'text-yellow-500' : 'text-red-500'
            )}>
              {Math.round(data.stressLevel)}%
            </span>
          </div>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              className={cn(
                'h-full rounded-full transition-colors duration-300',
                data.stressLevel < 33 ? 'bg-emerald-500' :
                data.stressLevel < 66 ? 'bg-yellow-500' : 'bg-red-500'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${data.stressLevel}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default LiveBiometricIndicators;
