import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';

export type ArenaKey =
  | 'arena_live'
  | 'arena_punter'
  | 'multiplas'
  | 'banca_virtual'
  | 'banca_real';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'trial' | 'starter' | 'base' | 'premium';
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
  created_at: string;
  updated_at: string;
}

const PLAN_DEFAULT_ARENAS: Record<string, ArenaKey[]> = {
  trial:   ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
  starter: ['arena_live'],
  base:    ['arena_live', 'arena_punter'],
  premium: ['arena_live', 'arena_punter', 'multiplas', 'banca_virtual', 'banca_real'],
};

export function useSubscription() {
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState(0);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

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
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isTrialActive = subscription?.plan === 'trial' && daysLeft > 0;
  const isTrialExpired = subscription?.plan === 'trial' && daysLeft <= 0;
  const isPaidActive =
    (subscription?.plan === 'starter' || subscription?.plan === 'base' || subscription?.plan === 'premium') &&
    !!subscription?.is_active &&
    (!subscription?.subscription_ends_at || new Date(subscription.subscription_ends_at) > new Date());

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

  return {
    subscription,
    loading: loading || adminLoading,
    daysLeft,
    isTrialActive,
    isTrialExpired,
    isPaid: isPaidActive,
    hasAccess,
    allowedArenas,
    hasArena,
    refetch: fetchSubscription,
  };
}
