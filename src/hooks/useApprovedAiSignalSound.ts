/**
 * Toca um sinal sonoro SCI-FI (arpejo Cmaj7) sempre que uma nova análise
 * APROVADA / APROVADA_SITUACIONAL / LABAREDA é inserida em
 * `mycroft_analyses_shadow_ai` (Trader Sports — aba Sinais Aprovados IA).
 *
 * Som distinto do alerta determinístico (`useApprovedSignalSound`) para o
 * usuário identificar de ouvido qual motor aprovou.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playAiSignalAlert } from '@/lib/criticalAlertSound';

const APPROVED_VERDICTS = new Set([
  'APROVADO',
  'APROVADO_SITUACIONAL',
  'LABAREDA',
]);

const MIN_INTERVAL_MS = 6_000;

export function useApprovedAiSignalSound(enabled: boolean = true) {
  const lastPlayedRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const tryPlay = (id: string, verdict: string, createdAt?: string | null) => {
      if (!APPROVED_VERDICTS.has(verdict)) return;
      if (seenIdsRef.current.has(id)) return;
      seenIdsRef.current.add(id);

      // Ignora backfill: sinais criados antes do mount
      if (createdAt) {
        const created = new Date(createdAt).getTime();
        if (Number.isFinite(created) && created < mountedAtRef.current - 60_000) {
          return;
        }
      }

      const now = Date.now();
      if (now - lastPlayedRef.current < MIN_INTERVAL_MS) return;
      lastPlayedRef.current = now;

      try {
        playAiSignalAlert();
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🤖 Sinal IA Aprovado', {
            body: 'Mycroft aprovou um novo sinal ao vivo.',
            tag: `mycroft-ia-aprovado-${id}`,
            silent: false,
          });
        }
      } catch (err) {
        console.warn('[useApprovedAiSignalSound] erro ao tocar alerta:', err);
      }
    };

    const channel = supabase
      .channel('mycroft-shadow-ai-aprovado-sound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mycroft_analyses_shadow_ai' },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id || !row?.verdict) return;
          tryPlay(row.id, row.verdict, row.created_at);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mycroft_analyses_shadow_ai' },
        (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (!row?.id || !row?.verdict) return;
          if (old?.verdict === row.verdict) return;
          tryPlay(row.id, row.verdict, row.created_at);
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [enabled]);
}
