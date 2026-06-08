/**
 * Preferências de alarme sonoro — persiste no localStorage.
 * Sem dependência de DB: é configuração de dispositivo, não de conta.
 *
 * Chaves:
 *   mycroft.sound.deterministico  — alarme para Método Determinístico
 *   mycroft.sound.ia              — alarme para Sinais IA
 */
import { useState, useCallback } from 'react';

const KEYS = {
  deterministico: 'mycroft.sound.deterministico',
  ia: 'mycroft.sound.ia',
} as const;

function read(key: string, defaultValue = true): boolean {
  if (typeof window === 'undefined') return defaultValue;
  const raw = window.localStorage.getItem(key);
  return raw === null ? defaultValue : raw === 'true';
}

function write(key: string, value: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, String(value));
}

export interface AlertSoundPrefs {
  deterministico: boolean;
  ia: boolean;
  setDeterministico: (v: boolean) => void;
  setIa: (v: boolean) => void;
}

export function useAlertSoundPrefs(): AlertSoundPrefs {
  const [deterministico, setDeterministicoState] = useState(() => read(KEYS.deterministico, true));
  const [ia, setIaState] = useState(() => read(KEYS.ia, true));

  const setDeterministico = useCallback((v: boolean) => {
    write(KEYS.deterministico, v);
    setDeterministicoState(v);
  }, []);

  const setIa = useCallback((v: boolean) => {
    write(KEYS.ia, v);
    setIaState(v);
  }, []);

  return { deterministico, ia, setDeterministico, setIa };
}
