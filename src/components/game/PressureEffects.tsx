import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PressureEffectsProps {
  pressureLevel: number; // 0-100
  enableBeeps: boolean;
  enableBomb: boolean;
  onBombTriggered?: () => void;
  className?: string;
}

export default function PressureEffects({
  pressureLevel,
  enableBeeps,
  enableBomb,
  onBombTriggered,
  className,
}: PressureEffectsProps) {
  const [showFlash, setShowFlash] = useState(false);
  const [showVignette, setShowVignette] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const beepAudioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (beepAudioRef.current) {
        beepAudioRef.current.pause();
        beepAudioRef.current = null;
      }
    };
  }, []);

  // Trigger bomb effect
  const triggerBomb = useCallback(() => {
    if (!isMountedRef.current) return;

    // Visual flash
    setShowFlash(true);
    setTimeout(() => {
      if (isMountedRef.current) {
        setShowFlash(false);
      }
    }, 150);

    // Play impact sound
    try {
      audioRef.current = new Audio('/audio/horus/erro.mp3');
      audioRef.current.volume = 0.8;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.warn('Could not play bomb audio');
    }

    onBombTriggered?.();
  }, [onBombTriggered]);

  // Trigger beep effect
  const triggerBeep = useCallback(() => {
    if (!isMountedRef.current || !enableBeeps) return;

    try {
      beepAudioRef.current = new Audio('/audio/horus/erro2.mp3');
      beepAudioRef.current.volume = 0.3;
      beepAudioRef.current.playbackRate = 1.5;
      beepAudioRef.current.play().catch(() => {});
    } catch (e) {
      console.warn('Could not play beep audio');
    }
  }, [enableBeeps]);

  // Random beeps based on pressure level
  useEffect(() => {
    if (!enableBeeps || pressureLevel < 60) return;

    const scheduleBeep = () => {
      const minDelay = Math.max(2000, 10000 - pressureLevel * 80);
      const maxDelay = Math.max(5000, 15000 - pressureLevel * 100);
      const delay = minDelay + Math.random() * (maxDelay - minDelay);

      return setTimeout(() => {
        if (isMountedRef.current) {
          triggerBeep();
          scheduleBeep();
        }
      }, delay);
    };

    const timeout = scheduleBeep();
    return () => clearTimeout(timeout);
  }, [enableBeeps, pressureLevel, triggerBeep]);

  // Vignette effect based on pressure
  useEffect(() => {
    setShowVignette(pressureLevel >= 60);
  }, [pressureLevel]);

  // Random bomb trigger
  useEffect(() => {
    if (!enableBomb) return;

    // Random delay between 5-15 seconds after enabling
    const delay = 5000 + Math.random() * 10000;
    const timeout = setTimeout(() => {
      if (isMountedRef.current) {
        triggerBomb();
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [enableBomb, triggerBomb]);

  return (
    <div className={cn('pointer-events-none fixed inset-0 z-50', className)}>
      {/* Flash effect (A Bomba) */}
      <AnimatePresence mode="sync">
        {showFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.05 }}
            className="absolute inset-0 bg-white"
          />
        )}
      </AnimatePresence>

      {/* Vignette effect for high pressure */}
      <AnimatePresence mode="sync">
        {showVignette && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: pressureLevel / 200 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, transparent 50%, hsl(var(--destructive) / 0.3) 100%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Pulse effect for climax rounds */}
      {pressureLevel >= 80 && (
        <motion.div
          animate={{
            boxShadow: [
              'inset 0 0 100px 20px transparent',
              'inset 0 0 100px 20px hsl(var(--destructive) / 0.1)',
              'inset 0 0 100px 20px transparent',
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute inset-0"
        />
      )}
    </div>
  );
}

// Export individual trigger functions for external use
export function usePressureEffects() {
  const [isFlashing, setIsFlashing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const triggerBomb = useCallback(() => {
    if (!isMountedRef.current) return;

    setIsFlashing(true);
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsFlashing(false);
      }
    }, 150);

    try {
      audioRef.current = new Audio('/audio/horus/erro.mp3');
      audioRef.current.volume = 0.8;
      audioRef.current.play().catch(() => {});
    } catch (e) {
      console.warn('Could not play bomb audio');
    }
  }, []);

  const triggerBeep = useCallback(() => {
    if (!isMountedRef.current) return;

    try {
      const audio = new Audio('/audio/horus/erro2.mp3');
      audio.volume = 0.3;
      audio.playbackRate = 1.2 + Math.random() * 0.6;
      audio.play().catch(() => {});
    } catch (e) {
      console.warn('Could not play beep audio');
    }
  }, []);

  return {
    isFlashing,
    triggerBomb,
    triggerBeep,
  };
}
