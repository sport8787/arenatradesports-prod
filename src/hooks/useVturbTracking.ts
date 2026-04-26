import { useEffect } from 'react';
import { track } from '@/lib/analytics';

/**
 * Escuta eventos do player VTurb (smartplayer) e envia ao PostHog.
 * VTurb expõe window.smartplayer com .on('play' | 'progress' | 'end' | 'pause').
 * Também escuta um fallback via CustomEvents (`vturb-*`) caso a API esteja indisponível.
 *
 * Dispara: play, progress_25, progress_50, progress_75, complete, pause.
 * Cada milestone só dispara uma vez por sessão de página.
 */
export function useVturbTracking(playerId: string, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const fired = new Set<string>();
    const fire = (event: string, extra?: Record<string, any>) => {
      if (fired.has(event)) return;
      fired.add(event);
      track.videoEvent(event, { player_id: playerId, ...extra });
    };

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const tryAttach = () => {
      if (cancelled) return;
      // VTurb expõe window.smartplayer (objeto global) após o script carregar.
      const sp: any = (window as any).smartplayer;
      const instances: any[] = sp?.instances || [];
      const instance = instances.find((i) => i?.options?.id === playerId) || instances[0];

      if (!instance || typeof instance.on !== 'function') {
        // Tenta novamente em 500ms (player carrega async)
        const t = setTimeout(tryAttach, 500);
        cleanup = () => clearTimeout(t);
        return;
      }

      const handlers: Array<[string, (...args: any[]) => void]> = [
        ['play', () => fire('play')],
        ['pause', () => fire('pause')],
        ['end', () => fire('complete')],
        [
          'progress',
          (data: any) => {
            const pct = Number(data?.percentage ?? data?.percent ?? 0);
            if (pct >= 25 && !fired.has('progress_25')) fire('progress_25', { percentage: pct });
            if (pct >= 50 && !fired.has('progress_50')) fire('progress_50', { percentage: pct });
            if (pct >= 75 && !fired.has('progress_75')) fire('progress_75', { percentage: pct });
          },
        ],
      ];

      handlers.forEach(([evt, fn]) => instance.on(evt, fn));
      cleanup = () => {
        handlers.forEach(([evt, fn]) => {
          try { instance.off?.(evt, fn); } catch { /* noop */ }
        });
      };
    };

    tryAttach();
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [enabled, playerId]);
}
