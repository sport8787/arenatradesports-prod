import { useEffect, useRef, useState } from 'react';

/**
 * useState persistido em sessionStorage.
 * Mantém o valor durante a sessão do navegador (sobrevive a alt-tab, F5, e re-mounts).
 *
 * Uso:
 *   const [tab, setTab] = usePersistedState('arena-trader:tab', 'aprovados');
 */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const storageKey = `lov-persisted:${key}`;
  const isFirst = useRef(true);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw == null) return initial;
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // não escreve no primeiro render se valor === initial e nada estava salvo
    if (isFirst.current) {
      isFirst.current = false;
    }
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* sessionStorage cheio — silencioso */
    }
  }, [storageKey, value]);

  return [value, setValue];
}

export default usePersistedState;
