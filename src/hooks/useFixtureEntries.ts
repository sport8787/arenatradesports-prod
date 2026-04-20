import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showBrowserPush } from '@/lib/browserPush';
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

interface MatchContext {
  minute?: number;
  scoreHome?: number;
  scoreAway?: number;
}

/**
 * Estimate current odd based on match progression.
 * Uses time decay and score changes as factors.
 * This is a simple deterministic model — will be replaced
 * by real odds from Live API key in the future.
 */
function estimateCurrentOdd(entryOdd: number, entryMinute: number, market: string, ctx: MatchContext): number {
  const currentMinute = ctx.minute ?? entryMinute;
  const totalGoals = (ctx.scoreHome ?? 0) + (ctx.scoreAway ?? 0);
  const elapsed = Math.max(0, currentMinute - entryMinute);

  // Time factor: odds decrease as game progresses (less time = less uncertainty)
  const remainingPct = Math.max(0, (90 - currentMinute) / 90);

  const isOver = market.toLowerCase().startsWith('over');
  const isUnder = market.toLowerCase().startsWith('under');

  if (isOver) {
    // Extract target from market name e.g. "Over 2.5 Total" -> 2.5
    const targetMatch = market.match(/(\d+\.?\d*)/);
    const target = targetMatch ? parseFloat(targetMatch[1]) : 1.5;
    const remaining = target - totalGoals;

    if (remaining <= 0) {
      // Already hit — odd drops close to 1.0 (green)
      return Math.max(1.01, 1 + (entryOdd - 1) * 0.05);
    }
    // Odd adjusts based on goals needed vs time remaining
    const difficultyFactor = remaining / Math.max(0.1, remainingPct * 3);
    return Math.max(1.01, entryOdd * (0.5 + difficultyFactor * 0.5));
  }

  if (isUnder) {
    const targetMatch = market.match(/(\d+\.?\d*)/);
    const target = targetMatch ? parseFloat(targetMatch[1]) : 1.5;
    const margin = target - totalGoals;

    if (margin <= 0) {
      // Busted — odd spikes (red)
      return entryOdd * 5;
    }
    // Under gets better with time passing without goals
    const timeSafety = (1 - remainingPct) * 0.7;
    return Math.max(1.01, entryOdd * (1 - timeSafety));
  }

  // Generic market: simple time decay
  const timeFactor = 1 - (elapsed / 90) * 0.3;
  return Math.max(1.01, entryOdd * timeFactor);
}

export function useFixtureEntries(fixtureId: string | undefined, userId: string | undefined, matchContext?: MatchContext) {
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

  // Calculate live P&L using estimated current odds
  const gamePnL = entries.reduce((s, e) => {
    if (e.status === 'green') return s + (Number(e.pnl) || 0);
    if (e.status === 'red') return s - Number(e.stake_value);
    if (e.status === 'cashout') return s + (Number(e.pnl) || 0);
    // For pending entries, estimate P&L from current odd
    if (e.status === 'pending' && matchContext) {
      const currentOdd = estimateCurrentOdd(Number(e.odd), e.minute_entered, e.market, matchContext);
      const estimatedCashout = Number(e.stake_value) * (Number(e.odd) / currentOdd);
      return s + (estimatedCashout - Number(e.stake_value));
    }
    return s;
  }, 0);

  // Provide estimated cashout values for each pending entry
  const entriesWithEstimates = entries.map(e => {
    if (e.status !== 'pending' || !matchContext) return { ...e, estimatedOdd: null, estimatedCashout: null };
    const currentOdd = estimateCurrentOdd(Number(e.odd), e.minute_entered, e.market, matchContext);
    const estimatedCashout = parseFloat((Number(e.stake_value) * (Number(e.odd) / currentOdd)).toFixed(2));
    return { ...e, estimatedOdd: parseFloat(currentOdd.toFixed(2)), estimatedCashout };
  });

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

  const notifyResult = async (
    entryId: string,
    eventType: 'GREEN' | 'RED' | 'CASHOUT',
    pnl: number,
    stakeValue: number,
  ) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const [home, away] = (entry.fixture_label || ' x ').split(/\s+x\s+/i);
    const titleByEvent = {
      GREEN: '🟢 GREEN! Sinal confirmado',
      RED: '🔴 Sinal vermelho',
      CASHOUT: '💵 Cashout executado',
    } as const;
    const bodyMsg =
      eventType === 'GREEN'
        ? `${entry.market} @ ${Number(entry.odd).toFixed(2)} • +R$ ${pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : eventType === 'RED'
          ? `${entry.market} @ ${Number(entry.odd).toFixed(2)} • −R$ ${Math.abs(pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : `${entry.market} • R$ ${pnl >= 0 ? '+' : '−'}${Math.abs(pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    showBrowserPush(titleByEvent[eventType], bodyMsg, {
      tag: `result-${entryId}`,
      url: `/arena-trader-sports/match/${entry.fixture_id}`,
    });

    try {
      await supabase.functions.invoke('notify-trader-event', {
        body: {
          match_id: entry.fixture_id,
          market: entry.market,
          event_type: eventType,
          home_team: (home || '').trim() || 'Time A',
          away_team: (away || '').trim() || 'Time B',
          odd: Number(entry.odd),
          pnl,
          stake_value: stakeValue,
        },
      });
    } catch (e) {
      console.warn('notify-trader-event falhou:', e);
    }
  };

  const markGreen = async (entryId: string, odd: number, stakeValue: number) => {
    const pnl = parseFloat(((odd - 1) * stakeValue).toFixed(2));
    await supabase.from('arena_trader_entries').update({ status: 'green', pnl, result: 'green' } as any).eq('id', entryId);
    invalidate();
    toast.success(`🟢 GREEN! +R$ ${pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} na sua banca virtual`);
    await notifyResult(entryId, 'GREEN', pnl, stakeValue);
  };

  const markRed = async (entryId: string, stakeValue: number) => {
    await supabase.from('arena_trader_entries').update({ status: 'red', pnl: -stakeValue, result: 'red' } as any).eq('id', entryId);
    invalidate();
    toast.error(`🔴 RED. −R$ ${stakeValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no resultado`);
    await notifyResult(entryId, 'RED', -stakeValue, stakeValue);
  };

  const markCashout = async (entryId: string, cashoutValue: number, stakeValue: number) => {
    const pnl = parseFloat((cashoutValue - stakeValue).toFixed(2));
    await supabase.from('arena_trader_entries').update({ status: 'cashout', pnl, result: 'cashout' } as any).eq('id', entryId);
    invalidate();
    toast(`💵 Cashout: ${pnl >= 0 ? '+' : '−'}R$ ${Math.abs(pnl).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    await notifyResult(entryId, 'CASHOUT', pnl, stakeValue);
  };

  return { entries: entriesWithEstimates, totalStakePct, gamePnL, addEntry, markGreen, markRed, markCashout, canAddEntry, invalidate, ...rest };
}
