import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy } from 'lucide-react';

interface LeagueFilterProps {
  bets: { league?: string }[];
  value: string;
  onChange: (v: string) => void;
}

/** Normalizes league name for display */
function normalizeLeague(raw: string): string {
  if (!raw) return 'Outros';
  return raw
    .replace(/_/g, ' ')
    .replace(/^soccer\s*/i, '')
    .trim() || 'Outros';
}

/** Extracts league from bet — uses league field or falls back to 'Outros' */
export function extractLeague(bet: { league?: string }): string {
  return bet.league ? normalizeLeague(bet.league) : 'Outros';
}

export default function LeagueFilter({ bets, value, onChange }: LeagueFilterProps) {
  const leagues = useMemo(() => {
    const set = new Set<string>();
    bets.forEach(b => set.add(extractLeague(b)));
    return ['all', ...Array.from(set).sort()];
  }, [bets]);

  if (leagues.length <= 2) return null;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] h-8 text-xs font-orbitron bg-secondary/30 border-border">
        <Trophy className="w-3.5 h-3.5 mr-1.5 text-primary" />
        <SelectValue placeholder="Liga" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as Ligas</SelectItem>
        {leagues.filter(l => l !== 'all').map(league => (
          <SelectItem key={league} value={league}>{league}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
