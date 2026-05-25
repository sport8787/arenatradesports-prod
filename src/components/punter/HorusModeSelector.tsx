import { motion } from 'framer-motion';
import { Eye, Volume2, VolumeX, Zap, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHorusMode } from '@/hooks/useHorusMode';
import { HORUS_MODE_LABELS, type HorusMode } from '@/data/horusTriggers';

const MODE_ORDER: HorusMode[] = ['silent', 'critical_only', 'mentor', 'narrator'];

const MODE_ICONS: Record<HorusMode, React.ComponentType<{ className?: string }>> = {
  silent: VolumeX,
  critical_only: Zap,
  mentor: Eye,
  narrator: Volume2,
};

/**
 * Seletor visual do modo do Hórus (4 cards).
 * Para uso dentro de PunterConfig.tsx (seção "Alertas do Hórus").
 */
export default function HorusModeSelector() {
  const { mode, setMode } = useHorusMode();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg bg-card overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2">
        <Bell className="w-3.5 h-3.5 text-primary" />
        <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          MODO DA VOZ DO HÓRUS
        </span>
      </div>

      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MODE_ORDER.map((m) => {
          const Icon = MODE_ICONS[m];
          const meta = HORUS_MODE_LABELS[m];
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'text-left p-3 rounded-lg border transition-all',
                active
                  ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/40'
                  : 'border-border bg-background/40 hover:border-primary/30 hover:bg-primary/5'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('w-4 h-4', active ? 'text-primary' : 'text-muted-foreground')} />
                <span className={cn(
                  'font-mono text-[11px] font-bold uppercase tracking-wide',
                  active ? 'text-primary' : 'text-foreground'
                )}>
                  {meta.title}
                </span>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground leading-snug">
                {meta.desc}
              </p>
            </button>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-border bg-background/40">
        <p className="text-[10px] font-mono text-muted-foreground/70">
          Curto, técnico, calmo. Hórus só fala em momentos relevantes.
        </p>
      </div>
    </motion.div>
  );
}
