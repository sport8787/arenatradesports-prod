import { cn } from '@/lib/utils';
import { Check, X, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

export interface TraderEntry {
  id: string;
  user_id: string;
  fixture_id: string;
  fixture_label: string;
  created_at: string;
  minute_entered: number;
  plano: string;
  market: string;
  odd: number;
  stake_value: number;
  stake_pct: number;
  status: 'pending' | 'green' | 'red' | 'cashout';
  result: string | null;
  pnl: number | null;
  notes: string | null;
  odd_source?: string | null;
  estimatedOdd?: number | null;
  estimatedCashout?: number | null;
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  betfair_exchange: { label: 'Betfair LIVE', cls: 'bg-[hsl(217,91%,60%)]/15 text-[hsl(217,91%,60%)]' },
  futodds_live:     { label: 'Futodds',      cls: 'bg-[hsl(142,71%,45%)]/15 text-[hsl(142,71%,45%)]' },
  sportmonks_live:  { label: 'Sportmonks',   cls: 'bg-[hsl(280,70%,60%)]/15 text-[hsl(280,70%,60%)]' },
  estimada:         { label: 'Estimada',     cls: 'bg-muted text-muted-foreground' },
  betfair_direct:   { label: 'Betfair API',  cls: 'bg-[hsl(217,91%,60%)]/15 text-[hsl(217,91%,60%)]' },
};

interface EntryRowProps {
  entry: TraderEntry;
  index: number;
  onMarkGreen?: (entry: TraderEntry) => void;
  onMarkRed?: (entry: TraderEntry) => void;
  onMarkCashout?: (entry: TraderEntry) => void;
}

const borderColors = {
  pending: 'border-l-[hsl(45,93%,47%)]',
  green: 'border-l-[hsl(142,71%,45%)]',
  red: 'border-l-[hsl(0,84%,60%)]',
  cashout: 'border-l-[hsl(217,91%,60%)]',
};

const pnlColors = {
  pending: 'text-[hsl(45,93%,47%)]',
  green: 'text-[hsl(142,71%,45%)]',
  red: 'text-[hsl(0,84%,60%)]',
  cashout: 'text-[hsl(217,91%,60%)]',
};

export default function EntryRow({ entry, index, onMarkGreen, onMarkRed, onMarkCashout }: EntryRowProps) {
  const isPending = entry.status === 'pending';
  const hasEstimate = isPending && entry.estimatedCashout != null && entry.estimatedOdd != null;

  // For settled entries, show actual P&L
  const pnlDisplay =
    entry.status === 'green'
      ? `+R$ ${(entry.pnl ?? 0).toFixed(2)}`
      : entry.status === 'red'
      ? `-R$ ${entry.stake_value.toFixed(2)}`
      : entry.status === 'cashout'
      ? `R$ ${(entry.pnl ?? 0).toFixed(2)}`
      : hasEstimate
      ? (() => {
          const diff = entry.estimatedCashout! - Number(entry.stake_value);
          return `${diff >= 0 ? '+' : ''}R$ ${diff.toFixed(2)}`;
        })()
      : 'pendente';

  // Determine color for pending with estimate
  const pendingPnlColor = hasEstimate
    ? (entry.estimatedCashout! >= Number(entry.stake_value)
        ? 'text-[hsl(142,71%,45%)]'
        : 'text-[hsl(0,84%,60%)]')
    : pnlColors.pending;

  const effectivePnlColor = isPending ? pendingPnlColor : pnlColors[entry.status];

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 p-2 rounded-md border-l-2 bg-white/[0.03]',
        borderColors[entry.status]
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground font-medium font-orbitron">
          #{index} · Min {entry.minute_entered} · {entry.plano}
        </div>
        <div className="text-xs text-foreground font-medium truncate">{entry.market}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">
          Odd {Number(entry.odd).toFixed(2)}
          {hasEstimate && (
            <>
              <span className="text-muted-foreground"> → </span>
              <span className={cn(
                'font-bold',
                entry.estimatedOdd! < Number(entry.odd) ? 'text-[hsl(142,71%,45%)]' : 'text-[hsl(0,84%,60%)]'
              )}>
                {entry.estimatedOdd!.toFixed(2)}
              </span>
              <span className="ml-0.5 text-[9px] text-muted-foreground/70">EST</span>
            </>
          )}
          {' '}· R$ {Number(entry.stake_value).toFixed(2)} ({Number(entry.stake_pct).toFixed(0)}%)
        </div>

        {/* Estimated cashout value for pending */}
        {hasEstimate && (
          <div className="flex items-center gap-1 mt-1 text-[10px]">
            {entry.estimatedCashout! >= Number(entry.stake_value)
              ? <TrendingUp className="w-3 h-3 text-[hsl(142,71%,45%)]" />
              : <TrendingDown className="w-3 h-3 text-[hsl(0,84%,60%)]" />
            }
            <span className="text-muted-foreground">Cashout:</span>
            <span className={cn('font-bold', effectivePnlColor)}>
              R$ {entry.estimatedCashout!.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn('text-xs font-medium font-orbitron', effectivePnlColor)}>
          {pnlDisplay}
        </span>

        {entry.status === 'pending' && (
          <div className="flex gap-1">
            <button
              onClick={() => onMarkGreen?.(entry)}
              className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[hsl(142,71%,45%)]/15 text-[hsl(142,71%,45%)] hover:bg-[hsl(142,71%,45%)]/25 transition-colors"
            >
              <Check className="w-3 h-3" /> Green
            </button>
            <button
              onClick={() => onMarkRed?.(entry)}
              className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[hsl(0,84%,60%)]/15 text-[hsl(0,84%,60%)] hover:bg-[hsl(0,84%,60%)]/25 transition-colors"
            >
              <X className="w-3 h-3" /> Red
            </button>
            <button
              onClick={() => onMarkCashout?.(entry)}
              className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-[hsl(217,91%,60%)]/15 text-[hsl(217,91%,60%)] hover:bg-[hsl(217,91%,60%)]/25 transition-colors"
            >
              <DollarSign className="w-3 h-3" /> Cash
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
