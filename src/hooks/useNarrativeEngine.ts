import { useState, useCallback, useRef, useEffect } from 'react';
import {
  NarrativeState,
  NarrativeAct,
  ActConfig,
  HiddenEvent,
  createInitialNarrativeState,
  updateNarrativeState,
  getCurrentAct,
  getTimerDuration,
  isTimerVisible,
  shouldTriggerBomb,
  generateBeepIntervals,
  getHorusPhrase,
  checkHiddenEvents,
  logNarrativeState,
} from '@/services/narrativeEngine';

interface UseNarrativeEngineOptions {
  onActChange?: (act: ActConfig) => void;
  onHiddenEvent?: (event: HiddenEvent) => void;
  onBombEvent?: () => void;
  onBeep?: () => void;
  enabled?: boolean;
}

interface UseNarrativeEngineReturn {
  state: NarrativeState;
  currentAct: ActConfig;
  timerDuration: number;
  timerVisible: boolean;
  pressureLevel: number;
  horusPhrase: string;
  advanceRound: (wasCorrect: boolean) => void;
  resetNarrative: () => void;
  triggerBombEvent: () => void;
  isClimaxRound: boolean;
  isFinalChoice: boolean;
}

export function useNarrativeEngine(options: UseNarrativeEngineOptions = {}): UseNarrativeEngineReturn {
  const {
    onActChange,
    onHiddenEvent,
    onBombEvent,
    onBeep,
    enabled = true,
  } = options;

  const [state, setState] = useState<NarrativeState>(createInitialNarrativeState);
  const beepTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const isMountedRef = useRef(true);
  const lastActRef = useRef<NarrativeAct>('initiation');

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      beepTimeoutsRef.current.forEach(clearTimeout);
      beepTimeoutsRef.current = [];
    };
  }, []);

  // Get current act config
  const currentAct = getCurrentAct(state.currentRound);
  const timerDuration = getTimerDuration(state.currentRound);
  const timerVisible = isTimerVisible(state.currentRound);

  // Detect act changes
  useEffect(() => {
    if (!enabled) return;
    
    if (currentAct.id !== lastActRef.current) {
      lastActRef.current = currentAct.id;
      onActChange?.(currentAct);
      console.log(`[NarrativeEngine] Ato mudou para: ${currentAct.name}`);
    }
  }, [currentAct, onActChange, enabled]);

  // Schedule beeps for pressure rounds
  useEffect(() => {
    if (!enabled || !currentAct.enableBeeps) return;

    // Clear previous beeps
    beepTimeoutsRef.current.forEach(clearTimeout);
    beepTimeoutsRef.current = [];

    const intervals = generateBeepIntervals(state.currentRound);
    
    intervals.forEach(interval => {
      const timeout = setTimeout(() => {
        if (isMountedRef.current) {
          onBeep?.();
        }
      }, interval);
      beepTimeoutsRef.current.push(timeout);
    });

    return () => {
      beepTimeoutsRef.current.forEach(clearTimeout);
      beepTimeoutsRef.current = [];
    };
  }, [state.currentRound, currentAct.enableBeeps, onBeep, enabled]);

  // Advance to next round
  const advanceRound = useCallback((wasCorrect: boolean) => {
    if (!isMountedRef.current) return;

    setState(prevState => {
      const newState = updateNarrativeState(prevState, wasCorrect);
      
      // Log state for debugging
      logNarrativeState(newState);
      
      // Check for hidden events
      const hiddenEvent = checkHiddenEvents(newState);
      if (hiddenEvent && onHiddenEvent) {
        setTimeout(() => {
          if (isMountedRef.current) {
            onHiddenEvent(hiddenEvent);
          }
        }, 500);
      }

      // Check for bomb event
      if (shouldTriggerBomb(newState.currentRound, prevState.bombEventTriggered)) {
        newState.bombEventTriggered = true;
        setTimeout(() => {
          if (isMountedRef.current) {
            onBombEvent?.();
          }
        }, 2000 + Math.random() * 3000);
      }

      return newState;
    });
  }, [onHiddenEvent, onBombEvent]);

  // Reset narrative to initial state
  const resetNarrative = useCallback(() => {
    beepTimeoutsRef.current.forEach(clearTimeout);
    beepTimeoutsRef.current = [];
    setState(createInitialNarrativeState());
    lastActRef.current = 'initiation';
  }, []);

  // Manually trigger bomb event
  const triggerBombEvent = useCallback(() => {
    if (!state.bombEventTriggered) {
      setState(prev => ({ ...prev, bombEventTriggered: true }));
      onBombEvent?.();
    }
  }, [state.bombEventTriggered, onBombEvent]);

  return {
    state,
    currentAct,
    timerDuration,
    timerVisible,
    pressureLevel: currentAct.pressureLevel,
    horusPhrase: getHorusPhrase(currentAct.horusTone),
    advanceRound,
    resetNarrative,
    triggerBombEvent,
    isClimaxRound: state.currentRound >= 13,
    isFinalChoice: state.currentRound === 15,
  };
}
