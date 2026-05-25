/**
 * Toca um sinal sonoro sempre que uma nova análise APROVADA / APROVADA_SITUACIONAL / LABAREDA
 * é inserida em mycroft_analyses (Arena Trader Sports — ao vivo).
 *
 * Estratégia:
 *  - Subscribe Supabase Realtime na tabela `mycroft_analyses` (INSERT + UPDATE para verdict).
 *  - Throttle de 6s para evitar rajadas quando vários sinais entram em sequência.
 *  - Ignora a primeira "carga" de eventos no mount (apenas sinais novos a partir de agora).
 *  - Usa o oscilador Web Audio (playCriticalAlert) — não depende de assets ou ElevenLabs.
 */
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playCriticalAlert } from '@/lib/criticalAlertSound';
import { horusMentor } from '@/services/horusMentor';


const APPROVED_VERDICTS = new Set([
  'APROVADO',
  'APROVADO_SITUACIONAL',
  'LABAREDA',
]);

const MIN_INTERVAL_MS = 6_000;

export function useApprovedSignalSound(enabled: boolean = true) {
  const lastPlayedRef = useRef<number>(0);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const mountedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const tryPlay = (id: string, verdict: string, createdAt?: string | null) => {
      if (!APPROVED_VERDICTS.has(verdict)) return;
      if (seenIdsRef.current.has(id)) return;
      seenIdsRef.current.add(id);

      // Não toca para sinais antigos (criados antes do mount, ex.: backfill via UPDATE)
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
        playCriticalAlert();
        // Notificação visual leve (se permitida)
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification('🎯 Sinal Aprovado', {
            body: 'Mycroft aprovou um novo sinal ao vivo.',
            tag: `mycroft-aprovado-${id}`,
            silent: false,
          });
        }
      } catch (err) {
        console.warn('[useApprovedSignalSound] erro ao tocar alerta:', err);
      }
    };

    const channel = supabase
      .channel('mycroft-aprovado-sound')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mycroft_analyses' },
        (payload) => {
          const row = payload.new as any;
          if (!row?.id || !row?.verdict) return;
          tryPlay(row.id, row.verdict, row.created_at);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mycroft_analyses' },
        (payload) => {
          const row = payload.new as any;
          const old = payload.old as any;
          if (!row?.id || !row?.verdict) return;
          // Só toca quando o verdict transiciona PARA aprovado
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
