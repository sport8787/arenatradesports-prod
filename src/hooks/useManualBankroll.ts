import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ManualBankroll {
  id: string;
  user_id: string;
  balance: number;
  initial_balance: number;
  total_staked: number;
  total_profit: number;
  total_bets: number;
  green_bets: number;
  red_bets: number;
  win_rate: number;
  created_at: string;
  updated_at: string;
}

export function useManualBankroll() {
  const { user } = useAuth();
  const [bankroll, setBankroll] = useState<ManualBankroll | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchBankroll() {
      const { data, error } = await supabase
        .from('manual_bankroll' as any)
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching manual bankroll:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        const { data: newBankroll, error: insertErr } = await supabase
          .from('manual_bankroll' as any)
          .insert({ user_id: user!.id })
          .select()
          .single();

        if (!insertErr && newBankroll) {
          setBankroll(newBankroll as unknown as ManualBankroll);
        }
      } else {
        setBankroll(data as unknown as ManualBankroll);
      }

      setLoading(false);
    }

    fetchBankroll();

    const channel = supabase
      .channel(`manual_bankroll_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'manual_bankroll',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setBankroll(payload.new as unknown as ManualBankroll);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const placeBet = useCallback(async (params: {
    match_id: string;
    match_name: string;
    market: string;
    odd: number;
    stake: number;
    thesis?: string;
    commence_time?: string;
  }) => {
    if (!bankroll || !user) return { success: false, error: 'Bankroll não carregada' };

    if (params.stake > bankroll.balance || params.stake <= 0) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    const { error: betError } = await supabase
      .from('virtual_bets_manual' as any)
      .insert({
        user_id: user.id,
        match_id: params.match_id,
        match_name: params.match_name,
        market: params.market,
        odd: params.odd,
        stake: params.stake,
        status: 'pending',
        thesis: params.thesis || null,
        commence_time: params.commence_time || null,
      });

    if (betError) return { success: false, error: betError.message };

    // Sync to bets_history with source='user' for Self Learning Engine
    await supabase
      .from('bets_history')
      .insert({
        user_id: user.id,
        match_id: params.match_id,
        market: params.market,
        odd: params.odd,
        stake: params.stake,
        stake_percentage: bankroll.balance > 0 ? (params.stake / bankroll.balance) * 100 : 0,
        source: 'user',
        home_team: params.match_name?.split(' vs ')?.[0] || null,
        away_team: params.match_name?.split(' vs ')?.[1] || null,
      }).then(({ error: histErr }) => {
        if (histErr) console.warn('[ManualBankroll] bets_history sync error:', histErr.message);
      });

    const { data: deducted, error: updateError } = await supabase
      .rpc('deduct_manual_bankroll', {
        p_user_id: user.id,
        p_amount: params.stake,
      });

    if (updateError) return { success: false, error: updateError.message };
    if (!deducted) return { success: false, error: 'Saldo insuficiente' };

    setBankroll(prev => prev ? {
      ...prev,
      balance: prev.balance - params.stake,
      total_staked: prev.total_staked + params.stake,
      total_bets: prev.total_bets + 1,
    } : prev);

    return { success: true, stake: params.stake };
  }, [bankroll, user]);

  const updateInitialBalance = useCallback(async (newBalance: number) => {
    if (!user) return { success: false, error: 'Usuário não autenticado' };
    if (newBalance < 100) return { success: false, error: 'Valor mínimo: R$ 100' };

    const { error } = await supabase
      .from('manual_bankroll' as any)
      .update({
        initial_balance: newBalance,
        balance: newBalance,
        total_staked: 0,
        total_profit: 0,
        total_bets: 0,
        green_bets: 0,
        red_bets: 0,
        win_rate: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) return { success: false, error: error.message };

    setBankroll(prev => prev ? {
      ...prev,
      initial_balance: newBalance,
      balance: newBalance,
      total_staked: 0,
      total_profit: 0,
      total_bets: 0,
      green_bets: 0,
      red_bets: 0,
      win_rate: 0,
    } : prev);

    return { success: true };
  }, [user]);

  return {
    bankroll,
    loading,
    placeBet,
    updateInitialBalance,
  };
}
