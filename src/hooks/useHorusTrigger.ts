import { useEffect, useRef } from 'react';
import { horusMentor } from '@/services/horusMentor';

/**
 * Dispara uma frase do Hórus quando o componente monta (primeira vez na sessão).
 *
 * @param triggerKey chave do gatilho em `horus_triggers`
 * @param opts.onceForUser true para onboarding (nunca repete para esse usuário)
 * @param opts.enabled false desliga o gatilho (útil para condições dinâmicas)
 * @param opts.delayMs aguarda N ms após montagem antes de falar (default 600)
 */
export function useHorusTrigger(
  triggerKey: string,
  opts: { onceForUser?: boolean; enabled?: boolean; delayMs?: number } = {}
) {
  const { onceForUser = true, enabled = true, delayMs = 600 } = opts;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled || firedRef.current) return;
    firedRef.current = true;
    const t = setTimeout(() => {
      horusMentor.speak(triggerKey, { onceForUser }).catch(() => {});
    }, delayMs);
    return () => clearTimeout(t);
  }, [triggerKey, enabled, onceForUser, delayMs]);
}

/**
 * Versão imperativa: retorna uma função para disparar manualmente.
 */
export function useHorusSpeak() {
  return (triggerKey: string, opts?: { onceForUser?: boolean }) =>
    horusMentor.speak(triggerKey, opts);
}
