import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BetSuggestion } from '@/lib/blackjack/live/liveBetSizing';

interface Props {
  running: number;
  trueCount: number;
  decksRemaining: number;
  suggestion: BetSuggestion;
}

function tierFor(tc: number) {
  if (tc <= 0) return { label: 'Aposta mínima', color: 'bg-destructive text-destructive-foreground', dot: 'bg-destructive' };
  if (tc <= 2) return { label: 'Aposta base', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', dot: 'bg-yellow-400' };
  if (tc <= 4) return { label: 'Aumentar aposta', color: 'bg-green-500/20 text-green-300 border-green-500/40', dot: 'bg-green-400' };
  return { label: 'Aposta máxima', color: 'bg-amber-400/20 text-amber-300 border-amber-400/50', dot: 'bg-amber-300' };
}

export default function CountingPanel({ running, trueCount, decksRemaining, suggestion }: Props) {
  const tier = tierFor(trueCount);
  return (
    <Card className="border-primary/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Running Count</p>
            <p className="text-3xl font-black">{running > 0 ? `+${running}` : running}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">True Count</p>
            <p className="text-3xl font-black">{trueCount > 0 ? `+${trueCount}` : trueCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 rounded-full ${tier.dot}`} />
          <Badge variant="outline" className={tier.color}>{tier.label}</Badge>
          <span className="text-xs text-muted-foreground ml-auto">{decksRemaining.toFixed(1)} decks restantes</span>
        </div>
        <div className="rounded-md bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">Próxima aposta sugerida</p>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-2xl font-bold text-primary">R$ {suggestion.amount.toFixed(2)}</span>
            <span className="text-xs text-muted-foreground">{suggestion.reason}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
