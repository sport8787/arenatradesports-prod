import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Target, Loader2, Zap, Flame, AlertTriangle, Skull } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Match } from './MatchCard';

interface CompactMatchTableProps {
  matches: Match[];
  onRowClick?: (matchId: string) => void;
}

function computeCriteriaCompact(match: Match) {
  const s = match.stats;
  const possHome = s?.possession_home ?? 0;
  const atkHome = s?.attacks_home ?? 0;
  const atkAway = s?.attacks_away ?? 0;
  const shotsHome = s?.shots_home ?? 0;
  const cornersHome = s?.corners_home ?? 0;
  const xgHome = s?.xG_home ?? 0;
  const xgAway = s?.xG_away ?? 0;

  const criteria = [
    (possHome > 55) || (atkHome > atkAway * 1.3),
    (shotsHome >= 3) || (cornersHome >= 2),
    xgHome > xgAway,
    match.scoreHome >= match.scoreAway,
    match.minute >= 25 && match.minute <= 80,
  ];
  return criteria.filter(Boolean).length;
}

const statusIcon: Record<string, React.ReactNode> = {
  APROVADO: <Target className="w-3.5 h-3.5 text-[#4ADE80]" />,
  opportunity: <Target className="w-3.5 h-3.5 text-[#4ADE80]" />,
  APROVADO_SITUACIONAL: <Target className="w-3.5 h-3.5 text-[#6EE7B7]" />,
  LABAREDA: <Flame className="w-3.5 h-3.5 text-[#FB923C]" />,
  CUIDADO: <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24]" />,
  JOGO_MORTO: <Skull className="w-3.5 h-3.5 text-[#A8A29E]" />,
  VETADO: <Skull className="w-3.5 h-3.5 text-[#A8A29E]" />,
  no_value: <Skull className="w-3.5 h-3.5 text-[#A8A29E]" />,
  AGUARDAR: <Clock className="w-3.5 h-3.5 text-[#FBBF24]" />,
  analyzing: <Loader2 className="w-3.5 h-3.5 text-[#60A5FA] animate-spin" />,
};

const statusColors: Record<string, string> = {
  APROVADO: 'text-[#4ADE80]',
  opportunity: 'text-[#4ADE80]',
  APROVADO_SITUACIONAL: 'text-[#6EE7B7]',
  LABAREDA: 'text-[#FB923C]',
  CUIDADO: 'text-[#FBBF24]',
  JOGO_MORTO: 'text-[#A8A29E]',
  VETADO: 'text-[#A8A29E]',
  no_value: 'text-[#A8A29E]',
  AGUARDAR: 'text-[#FBBF24]',
  analyzing: 'text-[#60A5FA]',
};

const statusLabels: Record<string, string> = {
  APROVADO: 'APROVADO',
  opportunity: 'APROVADO',
  APROVADO_SITUACIONAL: 'SITUACIONAL',
  LABAREDA: 'LABAREDA',
  CUIDADO: 'CUIDADO',
  JOGO_MORTO: 'MORTO',
  VETADO: 'MORTO',
  no_value: 'MORTO',
  AGUARDAR: 'AGUARDAR',
  analyzing: 'ANALISANDO',
};

export default function CompactMatchTable({ matches, onRowClick }: CompactMatchTableProps) {
  if (matches.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto rounded-lg border border-border bg-card/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-orbitron uppercase tracking-wider">
              <th className="px-3 py-2 text-left">Min</th>
              <th className="px-3 py-2 text-left">Jogo</th>
              <th className="px-3 py-2 text-center">Placar</th>
              <th className="px-3 py-2 text-left">Liga</th>
              <th className="px-3 py-2 text-center">Posse</th>
              <th className="px-3 py-2 text-center">Chutes</th>
              <th className="px-3 py-2 text-center">xG</th>
              <th className="px-3 py-2 text-center">Crit.</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-left">Plano</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const critMet = computeCriteriaCompact(m);
              const isImminent = critMet >= 4 && (m.mycroftStatus === 'AGUARDAR' || m.mycroftStatus === 'analyzing');
              const rowBorder =
                m.mycroftStatus === 'APROVADO' || m.mycroftStatus === 'APROVADO_SITUACIONAL' || m.mycroftStatus === 'opportunity'
                  ? 'border-l-2 border-l-[#22C55E]'
                  : m.mycroftStatus === 'LABAREDA'
                    ? 'border-l-2 border-l-[#F97316]'
                    : m.mycroftStatus === 'CUIDADO'
                      ? 'border-l-2 border-l-[#F59E0B]'
                      : isImminent
                        ? 'border-l-2 border-l-[#F59E0B]'
                        : '';

              return (
                <tr
                  key={m.id}
                  onClick={() => onRowClick?.(m.id)}
                  className={cn(
                    'border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors',
                    rowBorder,
                  )}
                >
                  <td className="px-3 py-2 font-orbitron text-foreground whitespace-nowrap">
                    {m.status === 'live' && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-destructive mr-1 animate-pulse" />
                    )}
                    {m.minute}'
                  </td>
                  <td className="px-3 py-2 text-foreground font-medium max-w-[180px] truncate">
                    {m.home} vs {m.away}
                  </td>
                  <td className="px-3 py-2 text-center font-orbitron font-bold text-foreground">
                    {m.scoreHome} - {m.scoreAway}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground max-w-[120px] truncate">{m.championship}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {m.stats?.possession_home ? `${m.stats.possession_home}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {m.stats?.shots_home != null ? `${m.stats.shots_home}-${m.stats.shots_away ?? 0}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {m.stats?.xG_home != null
                      ? `${m.stats.xG_home.toFixed(1)}-${(m.stats.xG_away ?? 0).toFixed(1)}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      {[0, 1, 2, 3, 4].map(i => (
                        <div
                          key={i}
                          className={cn(
                            'w-2 h-2 rounded-full',
                            i < critMet
                              ? 'bg-[#22C55E] shadow-[0_0_4px_rgba(34,197,94,0.5)]'
                              : 'bg-muted-foreground/30'
                          )}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {statusIcon[m.mycroftStatus] ?? null}
                      <span className={cn('font-orbitron font-bold text-[10px]', statusColors[m.mycroftStatus] ?? 'text-muted-foreground')}>
                        {statusLabels[m.mycroftStatus] ?? '—'}
                      </span>
                      {isImminent && <Zap className="w-3 h-3 text-[#FBBF24] animate-pulse" />}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-left">
                    {(m.mycroftStatus === 'APROVADO' || m.mycroftStatus === 'APROVADO_SITUACIONAL' || m.mycroftStatus === 'opportunity') && m.planName ? (
                      <span className="font-orbitron text-primary font-bold text-[10px]">{m.planName}</span>
                    ) : m.mycroftStatus === 'LABAREDA' ? (
                      <span className="font-orbitron text-[#FB923C] font-bold text-[10px]">⚡ LABAREDA</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </TooltipProvider>
  );
}