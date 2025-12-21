// Simplified atomic narration trigger hook
// Prevents duplicate narrations using a key-based lock

import { useRef, useCallback } from 'react';

export function useAtomicNarrationTrigger() {
  const lastTriggeredKey = useRef<string | null>(null);

  const shouldTrigger = useCallback((status: string, questionId?: string) => {
    // Create unique key for current state
    const currentKey = `${status}-${questionId || 'no-q'}`;

    // If key matches the last one, block execution
    if (lastTriggeredKey.current === currentKey) {
      console.log('[AtomicNarration] Blocked - already triggered:', currentKey);
      return false;
    }

    // Otherwise, update lock and allow narration
    lastTriggeredKey.current = currentKey;
    console.log('[AtomicNarration] Allowed - new key:', currentKey);
    return true;
  }, []);

  const resetTrigger = useCallback(() => {
    lastTriggeredKey.current = null;
    console.log('[AtomicNarration] Reset trigger state');
  }, []);

  return { shouldTrigger, resetTrigger };
}
