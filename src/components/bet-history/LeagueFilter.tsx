import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy } from 'lucide-react';

interface LeagueFilterProps {
  bets: { match_name: string }[];
  value: string;
  onChange: (v: string) => void;
}

/** Extracts a rough "league" from match_name patterns or returns the team pair */
function extractLeagueHint(matchName: string): string {
  // Common pattern: "Team A vs Team B" — we group by first word similarity
  // But if there's a league prefix like "PL: Team A vs Team B", use it
  const colonIdx = matchName.indexOf(':');
  if (colonIdx > 0 && colonIdx < 20) {
    return matchName.slice(0, colonIdx).trim();
  }
  return 'Geral';
}

export default function LeagueFilter({ bets, value, onChange }: LeagueFilterProps) {
  const leagues = useMemo(() => {
    const set = new Set<string>();
    bets.forEach(b => set.add(extractLeagueHint(b.match_name)));
    return ['all', ...Array.from(set).sort()];
  }, [bets]);

  if (leagues.length <= 2) return null; // Only "all" + 1 league = no point filtering

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px] h-8 text-xs font-orbitron bg-secondary/30 border-border">
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

export { extractLeagueHint };
