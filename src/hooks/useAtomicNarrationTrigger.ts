// Unified hook for atomic narration triggering with cancellation support
// Prevents duplicate narrations and handles cleanup on phase changes

import { useRef, useCallback, useEffect } from 'react';
import { stopGlobalAudio } from '@/services/globalAudioContext';

interface UseAtomicNarrationTriggerOptions {
  /** Current phase/status that determines when narration should play */
  phase: string;
  /** Unique identifier for the content (e.g., question ID) */
  contentId: string | null | undefined;
  /** Phases that should trigger narration (e.g., ['question']) */
  triggerPhases: string[];
  /** Previous phases that indicate a fresh transition (e.g., ['lobby', 'result']) */
  freshTransitionFromPhases?: string[];
  /** Delay before starting narration (ms) */
  delay?: number;
  /** Callback to execute narration */
  onNarrate: () => void | Promise<void>;
  /** Callback to stop/cleanup audio */
  onCleanup?: () => void;
  /** Whether narration is enabled */
  enabled?: boolean;
}

interface UseAtomicNarrationTriggerReturn {
  /** Manually trigger narration (respects atomic lock) */
  triggerNarration: () => void;
  /** Cancel any pending/playing narration */
  cancelNarration: () => void;
  /** Check if a specific key has already been triggered */
  hasTriggered: (key: string) => boolean;
  /** Reset the trigger state (useful for new game) */
  reset: () => void;
}

export function useAtomicNarrationTrigger(
  options: UseAtomicNarrationTriggerOptions
): UseAtomicNarrationTriggerReturn {
  const {
    phase,
    contentId,
    triggerPhases,
    freshTransitionFromPhases = [],
    delay = 1500,
    onNarrate,
    onCleanup,
    enabled = true,
  } = options;

  // Atomic lock - tracks which keys have been triggered
  const lastTriggerKeyRef = useRef<string>('');
  const previousPhaseRef = useRef<string>(phase);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isNarratingRef = useRef(false);

  // Generate unique key for this narration trigger
  const generateKey = useCallback((p: string, id: string | null | undefined) => {
    return `${p}-${id || 'none'}`;
  }, []);

  // Cancel any pending or playing narration
  const cancelNarration = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      console.log('[AtomicNarration] Cancelled pending timeout');
    }
    
    stopGlobalAudio();
    onCleanup?.();
    isNarratingRef.current = false;
  }, [onCleanup]);

  // Check if a key has already been triggered
  const hasTriggered = useCallback((key: string) => {
    return lastTriggerKeyRef.current === key;
  }, []);

  // Reset trigger state
  const reset = useCallback(() => {
    lastTriggerKeyRef.current = '';
    previousPhaseRef.current = '';
    cancelNarration();
    console.log('[AtomicNarration] Reset trigger state');
  }, [cancelNarration]);

  // Manually trigger narration with atomic lock
  const triggerNarration = useCallback(() => {
    if (!enabled) return;

    const currentKey = generateKey(phase, contentId);

    // ATOMIC CHECK: If already triggered this exact combination, skip
    if (lastTriggerKeyRef.current === currentKey) {
      console.log('[AtomicNarration] Skipped - already triggered:', currentKey);
      return;
    }

    // ATOMIC LOCK: Set immediately before any async operation
    lastTriggerKeyRef.current = currentKey;
    console.log('[AtomicNarration] Acquired lock for:', currentKey);

    // Cancel any existing narration
    cancelNarration();

    // Schedule narration with delay
    isNarratingRef.current = true;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      
      // Double-check we still have the lock
      if (lastTriggerKeyRef.current !== currentKey) {
        console.log('[AtomicNarration] Lock was released, aborting');
        return;
      }

      console.log('[AtomicNarration] Executing narration for:', currentKey);
      onNarrate();
    }, delay);
  }, [enabled, phase, contentId, generateKey, cancelNarration, delay, onNarrate]);

  // Auto-trigger on phase transitions
  useEffect(() => {
    const previousPhase = previousPhaseRef.current;
    const currentKey = generateKey(phase, contentId);

    // Update previous phase tracker
    previousPhaseRef.current = phase;

    // If phase changed, always cancel pending audio first
    if (previousPhase !== phase) {
      console.log('[AtomicNarration] Phase changed:', previousPhase, '->', phase);
      cancelNarration();
    }

    // Check if we should trigger narration
    if (!enabled || !contentId) return;

    const shouldTrigger = triggerPhases.includes(phase);
    const isFreshTransition = freshTransitionFromPhases.length === 0 || 
                               freshTransitionFromPhases.includes(previousPhase);

    if (shouldTrigger && isFreshTransition) {
      // ATOMIC CHECK: Skip if already triggered
      if (lastTriggerKeyRef.current === currentKey) {
        console.log('[AtomicNarration] Auto-trigger skipped - already triggered:', currentKey);
        return;
      }

      // ATOMIC LOCK: Acquire immediately
      lastTriggerKeyRef.current = currentKey;
      console.log('[AtomicNarration] Auto-trigger acquired lock:', currentKey);

      // Schedule narration
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        
        if (lastTriggerKeyRef.current !== currentKey) {
          console.log('[AtomicNarration] Lock released before execution');
          return;
        }

        console.log('[AtomicNarration] Auto-executing narration');
        onNarrate();
      }, delay);
    }
  }, [phase, contentId]); // Minimal dependencies - only phase and content

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopGlobalAudio();
    };
  }, []);

  return {
    triggerNarration,
    cancelNarration,
    hasTriggered,
    reset,
  };
}
