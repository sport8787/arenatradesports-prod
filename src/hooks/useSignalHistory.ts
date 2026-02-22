import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserAction {
  id: string;
  user_id: string;
  signal_id: string | null;
  analysis_id: string | null;
  action: string;
  stake_amount: number | null;
  result: string | null;
  profit_loss: number | null;
  created_at: string;
  analysis?: {
    id: string;
    match_id: string;
    verdict: string;
    market: string;
    odd: number;
    confidence: number;
    thesis: string;
    alerts: string[];
  } | null;
}

export interface SignalStats {
  total: number;
  green: number;
  red: number;
  winRate: number;
  totalPL: number;
}

export function useSignalHistory() {
  const { user } = useAuth();
  const [actions, setActions] = useState<UserAction[]>([]);
  const [stats, setStats] = useState<SignalStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_actions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
      setLoading(false);
      return;
    }

    // Fetch associated analyses
    const actionsWithAnalysis = await Promise.all(
      (data || []).map(async (action: any) => {
        if (action.analysis_id) {
          const { data: analysis } = await supabase
            .from('mycroft_analyses')
            .select('*')
            .eq('id', action.analysis_id)
            .single();
          return { ...action, analysis };
        }
        return { ...action, analysis: null };
      })
    );

    setActions(actionsWithAnalysis);

    // Compute stats
    const green = actionsWithAnalysis.filter((a: any) => a.result === 'green').length;
    const red = actionsWithAnalysis.filter((a: any) => a.result === 'red').length;
    const total = actionsWithAnalysis.length;
    const totalPL = actionsWithAnalysis.reduce((sum: number, a: any) => sum + (a.profit_loss || 0), 0);

    setStats({
      total,
      green,
      red,
      winRate: total > 0 ? Math.round((green / total) * 100) : 0,
      totalPL,
    });

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const recordAction = useCallback(async (
    analysisId: string,
    action: 'entered' | 'dismissed' | 'copied',
    stakeAmount?: number
  ) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_actions')
      .insert({
        user_id: user.id,
        analysis_id: analysisId,
        action,
        stake_amount: stakeAmount || null,
        result: action === 'entered' ? 'pending' : null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error recording action:', error);
      return null;
    }

    // Refresh
    fetchHistory();
    return data;
  }, [user, fetchHistory]);

  return { actions, stats, loading, recordAction, refetch: fetchHistory };
}
