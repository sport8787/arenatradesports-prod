import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Bankroll {
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

export function useBankroll() {
  const { user } = useAuth();
  const [bankroll, setBankroll] = useState<Bankroll | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchBankroll() {
      const { data, error } = await supabase
        .from('user_bankroll')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching bankroll:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        // Auto-create bankroll if trigger didn't fire (existing users)
        const { data: newBankroll, error: insertErr } = await supabase
          .from('user_bankroll')
          .insert({ user_id: user!.id })
          .select()
          .single();

        if (!insertErr && newBankroll) {
          setBankroll(newBankroll as unknown as Bankroll);
        }
      } else {
        setBankroll(data as unknown as Bankroll);
      }

      setLoading(false);
    }

    fetchBankroll();

    // Real-time updates
    const channel = supabase
      .channel(`bankroll_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_bankroll',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setBankroll(payload.new as unknown as Bankroll);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const placeBet = useCallback(async (analysis: {
    id: string;
    match_id: string;
    market: string;
    odd: number;
    home_team?: string;
    away_team?: string;
  }) => {
    if (!bankroll || !user) return { success: false, error: 'Bankroll não carregada' };

    const stake = Math.round(bankroll.balance * 0.05 * 100) / 100; // 5% da banca

    if (stake > bankroll.balance || stake <= 0) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    const matchName = analysis.home_team && analysis.away_team
      ? `${analysis.home_team} vs ${analysis.away_team}`
      : analysis.match_id;

    // Insert bet
    const { data: bet, error: betError } = await supabase
      .from('virtual_bets')
      .insert({
        user_id: user.id,
        signal_id: analysis.id,
        match_id: analysis.match_id,
        match_name: matchName,
        market: analysis.market,
        odd: analysis.odd,
        stake: stake,
        status: 'pending',
      })
      .select()
      .single();

    if (betError) {
      return { success: false, error: betError.message };
    }

    // Update bankroll
    const { error: updateError } = await supabase
      .from('user_bankroll')
      .update({
        balance: bankroll.balance - stake,
        total_staked: bankroll.total_staked + stake,
        total_bets: bankroll.total_bets + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Update local state immediately
    setBankroll(prev => prev ? {
      ...prev,
      balance: prev.balance - stake,
      total_staked: prev.total_staked + stake,
      total_bets: prev.total_bets + 1,
    } : prev);

    return { success: true, bet, stake };
  }, [bankroll, user]);

  const dismissBet = useCallback(async () => {
    return { success: true };
  }, []);

  const settleBets = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('settle-bets');
      if (error) throw error;
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, []);

  const recommendedStake = bankroll ? Math.round(bankroll.balance * 0.05 * 100) / 100 : 0;

  return {
    bankroll,
    loading,
    placeBet,
    dismissBet,
    settleBets,
    recommendedStake,
  };
}
