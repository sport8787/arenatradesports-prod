/**
 * PressureTimer - Cronômetro com Pressão Cognitiva Progressiva
 * 
 * Features:
 * - Timer dinâmico baseado na rodada
 * - Bips irregulares nas rodadas 10-14 com vibração mobile
 * - Invisível na rodada 15
 * - Visual urgente quando tempo baixo
 * - Indicador de batimento cardíaco acelerando
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EyeOff, Clock, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPressureConfig, PressureConfig } from '@/services/pressureTimerService';

interface PressureTimerProps {
  round: number;
  isActive: boolean;
  onComplete?: () => void;
  onTick?: (secondsLeft: number) => void;
  className?: string;
}

// Vibration utility for mobile devices
const triggerVibration = (pattern: number | number[]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Vibration not supported or blocked
    }
  }
};

export default function PressureTimer({
  round,
  isActive,
  onComplete,
  onTick,
  className,
}: PressureTimerProps) {
  const [config, setConfig] = useState<PressureConfig>(() => getPressureConfig(round));
  const [secondsLeft, setSecondsLeft] = useState(config.timerDuration);
  const [isUrgent, setIsUrgent] = useState(false);
  
  const isMountedRef = useRef(true);
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);
  const beepTimeoutsRef = useRef<number[]>([]);
  const onCompleteRef = useRef(onComplete);
  const onTickRef = useRef(onTick);

  // Atualizar refs
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onTickRef.current = onTick;
  }, [onComplete, onTick]);

  // Cleanup ao desmontar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      beepTimeoutsRef.current.forEach(clearTimeout);
      beepTimeoutsRef.current = [];
      if (beepAudioRef.current) {
        beepAudioRef.current.pause();
        beepAudioRef.current = null;
      }
    };
  }, []);

  // Atualizar config quando rodada muda
  useEffect(() => {
    const newConfig = getPressureConfig(round);
    setConfig(newConfig);
    setSecondsLeft(newConfig.timerDuration);
    setIsUrgent(false);
  }, [round]);

  // Agendar bips irregulares usando arquivo de áudio bip.mp3
  useEffect(() => {
    // Limpar timeouts anteriores
    beepTimeoutsRef.current.forEach(clearTimeout);
    beepTimeoutsRef.current = [];
    
    if (!isActive || !config.enableBeeps) return;
    
    const playBeep = () => {
      if (!isMountedRef.current) return;
      
      try {
        // Usar arquivo de áudio bip.mp3
        const audio = new Audio('/audio/horus/bip.mp3');
        audio.volume = 0.3 + Math.random() * 0.2; // Volume variável para efeito mais desestabilizador
        audio.playbackRate = 0.9 + Math.random() * 0.3; // Pitch ligeiramente variável
        audio.play().catch(console.warn);
        
        // Vibrate on mobile synchronized with beep
        triggerVibration([50, 30, 50]);
      } catch (e) {
        console.error('[PressureTimer] Error playing beep:', e);
      }
    };
    
    // Agendar bips nos intervalos definidos
    config.beepIntervals.forEach((interval) => {
      const timeoutId = window.setTimeout(() => {
        if (isMountedRef.current && isActive) {
          playBeep();
        }
      }, interval);
      beepTimeoutsRef.current.push(timeoutId);
    });
    
    return () => {
      beepTimeoutsRef.current.forEach(clearTimeout);
      beepTimeoutsRef.current = [];
    };
  }, [isActive, config.enableBeeps, config.beepIntervals]);

  // Countdown principal
  useEffect(() => {
    if (!isActive) return;
    
    setSecondsLeft(config.timerDuration);
    
    const interval = setInterval(() => {
      if (!isMountedRef.current) return;
      
      setSecondsLeft((prev) => {
        const next = prev - 1;
        
        // Urgência quando restam 25% do tempo
        const urgentThreshold = Math.ceil(config.timerDuration * 0.25);
        setIsUrgent(next <= urgentThreshold);
        
        // Callback de tick
        onTickRef.current?.(next);
        
        // Timer completo
        if (next <= 0) {
          clearInterval(interval);
          onCompleteRef.current?.();
          return 0;
        }
        
        return next;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isActive, config.timerDuration]);

  // Vibrate on low time in high pressure rounds
  useEffect(() => {
    if (!isActive || round < 8) return;
    
    if (secondsLeft <= 5 && secondsLeft > 0) {
      // Heartbeat vibration pattern
      triggerVibration([100, 100, 100]);
    }
  }, [secondsLeft, isActive, round]);

  // Calculate heartbeat BPM based on pressure (60-180 BPM)
  const heartbeatBpm = 60 + (config.pressureLevel * 1.2);
  const heartbeatDuration = 60 / heartbeatBpm;

  // Timer invisível na rodada 15
  if (!config.timerVisible) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'flex flex-col items-center gap-2',
          className
        )}
      >
        {/* Heartbeat indicator for hidden timer */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1, 1.15, 1],
          }}
          transition={{
            duration: heartbeatDuration,
            repeat: Infinity,
            ease: 'easeInOut',
            times: [0, 0.15, 0.3, 0.45, 1],
          }}
          className="mb-2"
        >
          <Heart className="w-8 h-8 text-red-500 fill-red-500" />
        </motion.div>
        
        <motion.div
          animate={{ 
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.05, 1]
          }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="relative w-24 h-24 rounded-full bg-destructive/20 border-2 border-destructive/50 flex items-center justify-center"
        >
          <EyeOff className="w-10 h-10 text-destructive/70" />
        </motion.div>
        <p className="text-xs text-destructive/70 font-orbitron animate-pulse">
          TEMPO OCULTO
        </p>
      </motion.div>
    );
  }

  // Cálculos visuais
  const percentage = (secondsLeft / config.timerDuration) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (isUrgent) return 'hsl(var(--destructive))';
    if (config.pressureLevel >= 80) return 'hsl(var(--destructive))';
    if (config.pressureLevel >= 60) return 'hsl(38, 92%, 50%)'; // orange
    if (config.pressureLevel >= 40) return 'hsl(48, 96%, 53%)'; // amber
    return 'hsl(var(--primary))';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'relative flex flex-col items-center gap-2',
        className
      )}
    >
      {/* Heartbeat indicator for high pressure rounds (8+) */}
      {round >= 8 && (
        <div className="flex items-center gap-2 mb-1">
          <motion.div
            animate={{
              scale: [1, 1.15 + (config.pressureLevel / 200), 1, 1.1 + (config.pressureLevel / 250), 1],
            }}
            transition={{
              duration: heartbeatDuration,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.15, 0.3, 0.45, 1],
            }}
            className="relative"
          >
            <Heart 
              className={cn(
                'w-5 h-5 fill-current',
                config.pressureLevel >= 80 ? 'text-red-500' :
                config.pressureLevel >= 60 ? 'text-red-400' :
                'text-red-300'
              )} 
              strokeWidth={0}
            />
            {/* Glow effect for heartbeat */}
            {config.pressureLevel >= 60 && (
              <motion.div
                animate={{
                  opacity: [0.3, 0.8, 0.3],
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  duration: heartbeatDuration,
                  repeat: Infinity,
                  ease: 'easeOut',
                }}
                className="absolute inset-0 blur-md"
              >
                <Heart 
                  className={cn(
                    'w-5 h-5 fill-current',
                    config.pressureLevel >= 80 ? 'text-red-500' : 'text-red-400'
                  )} 
                  strokeWidth={0}
                />
              </motion.div>
            )}
          </motion.div>
          {config.pressureLevel >= 50 && (
            <span className={cn(
              'text-xs font-mono tabular-nums',
              config.pressureLevel >= 80 ? 'text-red-500' : 'text-red-400'
            )}>
              {Math.round(heartbeatBpm)}
            </span>
          )}
        </div>
      )}

      {/* Glow effect */}
      {isUrgent && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ repeat: Infinity, duration: 0.5 }}
          className="absolute inset-0 rounded-full bg-destructive/30 blur-xl"
        />
      )}
      
      {/* Círculo do timer */}
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90">
          {/* Track */}
          <circle
            cx="48"
            cy="48"
            r="45"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="6"
          />
          {/* Progress */}
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
            transition={{ duration: 0.3 }}
          />
        </svg>
        
        {/* Número central */}
        <div className="absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.span
              key={secondsLeft}
              initial={{ opacity: 0, scale: 1.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                'font-orbitron text-3xl font-bold',
                isUrgent ? 'text-destructive' : 'text-foreground'
              )}
            >
              {secondsLeft}
            </motion.span>
          </AnimatePresence>
        </div>
        
        {/* Pulse urgente */}
        {isUrgent && (
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ repeat: Infinity, duration: 0.5 }}
            className="absolute inset-0 rounded-full border-2 border-destructive"
          />
        )}
      </div>
      
      {/* Label */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>
          {config.enableBeeps ? 'PRESSÃO MÁXIMA' : 'TEMPO RESTANTE'}
        </span>
      </div>
    </motion.div>
  );
}
