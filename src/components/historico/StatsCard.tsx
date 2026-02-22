import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  sub?: ReactNode;
  valueColor?: string;
}

export default function StatsCard({ label, value, icon, sub, valueColor }: StatsCardProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className={cn('font-orbitron text-lg font-bold', valueColor ?? 'text-foreground')}>{value}</p>
      {sub}
    </div>
  );
}
