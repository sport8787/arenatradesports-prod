import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

/**
 * Escuta INSERTs em bc_rewards_log do usuário atual e dispara um toast
 * "+X BC creditados" com CTA para a Loja BC. Usar uma vez no boot do app.
 */
export function useBCRewardToasts() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`bc-rewards-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bc_rewards_log',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as any;
          const total = Number(row?.total_bc || 0);
          if (total <= 0) return;
          toast.success(`🪙 +${total.toLocaleString('pt-BR')} BC creditados!`, {
            description: row?.motivo || 'Aposta virtual vencedora',
            duration: 7000,
            action: {
              label: 'Loja BC',
              onClick: () => (window.location.href = '/loja-bc'),
            },
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
