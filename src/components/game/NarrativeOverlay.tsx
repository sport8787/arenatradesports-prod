import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNarrativeOptional } from '@/contexts/NarrativeContext';
import PressureEffects from '@/components/game/PressureEffects';
import NarrativeDisplay from '@/components/game/NarrativeDisplay';
import DynamicCountdown from '@/components/game/DynamicCountdown';
import { cn } from '@/lib/utils';

interface NarrativeOverlayProps {
  isActive: boolean;
  onTimerComplete?: () => void;
  onTick?: (secondsLeft: number) => void;
  showTimer?: boolean;
  showActIndicator?: boolean;
  className?: string;
}

/**
 * NarrativeOverlay - Integrates narrative engine visuals into game view
 * 
 * Features:
 * - Dynamic countdown timer based on act progression
 * - Pressure effects (vignette, flash, beeps)
 * - Act indicator showing current narrative phase
 * - Silent Observer indicator when active
 */
export default function NarrativeOverlay({
  isActive,
  onTimerComplete,
  onTick,
  showTimer = true,
  showActIndicator = true,
  className,
}: NarrativeOverlayProps) {
  const narrative = useNarrativeOptional();

  // If no narrative context, render nothing
  if (!narrative) {
    return null;
  }

  const {
    state,
    currentAct,
    timerDuration,
    timerVisible,
    pressureLevel,
  } = narrative;

  return (
    <>
      {/* Pressure visual effects (full screen overlay) */}
      <PressureEffects
        pressureLevel={pressureLevel}
        enableBeeps={currentAct.enableBeeps && isActive}
        enableBomb={currentAct.enableBombEvent && isActive && !state.bombEventTriggered}
        className="pointer-events-none"
      />

      {/* Act indicator - top of screen */}
      <AnimatePresence mode="sync">
        {showActIndicator && isActive && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn('absolute top-4 left-4 z-40', className)}
          >
            <NarrativeDisplay
              currentAct={currentAct}
              round={state.currentRound}
              silentObserverActive={state.silentObserverActive}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic countdown timer */}
      <AnimatePresence mode="sync">
        {showTimer && isActive && onTimerComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex justify-center"
          >
            <DynamicCountdown
              duration={timerDuration}
              visible={timerVisible}
              pressureLevel={pressureLevel}
              onComplete={onTimerComplete}
              onTick={onTick}
              isActive={isActive}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
