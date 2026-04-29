import { cn } from '@/lib/utils';
import { Eye } from 'lucide-react';

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
        'group relative flex flex-col gap-3 rounded-2xl border bg-gradient-to-br from-card to-card/60 p-5 text-left transition-all duration-200',
        'hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5',
        primary
          ? 'border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)] hover:border-primary/70 hover:shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.4)]'
          : 'border-border/50 hover:border-primary/30',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-110', iconBg)}>
          <span className={cn('flex', iconColor)}>{icon}</span>
        </div>
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary opacity-70 transition-opacity group-hover:opacity-100"
          title="Oráculo Mycroft"
          aria-label="Oráculo Mycroft"
        >
          <Eye className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-foreground leading-tight tracking-tight">{title}</p>
        <p className="text-[12px] text-muted-foreground leading-relaxed">{description}</p>
      </div>
      {badge && (
        <span
          className={cn(
            'self-start rounded-full px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider',
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
