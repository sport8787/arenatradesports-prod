/**
 * Toca sinal sonoro + notificação push quando um novo sinal Copa é aprovado
 * via INSERT/UPDATE em `punter_copa_signals` com status = 'APROVADO'.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playCriticalAlert } from '@/lib/criticalAlertSound';

const MIN_INTERVAL_MS = 6_000;

export function useCopaSignalSound(enabled: boolean = true) {
  const lastPlayedRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const tryPlay = (id: string, status: string, home: string, away: string, createdAt?: string | null) => {
      if (status !== 'APROVADO') return;
      if (seenIdsRef.current.has(id)) return;
      seenIdsRef.current.add(id);

      if (createdAt) {
        const created = new Date(createdAt).getTime();
        if (Number.isFinite(created) && created < mountedAtRef.current - 60_000) return;
      }

      const now = Date.now();
      if (now - lastPlayedRef.current < MIN_INTERVAL_MS) return;
      lastPlayedRef.current = now;

      try {
        playCriticalAlert();
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🏆 Entrada Copa Aprovada', {
            body: `Mycroft aprovou ${home} vs ${away}. Abra a página Copa para ver.`,
            tag: `copa-signal-${id}`,
            icon: '/favicon.ico',
            silent: false,
            // @ts-ignore
            vibrate: [180, 80, 180, 80, 250],
          });
        }
      } catch (err) {
        console.warn('[useCopaSignalSound] erro ao tocar alerta:', err);
      }
    };

    const channel = supabase
      .channel('copa-aprovado-sound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'punter_copa_signals' },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id) return;
          tryPlay(row.id, row.status, row.home ?? '?', row.away ?? '?', row.created_at);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'punter_copa_signals' },
        (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (!row?.id) return;
          if (old?.status === row.status) return;
          tryPlay(row.id, row.status, row.home ?? '?', row.away ?? '?', row.created_at);
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [enabled]);
}
