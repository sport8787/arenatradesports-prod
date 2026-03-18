import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TraderEntry } from '@/components/dashboard/EntryRow';

const OPPOSITE_MARKETS: Record<string, string> = {
  'Over 0.5 Total': 'Under 0.5 Total',
  'Under 0.5 Total': 'Over 0.5 Total',
  'Over 1.5 Total': 'Under 1.5 Total',
  'Under 1.5 Total': 'Over 1.5 Total',
  'Over 2.5 Total': 'Under 2.5 Total',
  'Under 2.5 Total': 'Over 2.5 Total',
  'Over 3.5 Total': 'Under 3.5 Total',
  'Under 3.5 Total': 'Over 3.5 Total',
};

export function useFixtureEntries(fixtureId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = ['arena-entries', fixtureId, userId];

  const { data: entries = [], ...rest } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!fixtureId || !userId) return [];
      const { data } = await supabase
        .from('arena_trader_entries')
        .select('*')
        .eq('fixture_id', fixtureId)
        .eq('user_id', userId)
        .order('minute_entered', { ascending: true });
      return (data ?? []) as TraderEntry[];
    },
    enabled: !!fixtureId && !!userId,
    refetchInterval: 30000,
  });

  const totalStakePct = entries.reduce((s, e) => s + Number(e.stake_pct), 0);
  const gamePnL = entries.reduce((s, e) => {
    if (e.status === 'green') return s + (Number(e.pnl) || 0);
    if (e.status === 'red') return s - Number(e.stake_value);
    if (e.status === 'cashout') return s + (Number(e.pnl) || 0);
    return s;
  }, 0);

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const canAddEntry = (market: string): { ok: boolean; reason?: string } => {
    if (totalStakePct >= 8) return { ok: false, reason: 'Limite de stake por jogo atingido (8% da banca)' };
    if (entries.some((e) => e.market === market && e.status === 'pending'))
      return { ok: false, reason: 'Já existe entrada pendente neste mercado' };
    const opposite = OPPOSITE_MARKETS[market];
    if (opposite && entries.some((e) => e.market === opposite && e.status === 'pending'))
      return { ok: false, reason: 'Mercado oposto já aprovado neste jogo' };
    return { ok: true };
  };

  const addEntry = async (entry: Omit<TraderEntry, 'id' | 'created_at' | 'result' | 'pnl' | 'notes' | 'status'>) => {
    const check = canAddEntry(entry.market);
    if (!check.ok) { toast.error(check.reason); return false; }
    const { error } = await supabase.from('arena_trader_entries').insert({ ...entry, status: 'pending' } as any);
    if (error) { toast.error('Erro ao registrar entrada'); console.error(error); return false; }
    invalidate();
    toast.success('Entrada registrada!');
    return true;
  };

  const markGreen = async (entryId: string, odd: number, stakeValue: number) => {
    const pnl = parseFloat(((odd - 1) * stakeValue).toFixed(2));
    await supabase.from('arena_trader_entries').update({ status: 'green', pnl, result: 'green' } as any).eq('id', entryId);
    invalidate();
  };

  const markRed = async (entryId: string, stakeValue: number) => {
    await supabase.from('arena_trader_entries').update({ status: 'red', pnl: -stakeValue, result: 'red' } as any).eq('id', entryId);
    invalidate();
  };

  const markCashout = async (entryId: string, cashoutValue: number, stakeValue: number) => {
    const pnl = parseFloat((cashoutValue - stakeValue).toFixed(2));
    await supabase.from('arena_trader_entries').update({ status: 'cashout', pnl, result: 'cashout' } as any).eq('id', entryId);
    invalidate();
  };

  return { entries, totalStakePct, gamePnL, addEntry, markGreen, markRed, markCashout, canAddEntry, invalidate, ...rest };
}
