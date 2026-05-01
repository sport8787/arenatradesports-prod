import { useEffect, useState, useCallback } from 'react';

export type PunterViewMode = 'simple' | 'advanced';

const STORAGE_KEY = 'punter:view_mode';
const EVT = 'punter:view_mode_changed';

function read(): PunterViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

/**
 * Modo de visualização do Punter.
 * - simple: esconde painéis técnicos (Backtest, Sherlock, Debug de liquidação)
 * - advanced: mostra tudo (default histórico para admins/usuários técnicos)
 *
 * Persistido em localStorage e sincronizado entre componentes via custom event.
 */
export function usePunterViewMode() {
  const [mode, setModeState] = useState<PunterViewMode>(() => read());

  useEffect(() => {
    const onChange = () => setModeState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const setMode = useCallback((next: PunterViewMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    setModeState(next);
    window.dispatchEvent(new Event(EVT));
  }, []);

  const toggle = useCallback(() => {
    setMode(read() === 'simple' ? 'advanced' : 'simple');
  }, [setMode]);

  return {
    mode,
    isSimple: mode === 'simple',
    isAdvanced: mode === 'advanced',
    setMode,
    toggle,
  };
}
