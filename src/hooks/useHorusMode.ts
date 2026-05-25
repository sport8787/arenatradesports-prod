import { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import { horusMentor } from '@/services/horusMentor';
import { useAuth } from '@/hooks/useAuth';
import type { HorusMode } from '@/data/horusTriggers';

/**
 * Lê e atualiza o modo do Hórus do usuário logado.
 * Também hidrata o serviço na primeira montagem.
 */
export function useHorusMode() {
  const { user } = useAuth();
  const [, setTick] = useState(0);

  useEffect(() => {
    horusMentor.hydrate(user?.id ?? null);
    const unsub = horusMentor.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, [user?.id]);

  const mode = horusMentor.getMode();
  const sessionMuted = horusMentor.isSessionMuted();

  const setMode = useCallback(async (m: HorusMode) => {
    await horusMentor.setMode(m);
  }, []);

  const setSessionMuted = useCallback((muted: boolean) => {
    horusMentor.setSessionMuted(muted);
  }, []);

  return { mode, setMode, sessionMuted, setSessionMuted };
}

/**
 * Hook auxiliar para uso em useSyncExternalStore (apenas mute).
 */
export function useHorusSessionMute() {
  return useSyncExternalStore(
    (cb) => horusMentor.subscribe(cb),
    () => horusMentor.isSessionMuted(),
    () => false
  );
}
