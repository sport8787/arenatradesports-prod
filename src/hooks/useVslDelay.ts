import { useEffect, useState, useRef } from 'react';
import { track } from '@/lib/analytics';

/**
 * VSL com delay: libera CTAs/conteúdo somente após o vídeo atingir
 * `delaySeconds` de tempo assistido (não tempo real de página).
 *
 * Lê currentTime via:
 *   1) instância smartplayer (window.smartplayer.instances[i].video.currentTime)
 *   2) fallback: <video> dentro do <vturb-smartplayer id="vid-...">
 *
 * Persiste o unlock em sessionStorage para sobreviver a refreshes da mesma sessão.
 */
export function useVslDelay(playerId: string, delaySeconds: number, enabled: boolean) {
  const storageKey = `vsl_unlocked_${playerId}_${delaySeconds}`;
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try { return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(storageKey) === '1'; } catch { return false; }
  });
  const [currentTime, setCurrentTime] = useState(0);
  const trackedMilestones = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!enabled || unlocked) return;
    let cancelled = false;

    const readCurrentTime = (): number => {
      try {
        const sp: any = (window as any).smartplayer;
        const inst = sp?.instances?.find((i: any) => i?.options?.id === playerId) || sp?.instances?.[0];
        const t = Number(
          inst?.video?.currentTime ??
          inst?.player?.currentTime ??
          (typeof inst?.currentTime === 'function' ? inst.currentTime() : inst?.currentTime) ??
          0
        );
        if (t > 0) return t;
      } catch { /* noop */ }
      // Fallback: procurar qualquer <video> dentro do player
      const el = document.querySelector(
        `vturb-smartplayer[id="vid-${playerId}"] video, #vid-${playerId} video`
      ) as HTMLVideoElement | null;
      return el?.currentTime || 0;
    };

    const interval = window.setInterval(() => {
      if (cancelled) return;
      const t = readCurrentTime();
      if (t > 0) setCurrentTime(t);

      // Milestones de tempo absoluto (úteis para análise de funil VSL)
      [60, 180, 300, 480].forEach((m) => {
        if (t >= m && !trackedMilestones.current.has(m)) {
          trackedMilestones.current.add(m);
          track.videoEvent(`vsl_time_${m}s`, { player_id: playerId, current_time: Math.round(t) });
        }
      });

      if (t >= delaySeconds) {
        try { sessionStorage.setItem(storageKey, '1'); } catch { /* noop */ }
        setUnlocked(true);
        track.videoEvent('vsl_pitch_revealed', { player_id: playerId, delay_seconds: delaySeconds });
        cancelled = true;
        window.clearInterval(interval);
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [enabled, unlocked, delaySeconds, playerId, storageKey]);

  return { unlocked, currentTime, delaySeconds };
}
