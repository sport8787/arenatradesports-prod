import { useEffect, useState, useCallback } from 'react';

export type TraderViewMode = 'simple' | 'advanced';

const STORAGE_KEY = 'traderSports:view_mode';
const EVT = 'traderSports:view_mode_changed';

function read(): TraderViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'advanced' ? 'advanced' : 'simple';
  } catch {
    return 'simple';
  }
}

/**
 * Modo de visualização da Arena Trader Sports.
 * - simple: apenas tabs (Sinais Aprovados / Todos / Próximos / Ao Vivo / Pré-Live / Finalizados) + cards.
 * - advanced: tudo (banca, posições ativas, chips de região/mercado/campeonato, modo foco, calibragem, simulado, aprovados AF, view toggle, action buttons).
 */
export function useTraderViewMode() {
  const [mode, setModeState] = useState<TraderViewMode>(() => read());

  useEffect(() => {
    const onChange = () => setModeState(read());
    window.addEventListener(EVT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(EVT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const setMode = useCallback((next: TraderViewMode) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
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
