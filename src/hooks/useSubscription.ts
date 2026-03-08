import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/hooks/useAdmin';

export interface Subscription {
  id: string;
  user_id: string;
  plan: 'trial' | 'base' | 'premium';
  trial_started_at: string | null;
  trial_ends_at: string | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  is_active: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState(0);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching subscription:', error);
      setLoading(false);
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
      } else {
        setDaysLeft(0);
      }
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isTrialActive = subscription?.plan === 'trial' && daysLeft > 0;
  const isTrialExpired = subscription?.plan === 'trial' && daysLeft <= 0;
  const isPaid = subscription?.plan === 'base' || subscription?.plan === 'premium';
  // Admins have lifetime access; others check subscription
  const hasAccess = isAdmin || isPaid || isTrialActive;

  return {
    subscription,
    loading,
    daysLeft,
    isTrialActive,
    isTrialExpired,
    isPaid,
    hasAccess,
    refetch: fetchSubscription,
  };
}
