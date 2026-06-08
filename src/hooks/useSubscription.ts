import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';
import { onRevalidate } from '@/utils/visibilityManager';

export type ArenaKey =
  | 'arena_live'
  | 'arena_punter'
  | 'multiplas'
  | 'banca_virtual'
  | 'banca_real';

export type PlanTier = 'promo' | 'iniciante' | 'profissional' | 'elite';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'trial' | 'starter' | 'basic' | 'base' | 'premium' | 'iniciante' | 'profissional' | 'elite';
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  is_active: boolean;
  allowed_arenas: ArenaKey[] | null;
  payment_provider: string | null;
  external_order_id: string | null;
  notes: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  chat_override_until: string | null;
  bc_multiplier: number | null;
  created_at: string;
  updated_at: string;
}

/** Mapeamento interno de plano DB → nome de exibição comercial */
export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  trial:        'Trial Gratuito',
  starter:      'Plano Promo',
  basic:        'Plano Básico',
  base:         'Plano Promo',
  premium:      'Plano Premium',
  iniciante:    'Plano Iniciante',
  profissional: 'Plano Profissional',
  elite:        'Plano Elite',
};

const PLAN_DEFAULT_ARENAS: Record<string, ArenaKey[]> = {
  trial:        ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
  starter:      ['arena_live', 'arena_punter'],
  basic:        ['arena_punter'],
  base:         ['arena_live', 'arena_punter'],
  premium:      ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
  iniciante:    ['arena_punter'],  // usuário escolhe; sobrescrito por allowed_arenas
  profissional: ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
  elite:        ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
};

export function useSubscription() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState(0);
  const lastRevalidateRef = useRef(0);

  const fetchSubscription = useCallback(async () => {
    // Enquanto o auth ainda está hidratando, NÃO marca loading=false:
    // isso evita uma janela onde subscription=null e loading=false simultaneamente,
    // o que faria RequireSubscription redirecionar pro /paywall mesmo para admins.
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return;
      }

      if (data) {
        const sub = data as unknown as Subscription;
        setSubscription(sub);

        if (sub.plan === 'trial' && sub.trial_ends_at) {
          const now = new Date();
          const endsAt = new Date(sub.trial_ends_at);
          const diffTime = endsAt.getTime() - now.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          setDaysLeft(Math.max(0, diffDays));
        } else if (sub.subscription_ends_at) {
          const now = new Date();
          const endsAt = new Date(sub.subscription_ends_at);
          const diffDays = Math.ceil((endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          setDaysLeft(Math.max(0, diffDays));
        } else {
          setDaysLeft(0);
        }
      }
    } catch (e) {
      console.error('fetchSubscription threw:', e);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Revalidação silenciosa quando a aba volta, mas só em intervalos longos.
  useEffect(() => {
    if (!user) return;
    lastRevalidateRef.current = Date.now();
    return onRevalidate(() => {
      if (Date.now() - lastRevalidateRef.current > 5 * 60 * 1000) {
        lastRevalidateRef.current = Date.now();
        fetchSubscription();
      }
    });
  }, [user, fetchSubscription]);

  // Realtime: se a subscription do usuário for atualizada (admin grant, webhook Kiwify), refaz fetch automaticamente.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user_subscription_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_subscriptions', filter: `user_id=eq.${user.id}` },
        () => fetchSubscription()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchSubscription]);

  const isTrialActive = subscription?.plan === 'trial' && daysLeft > 0;
  const isTrialExpired = subscription?.plan === 'trial' && daysLeft <= 0;
  const isPaidActive =
    (['starter', 'basic', 'base', 'premium', 'iniciante', 'profissional', 'elite'] as const)
      .includes(subscription?.plan as any) &&
    !!subscription?.is_active &&
    (!subscription?.subscription_ends_at || new Date(subscription.subscription_ends_at) > new Date());

  // Plano Promo (starter/base) = pago, mas sem resgate de prêmios na Liga Mycroft
  const isPromoOnly = isPaidActive && (subscription?.plan === 'starter' || subscription?.plan === 'base');

  // Pode resgatar prêmios: assinante pago que NÃO é plano promo
  const canRedeemPrizes = !!(isAdmin || (isPaidActive && !isPromoOnly));

  // Multiplicador de BC: Elite → 1.3×; demais → 1.0×
  const bcMultiplier: number = subscription?.bc_multiplier ?? (subscription?.plan === 'elite' ? 1.3 : 1.0);

  // Nome de exibição do plano atual
  const planDisplayName: string = subscription
    ? (PLAN_DISPLAY_NAMES[subscription.plan] ?? subscription.plan)
    : (isAdmin ? 'Admin' : '—');

  // Admin = acesso total. Trial ativo = acesso total. Pago ativo = acesso total ao app (mas filtrado por arena).
  const hasAccess = !!(isAdmin || isTrialActive || isPaidActive);

  const allowedArenas: ArenaKey[] = (() => {
    if (isAdmin) return ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'];
    if (!subscription) return [];
    if (subscription.allowed_arenas && subscription.allowed_arenas.length > 0) {
      return subscription.allowed_arenas;
    }
    return PLAN_DEFAULT_ARENAS[subscription.plan] || [];
  })();

  const hasArena = (arena: ArenaKey) => {
    if (isAdmin) return true;
    if (!hasAccess) return false;
    return allowedArenas.includes(arena);
  };

  const chatOverrideActive = !!(
    subscription?.chat_override_until &&
    new Date(subscription.chat_override_until) > new Date()
  );

  return {
    subscription,
    loading: loading || adminLoading || authLoading,
    daysLeft,
    isTrialActive,
    isTrialExpired,
    isPaid: isPaidActive,
    isPromoOnly,
    canRedeemPrizes,
    bcMultiplier,
    planDisplayName,
    hasAccess,
    allowedArenas,
    hasArena,
    chatOverrideActive,
    refetch: fetchSubscription,
  };
}
