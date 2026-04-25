import { cn } from '@/lib/utils';

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
}

const badgeTone: Record<NavCardBadge['tone'], string> = {
  live: 'bg-destructive/15 text-destructive border border-destructive/30 animate-pulse',
  beta: 'bg-warning/15 text-warning border border-warning/30',
  exclusive: 'bg-primary/15 text-primary border border-primary/30',
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
}: NavCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-all',
        'hover:bg-card/80 hover:-translate-y-0.5',
        primary
          ? 'border-primary/50 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)] hover:border-primary/70 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.45)]'
          : 'border-border/60 hover:border-border',
        className,
      )}
    >
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-md', iconBg)}>
        <span className={cn('flex', iconColor)}>{icon}</span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-foreground leading-tight">{title}</p>
        <p className="text-[12px] text-muted-foreground leading-snug">{description}</p>
      </div>
      {badge && (
        <span
          className={cn(
            'self-start rounded-md px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider',
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
