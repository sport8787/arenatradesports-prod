import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  matchId: string;
  market: string;
  className?: string;
}

interface Snapshot {
  open_back_odd: number | null;
  open_lay_odd: number | null;
  open_mid_odd: number | null;
  open_edge_pp: number | null;
  close_mid_odd: number | null;
  clv_pp: number | null;
  demoted_by_exchange: boolean | null;
  bookmaker_edge_pp: number | null;
}

/**
 * ExchangeEdgeBadge — exibe edge real calculado contra Betfair Exchange
 * (preço justo de mercado, sem margem de bookmaker). Aparece somente quando
 * há snapshot em punter_clv_log para (match_id, market). Vermelho se rebaixado.
 */
export default function ExchangeEdgeBadge({ matchId, market, className }: Props) {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let alive = true;
    if (!matchId || !market) return;
    (async () => {
      const { data } = await supabase
        .from('punter_clv_log')
        .select('open_back_odd,open_lay_odd,open_mid_odd,open_edge_pp,close_mid_odd,clv_pp,demoted_by_exchange,bookmaker_edge_pp')
        .eq('match_id', matchId)
        .eq('market', market)
        .maybeSingle();
      if (alive) setSnap(data as Snapshot | null);
    })();
    return () => { alive = false; };
  }, [matchId, market]);

  if (!snap || snap.open_mid_odd == null) return null;

  const edge = Number(snap.open_edge_pp ?? 0);
  const tone = snap.demoted_by_exchange
    ? 'border-[hsl(0,84%,55%)]/40 bg-[hsl(0,84%,55%)]/10 text-[hsl(0,84%,75%)]'
    : edge >= 5
      ? 'border-[hsl(142,71%,45%)]/40 bg-[hsl(142,71%,45%)]/10 text-[hsl(142,71%,65%)]'
      : 'border-border bg-secondary/30 text-muted-foreground';

  return (
    <div className={cn('rounded border px-2 py-1.5 flex items-center gap-2 text-[10px] font-mono', tone, className)}>
      {snap.demoted_by_exchange ? <ShieldAlert className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
      <span className="font-orbitron uppercase tracking-wider text-[9px]">Edge real (Exchange)</span>
      <span className="font-bold">{edge >= 0 ? '+' : ''}{edge.toFixed(1)}pp</span>
      <span className="opacity-70">· back {snap.open_back_odd?.toFixed(2) ?? '—'} / lay {snap.open_lay_odd?.toFixed(2) ?? '—'}</span>
      {snap.demoted_by_exchange && <span className="ml-auto uppercase">Falso valor</span>}
    </div>
  );
}
