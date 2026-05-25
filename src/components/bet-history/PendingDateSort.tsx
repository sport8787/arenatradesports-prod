import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpDown } from 'lucide-react';

export type PendingSortOption = 'date_asc' | 'date_desc' | 'placed_desc';

interface PendingDateSortProps {
  value: PendingSortOption;
  onChange: (v: PendingSortOption) => void;
}

export default function PendingDateSort({ value, onChange }: PendingDateSortProps) {
  return (
    <Select value={value} onValueChange={v => onChange(v as PendingSortOption)}>
      <SelectTrigger className="w-[200px] h-8 text-xs font-orbitron bg-secondary/30 border-border">
        <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-primary" />
        <SelectValue placeholder="Ordenar" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="date_asc">Data do Jogo ↑</SelectItem>
        <SelectItem value="date_desc">Data do Jogo ↓</SelectItem>
        <SelectItem value="placed_desc">Data da Entrada ↓</SelectItem>
      </SelectContent>
    </Select>
  );
}
