import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface EconomyState {
  ntBalance: number;
  bcBalance: number;
  loading: boolean;
}

export interface GamePhaseConfig {
  phase: 1 | 2 | 3;
  rounds: 5 | 10 | 15;
  ntCost: number;
  bcReward: number;
  bonusReward: number;
}

export const GAME_PHASES: GamePhaseConfig[] = [
  { phase: 1, rounds: 5, ntCost: 0, bcReward: 50, bonusReward: 0 },
  { phase: 2, rounds: 10, ntCost: 50, bcReward: 200, bonusReward: 100 },
  { phase: 3, rounds: 15, ntCost: 100, bcReward: 1000, bonusReward: 0 },
];

export function useEconomy() {
  const { profile, isAuthenticated } = useAuth();
  const [economy, setEconomy] = useState<EconomyState>({
    ntBalance: 500,
    bcBalance: 0,
    loading: true,
  });

  // Fetch balances from profile
  useEffect(() => {
    if (profile) {
      // Use type assertion since these columns are new
      const profileData = profile as typeof profile & { nt_balance?: number; bc_balance?: number };
      setEconomy({
        ntBalance: profileData.nt_balance ?? 500,
        bcBalance: profileData.bc_balance ?? 0,
        loading: false,
      });
    } else {
      setEconomy(prev => ({ ...prev, loading: false }));
    }
  }, [profile]);

  // Spend NT tokens (returns true if successful)
  const spendNT = useCallback(async (amount: number): Promise<boolean> => {
    if (!isAuthenticated || !profile) {
      // Guest mode - just update local state
      if (economy.ntBalance >= amount) {
        setEconomy(prev => ({ ...prev, ntBalance: prev.ntBalance - amount }));
        return true;
      }
      return false;
    }

    try {
      const { data, error } = await supabase.rpc('spend_nt_balance', {
        p_user_id: profile.user_id,
        p_amount: amount,
      });

      if (error) throw error;

      if (data === true) {
        setEconomy(prev => ({ ...prev, ntBalance: prev.ntBalance - amount }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error spending NT:', error);
      return false;
    }
  }, [isAuthenticated, profile, economy.ntBalance]);

  // Add BC tokens
  const addBC = useCallback(async (amount: number): Promise<boolean> => {
    if (!isAuthenticated || !profile) {
      // Guest mode - just update local state
      setEconomy(prev => ({ ...prev, bcBalance: prev.bcBalance + amount }));
      return true;
    }

    try {
      const { error } = await supabase.rpc('increment_bc_balance', {
        p_user_id: profile.user_id,
        p_amount: amount,
      });

      if (error) throw error;

      setEconomy(prev => ({ ...prev, bcBalance: prev.bcBalance + amount }));
      return true;
    } catch (error) {
      console.error('Error adding BC:', error);
      return false;
    }
  }, [isAuthenticated, profile]);

  // Add NT tokens (for bonuses)
  const addNT = useCallback(async (amount: number): Promise<boolean> => {
    if (!isAuthenticated || !profile) {
      setEconomy(prev => ({ ...prev, ntBalance: prev.ntBalance + amount }));
      return true;
    }

    try {
      const { error } = await supabase.rpc('increment_nt_balance', {
        p_user_id: profile.user_id,
        p_amount: amount,
      });

      if (error) throw error;

      setEconomy(prev => ({ ...prev, ntBalance: prev.ntBalance + amount }));
      return true;
    } catch (error) {
      console.error('Error adding NT:', error);
      return false;
    }
  }, [isAuthenticated, profile]);

  // Check if player can afford a phase
  const canAffordPhase = useCallback((phase: 1 | 2 | 3): boolean => {
    const config = GAME_PHASES.find(p => p.phase === phase);
    if (!config) return false;
    return economy.ntBalance >= config.ntCost;
  }, [economy.ntBalance]);

  // Get phase config
  const getPhaseConfig = useCallback((phase: 1 | 2 | 3): GamePhaseConfig | undefined => {
    return GAME_PHASES.find(p => p.phase === phase);
  }, []);

  // Refresh balances from database
  const refreshBalances = useCallback(async () => {
    if (!isAuthenticated || !profile) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('nt_balance, bc_balance')
        .eq('user_id', profile.user_id)
        .single();

      if (error) throw error;

      if (data) {
        setEconomy(prev => ({
          ...prev,
          ntBalance: (data as { nt_balance: number; bc_balance: number }).nt_balance,
          bcBalance: (data as { nt_balance: number; bc_balance: number }).bc_balance,
        }));
      }
    } catch (error) {
      console.error('Error refreshing balances:', error);
    }
  }, [isAuthenticated, profile]);

  return {
    ...economy,
    spendNT,
    addBC,
    addNT,
    canAffordPhase,
    getPhaseConfig,
    refreshBalances,
    GAME_PHASES,
  };
}
