// Simplified atomic narration trigger hook with cross-remount persistence
// Prevents duplicate narrations using a key-based lock stored in a module-level map.

import { useCallback } from 'react';

// Persist across component remounts (fixes duplicate triggers when pages remount)
const GLOBAL_LAST_TRIGGERED_KEY_BY_SCOPE = new Map<string, string | null>();

export function useAtomicNarrationTrigger(scope: string = 'default') {
  const shouldTrigger = useCallback(
    (status: string, questionId?: string) => {
      const currentKey = `${status}-${questionId || 'no-q'}`;
      const lastKey = GLOBAL_LAST_TRIGGERED_KEY_BY_SCOPE.get(scope) ?? null;

      if (lastKey === currentKey) {
        console.log('[AtomicNarration] Blocked - already triggered:', { scope, currentKey });
        return false;
      }

      GLOBAL_LAST_TRIGGERED_KEY_BY_SCOPE.set(scope, currentKey);
      console.log('[AtomicNarration] Allowed - new key:', { scope, currentKey });
      return true;
    },
    [scope]
  );

  const resetTrigger = useCallback(() => {
    GLOBAL_LAST_TRIGGERED_KEY_BY_SCOPE.set(scope, null);
    console.log('[AtomicNarration] Reset trigger state:', { scope });
  }, [scope]);

  return { shouldTrigger, resetTrigger };
}
