import { Volume2, VolumeX, Zap, Eye } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useHorusMode } from '@/hooks/useHorusMode';
import type { HorusMode } from '@/data/horusTriggers';
import HorusModeSelector from './HorusModeSelector';
import { cn } from '@/lib/utils';

const ICON: Record<HorusMode, React.ComponentType<{ className?: string }>> = {
  silent: VolumeX,
  critical_only: Zap,
  mentor: Eye,
  narrator: Volume2,
};

const SHORT: Record<HorusMode, string> = {
  silent: 'Silencioso',
  critical_only: 'Experiente',
  mentor: 'Iniciante',
  narrator: 'Narrador',
};

/**
 * Atalho compacto para trocar o modo de voz do Hórus,
 * usado no header das arenas (Trader Sports, etc).
 */
export default function HorusModeQuickButton() {
  const { mode } = useHorusMode();
  const Icon = ICON[mode];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Voz do Hórus: ${SHORT[mode]}`}
          aria-label={`Voz do Hórus: ${SHORT[mode]}`}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-mono transition-colors',
            'border-border/70 bg-card/70 text-muted-foreground hover:text-foreground hover:border-primary/40'
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Hórus: {SHORT[mode]}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0 border-0 bg-transparent shadow-xl">
        <HorusModeSelector />
      </PopoverContent>
    </Popover>
  );
}
