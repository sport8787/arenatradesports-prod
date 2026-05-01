import { cn } from '@/lib/utils';
import { Eye, Lock } from 'lucide-react';

export type NavCardBadge = {
  label: string;
  tone: 'live' | 'beta' | 'exclusive';
};

export interface NavCardProps {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  description: string;
  badge?: NavCardBadge;
  primary?: boolean;
  onClick: () => void;
  className?: string;
  /** Mostra cadeado e desvia clique (normalmente para /paywall) */
  locked?: boolean;
  /** Texto do tooltip/label do cadeado, ex: "Plano Basic ou superior" */
  lockedLabel?: string;
}

const badgeTone: Record<NavCardBadge['tone'], string> = {
  live: 'bg-destructive/15 text-destructive border border-destructive/40 animate-pulse',
  beta: 'bg-warning/15 text-warning border border-warning/40',
  exclusive: 'bg-primary/15 text-primary border border-primary/40',
};

export default function NavCard({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  badge,
  primary,
  onClick,
  className,
  locked,
  lockedLabel,
}: NavCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-disabled={locked || undefined}
      title={locked ? (lockedLabel || 'Bloqueado pelo seu plano — clique para fazer upgrade') : undefined}
      className={cn(
        'group relative flex h-full flex-col gap-4 rounded-2xl border bg-gradient-to-br from-card via-card to-card/70 p-5 text-left',
        'transition-all duration-200 ease-out',
        'hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        primary
          ? 'border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.18)] hover:border-primary/70'
          : 'border-border/60 hover:border-primary/40',
        locked && 'opacity-70 hover:opacity-100',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 ring-border/30 transition-transform duration-200 group-hover:scale-110',
            iconBg,
          )}
        >
          <span className={cn('flex', iconColor)}>{icon}</span>
        </div>
        {locked ? (
          <span
            className="flex h-7 items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em] text-warning"
            aria-label={lockedLabel || 'Bloqueado'}
          >
            <Lock className="h-3 w-3" />
            <span>{lockedLabel || 'Upgrade'}</span>
          </span>
        ) : (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary opacity-60 transition-opacity duration-200 group-hover:opacity-100"
            title="Oráculo Mycroft"
            aria-label="Oráculo Mycroft"
          >
            <Eye className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="flex-1 space-y-1.5">
        <p className="text-[15px] font-bold leading-tight tracking-tight text-foreground">
          {title}
        </p>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {badge && !locked && (
        <span
          className={cn(
            'self-start rounded-full px-2.5 py-0.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.12em]',
            badgeTone[badge.tone],
          )}
        >
          {badge.label}
        </span>
      )}
    </button>
  );
}

export { badgeTone };
