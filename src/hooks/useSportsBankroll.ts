import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface SportsBankroll {
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

export function useSportsBankroll() {
  const { user } = useAuth();
  const [bankroll, setBankroll] = useState<SportsBankroll | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchBankroll() {
      const { data, error } = await supabase
        .from('sports_bankroll' as any)
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching sports bankroll:', error);
        setLoading(false);
        return;
      }

      if (!data) {
        const { data: newBankroll, error: insertErr } = await supabase
          .from('sports_bankroll' as any)
          .insert({ user_id: user!.id })
          .select()
          .single();

        if (!insertErr && newBankroll) {
          setBankroll(newBankroll as unknown as SportsBankroll);
        }
      } else {
        setBankroll(data as unknown as SportsBankroll);
      }

      setLoading(false);
    }

    fetchBankroll();

    const channel = supabase
      .channel(`sports_bankroll_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sports_bankroll',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        setBankroll(payload.new as unknown as SportsBankroll);
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

    const stake = Math.round(bankroll.balance * 0.05 * 100) / 100;

    if (stake > bankroll.balance || stake <= 0) {
      return { success: false, error: 'Saldo insuficiente' };
    }

    const matchName = analysis.home_team && analysis.away_team
      ? `${analysis.home_team} vs ${analysis.away_team}`
      : analysis.match_id;

    console.log('[SportsBankroll] Inserting bet:', { user_id: user.id, signal_id: analysis.id, match_id: analysis.match_id, market: analysis.market, odd: analysis.odd, stake });

    const withTimeout = async <T,>(promise: PromiseLike<T>, ms = 12000): Promise<T> => {
      return await Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout na comunicação com o servidor')), ms)),
      ]);
    };

    const betResponse = await withTimeout(
      Promise.resolve(
        supabase
          .from('virtual_bets')
          .insert({
            user_id: user.id,
            signal_id: analysis.id,
            match_id: String(analysis.match_id),
            match_name: matchName,
            market: analysis.market,
            odd: Number(analysis.odd),
            stake,
            status: 'pending',
          })
          .select()
          .single()
      )
    );

    const { data: bet, error: betError } = betResponse;

    if (betError) {
      console.error('[SportsBankroll] Insert error:', betError);
      return { success: false, error: betError.message };
    }

    const updateResponse = await withTimeout(
      Promise.resolve(
        supabase
          .from('sports_bankroll' as any)
          .update({
            balance: bankroll.balance - stake,
            total_staked: bankroll.total_staked + stake,
            total_bets: bankroll.total_bets + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
      )
    );

    const { error: updateError } = updateResponse;

    if (updateError) {
      console.error('[SportsBankroll] Bankroll update error:', updateError);
      if (bet?.id) {
        await supabase.from('virtual_bets').delete().eq('id', bet.id);
      }
      return { success: false, error: updateError.message };
    }

    setBankroll(prev => prev ? {
      ...prev,
      balance: prev.balance - stake,
      total_staked: prev.total_staked + stake,
      total_bets: prev.total_bets + 1,
    } : prev);

    return { success: true, bet, stake };
  }, [bankroll, user]);

  const settleBets = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('settle-bets');
      if (error) throw error;
      return { success: true, data };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }, []);

  const updateInitialBalance = useCallback(async (newBalance: number) => {
    if (!user) return { success: false, error: 'Usuário não autenticado' };
    if (newBalance < 100) return { success: false, error: 'Valor mínimo: R$ 100' };

    const { error } = await supabase
      .from('sports_bankroll' as any)
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

  const recommendedStake = bankroll ? Math.round(bankroll.balance * 0.05 * 100) / 100 : 0;

  return {
    bankroll,
    loading,
    placeBet,
    settleBets,
    recommendedStake,
    updateInitialBalance,
  };
}
