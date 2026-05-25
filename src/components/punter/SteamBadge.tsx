import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TrendingDown, TrendingUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  matchId: string;
  market: string;
  className?: string;
}

interface SteamSig {
  direction: 'in_favor' | 'against' | 'neutral';
  drift_pct: number;
  window_minutes: number;
  open_mid_odd: number | null;
  close_mid_odd: number | null;
  detected_at: string;
}

/**
 * SteamBadge — exibe entrada de movimentação Sharp money detectada via Futodds Exchange.
 * Mostra apenas o último entrada não-neutro nas últimas 6h.
 */
export default function SteamBadge({ matchId, market, className }: Props) {
  const [sig, setSig] = useState<SteamSig | null>(null);

  useEffect(() => {
    let alive = true;
    if (!matchId || !market) return;
    (async () => {
      const since = new Date(Date.now() - 6 * 3600_000).toISOString();
      const { data } = await supabase
        .from('punter_steam_signals')
        .select('direction,drift_pct,window_minutes,open_mid_odd,close_mid_odd,detected_at')
        .eq('match_id', matchId).eq('market', market)
        .gte('detected_at', since)
        .order('detected_at', { ascending: false }).limit(1);
      if (alive) setSig((data?.[0] as SteamSig) ?? null);
    })();
    return () => { alive = false; };
  }, [matchId, market]);

  if (!sig || sig.direction === 'neutral') return null;
  const inFavor = sig.direction === 'in_favor';
  const tone = inFavor
    ? 'border-[hsl(45,93%,47%)]/50 bg-[hsl(45,93%,47%)]/10 text-[hsl(45,93%,70%)]'
    : 'border-[hsl(0,84%,55%)]/50 bg-[hsl(0,84%,55%)]/10 text-[hsl(0,84%,75%)]';
  const Icon = inFavor ? Flame : TrendingUp;
  const arrow = inFavor ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />;

  return (
    <div className={cn('rounded border px-2 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono', tone, className)}>
      <Icon className="w-3 h-3" />
      <span className="font-orbitron uppercase tracking-wider text-[9px]">
        {inFavor ? 'Steam a favor' : 'Steam contra'}
      </span>
      {arrow}
      <span className="font-bold">{sig.drift_pct >= 0 ? '+' : ''}{sig.drift_pct.toFixed(1)}%</span>
      <span className="opacity-70">
        · {sig.open_mid_odd?.toFixed(2) ?? '—'} → {sig.close_mid_odd?.toFixed(2) ?? '—'} em {sig.window_minutes}m
      </span>
    </div>
  );
}
