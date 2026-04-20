import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PromoSlots {
  slots_remaining: number;
  slots_total: number;
  is_active: boolean;
  loading: boolean;
}

export function usePromoSlots(promoId = 'launch_2025') {
  const [state, setState] = useState<PromoSlots>({
    slots_remaining: 200,
    slots_total: 200,
    is_active: true,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const { data } = await supabase
        .from('promo_slots')
        .select('slots_remaining, slots_total, is_active')
        .eq('id', promoId)
        .maybeSingle();
      if (mounted && data) {
        setState({ ...data, loading: false });
      } else if (mounted) {
        setState((s) => ({ ...s, loading: false }));
      }
    };
    load();

    const channel = supabase
      .channel(`promo_slots_${promoId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'promo_slots', filter: `id=eq.${promoId}` },
        (payload) => {
          const row = payload.new as any;
          setState({
            slots_remaining: row.slots_remaining,
            slots_total: row.slots_total,
            is_active: row.is_active,
            loading: false,
          });
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [promoId]);

  const decrementSlot = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('decrement-promo-slot');
      if (error) throw error;
      if (data) {
        setState({
          slots_remaining: data.slots_remaining,
          slots_total: data.slots_total,
          is_active: data.is_active,
          loading: false,
        });
      }
    } catch (e) {
      console.error('decrementSlot error', e);
    }
  }, []);

  return { ...state, decrementSlot };
}
