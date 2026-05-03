import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ActivationKey =
  | 'saw_first_signal'
  | 'enabled_push'
  | 'placed_first_virtual_bet'
  | 'configured_bankroll';

export interface ActivationState {
  saw_first_signal: boolean;
  enabled_push: boolean;
  placed_first_virtual_bet: boolean;
  configured_bankroll: boolean;
}

const DEFAULT: ActivationState = {
  saw_first_signal: false,
  enabled_push: false,
  placed_first_virtual_bet: false,
  configured_bankroll: false,
};

const LS_KEY = 'activation_checklist_cache_v1';

/**
 * Hook do checklist de ativação (4 passos para o usuário voltar).
 * Persiste em DB + cache em localStorage para resposta instantânea.
 */
export function useActivationChecklist() {
  const { user } = useAuth();
  const [state, setState] = useState<ActivationState>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });
  const [loading, setLoading] = useState(true);

  // Carrega do DB ao logar
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_activation_checklist')
        .select('saw_first_signal,enabled_push,placed_first_virtual_bet,configured_bankroll')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        const next: ActivationState = {
          saw_first_signal: !!data.saw_first_signal,
          enabled_push: !!data.enabled_push,
          placed_first_virtual_bet: !!data.placed_first_virtual_bet,
          configured_bankroll: !!data.configured_bankroll,
        };
        setState(next);
        try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const markComplete = useCallback(async (key: ActivationKey) => {
    if (state[key]) return;
    const next = { ...state, [key]: true };
    setState(next);
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
    if (!user) return;
    await supabase
      .from('user_activation_checklist')
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() });
  }, [state, user]);

  const completedCount = Object.values(state).filter(Boolean).length;
  const totalCount = 4;
  const isAllComplete = completedCount === totalCount;

  return { state, loading, markComplete, completedCount, totalCount, isAllComplete };
}
