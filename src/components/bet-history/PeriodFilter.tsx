import { cn } from '@/lib/utils';

export type PeriodOption = 'all' | 'today' | '30d' | '60d' | '90d';

const PERIOD_OPTIONS: { value: PeriodOption; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'today', label: 'Hoje' },
  { value: '30d', label: '30D' },
  { value: '60d', label: '60D' },
  { value: '90d', label: '90D' },
];

interface PeriodFilterProps {
  value: PeriodOption;
  onChange: (v: PeriodOption) => void;
}

export function getPeriodStartDate(period: PeriodOption): Date | null {
  if (period === 'all') return null;
  const now = new Date();
  if (period === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  const days = period === '30d' ? 30 : period === '60d' ? 60 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export default function PeriodFilter({ value, onChange }: PeriodFilterProps) {
  return (
    <div className="flex items-center gap-1 bg-secondary/30 rounded-lg p-1">
      {PERIOD_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1.5 text-xs font-orbitron rounded-md transition-all",
            value === opt.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
