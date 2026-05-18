import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  mycroftProbability: number | null | undefined;
  sportmonksProbability: number | null | undefined;
  divergencePp: number | null | undefined;
  sherlockAlert: boolean | null | undefined;
  className?: string;
}

/**
 * SportmonksPredictionBadge — segunda opinião do modelo Sportmonks vs Mycroft.
 * Só renderiza quando há probabilidade Sportmonks disponível.
 * Quando divergência > 15pp → tom de alerta + texto "Operar com cautela".
 */
export default function SportmonksPredictionBadge({
  mycroftProbability,
  sportmonksProbability,
  divergencePp,
  sherlockAlert,
  className,
}: Props) {
  if (sportmonksProbability == null || mycroftProbability == null) return null;
  const div = Number(divergencePp ?? Math.abs(Number(mycroftProbability) - Number(sportmonksProbability)));
  const alert = !!sherlockAlert || div > 15;
  const tone = alert
    ? 'border-[hsl(38,92%,50%)]/50 bg-[hsl(38,92%,50%)]/10 text-[hsl(38,92%,70%)]'
    : 'border-border bg-secondary/30 text-muted-foreground';
  return (
    <div className={cn('rounded border px-2 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-mono', tone, className)}>
      <AlertTriangle className={cn('w-3 h-3', alert ? '' : 'opacity-60')} />
      <span className="font-orbitron uppercase tracking-wider text-[9px]">2ª opinião (Sportmonks)</span>
      <span className="opacity-80">Mycroft <b>{Number(mycroftProbability).toFixed(0)}%</b></span>
      <span className="opacity-50">vs</span>
      <span className="opacity-80">Sportmonks <b>{Number(sportmonksProbability).toFixed(0)}%</b></span>
      <span className={cn('ml-auto font-bold uppercase tracking-wider text-[9px]', alert ? 'text-[hsl(38,92%,70%)]' : 'text-muted-foreground')}>
        Δ {div.toFixed(0)}pp{alert ? ' · cautela' : ''}
      </span>
    </div>
  );
}
