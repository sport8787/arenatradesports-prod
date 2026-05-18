import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Target, Loader2, Zap, Flame, AlertTriangle, Skull, Hourglass, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Match } from './MatchCard';
import { isExpiredHtSignal } from '@/lib/signalValidity';
import { computeCriteria, getCriteriaSummary } from '@/lib/matchCriteria';
import FavoriteButton from './FavoriteButton';
import CriteriaDetailModal from './CriteriaDetailModal';

interface CompactMatchTableProps {
  matches: Match[];
  onRowClick?: (matchId: string) => void;
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
  EXPIRADO: <Hourglass className="w-3.5 h-3.5 text-[#A8A29E]" />,
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
  EXPIRADO: 'text-[#A8A29E]',
};

const statusLabels: Record<string, string> = {
  APROVADO: 'APROVADO',
  opportunity: 'APROVADO',
  APROVADO_SITUACIONAL: 'APROVADO • MENOR FORÇA',
  LABAREDA: 'APROVADO LABAREDAS',
  CUIDADO: 'NÃO ENTRE — OBSERVANDO',
  JOGO_MORTO: 'SEM CHANCE',
  VETADO: 'SEM CHANCE',
  no_value: 'SEM CHANCE',
  AGUARDAR: 'SEM SINAL',
  analyzing: 'ANALISANDO',
  EXPIRADO: 'EXPIRADO',
};

const dotColorMap = {
  green: 'bg-[#22C55E] shadow-[0_0_4px_rgba(34,197,94,0.6)]',
  red: 'bg-[#EF4444] shadow-[0_0_4px_rgba(239,68,68,0.6)]',
  yellow: 'bg-[#F59E0B] shadow-[0_0_4px_rgba(245,158,11,0.6)]',
  gray: 'bg-muted-foreground/30',
} as const;

function getEffectiveStatus(m: Match): Match['mycroftStatus'] {
  const expired = isExpiredHtSignal({
    market: m.market,
    minute: m.minute,
    period: m.period,
    status: m.status,
  });
  if (expired && (m.mycroftStatus === 'APROVADO' || m.mycroftStatus === 'APROVADO_SITUACIONAL' || m.mycroftStatus === 'opportunity' || m.mycroftStatus === 'LABAREDA')) {
    return 'EXPIRADO';
  }
  return m.mycroftStatus;
}

export default function CompactMatchTable({ matches, onRowClick }: CompactMatchTableProps) {
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  if (matches.length === 0) return null;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="overflow-x-auto rounded-lg border border-border bg-card/50">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-orbitron uppercase tracking-wider">
              <th className="px-2 py-2 text-center w-8">★</th>
              <th className="px-3 py-2 text-left">Min</th>
              <th className="px-3 py-2 text-left">Jogo</th>
              <th className="px-3 py-2 text-center">Placar</th>
              <th className="px-3 py-2 text-left">Liga</th>
              <th className="px-3 py-2 text-center">Posse</th>
              <th className="px-3 py-2 text-center">Chutes</th>
              <th className="px-3 py-2 text-center">xG</th>
              <th className="px-3 py-2 text-center">B1-B5</th>
              <th className="px-3 py-2 text-center">Status</th>
              <th className="px-3 py-2 text-left">Plano</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const criteria = computeCriteria(m);
              const { greens: critMet, eliminatoryFailed } = getCriteriaSummary(criteria);
              const effStatus = getEffectiveStatus(m);
              const isImminent = !eliminatoryFailed && critMet >= 4 && (effStatus === 'AGUARDAR' || effStatus === 'analyzing');
              const rowBorder =
                effStatus === 'APROVADO' || effStatus === 'APROVADO_SITUACIONAL' || effStatus === 'opportunity'
                  ? 'border-l-2 border-l-[#22C55E]'
                  : effStatus === 'LABAREDA'
                    ? 'border-l-2 border-l-[#F97316]'
                    : effStatus === 'CUIDADO'
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
                    (effStatus === 'EXPIRADO' || eliminatoryFailed) && 'opacity-70',
                  )}
                >
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <FavoriteButton size="sm" keys={[m.matchId, m.home, m.away]} />
                  </td>
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
                  <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setModalMatch(m)}
                      className="inline-flex items-center justify-center gap-1 hover:bg-muted/40 rounded px-1 py-0.5 transition-colors"
                      aria-label="Ver detalhes B1-B5"
                    >
                      {criteria.map((c) => (
                        <Tooltip key={c.key}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'w-2 h-2 rounded-full border border-transparent',
                                dotColorMap[c.state],
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[220px]">
                            <div className="font-semibold">{c.label}</div>
                            <div className="text-muted-foreground">{c.detail}</div>
                            {c.vetoReason && <div>↳ {c.vetoReason}</div>}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                      <Info className="w-2.5 h-2.5 text-muted-foreground/60 ml-0.5" />
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {m.signalResult === 'green' ? (
                        <span className="font-orbitron font-bold text-[10px] px-1.5 py-0.5 rounded bg-success text-success-foreground">✓ GREEN</span>
                      ) : m.signalResult === 'red' ? (
                        <span className="font-orbitron font-bold text-[10px] px-1.5 py-0.5 rounded bg-destructive text-destructive-foreground">✗ RED</span>
                      ) : (
                        <>
                          {statusIcon[effStatus] ?? null}
                          <span className={cn('font-orbitron font-bold text-[10px]', statusColors[effStatus] ?? 'text-muted-foreground')}>
                            {statusLabels[effStatus] ?? '—'}
                          </span>
                          {isImminent && <Zap className="w-3 h-3 text-[#FBBF24] animate-pulse" />}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-left">
                    {(effStatus === 'APROVADO' || effStatus === 'APROVADO_SITUACIONAL' || effStatus === 'opportunity') && m.planName ? (
                      <span className="font-orbitron text-primary font-bold text-[10px]">{m.planName}</span>
                    ) : effStatus === 'LABAREDA' ? (
                      <span className="font-orbitron text-[#FB923C] font-bold text-[10px]">⚡ APROVADO LABAREDAS</span>
                    ) : effStatus === 'EXPIRADO' ? (
                      <span className="font-orbitron text-[#A8A29E] text-[10px]" title={`Mercado "${m.market}" inválido após o 1º tempo`}>⌛ 1T encerrado</span>
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
      <CriteriaDetailModal
        match={modalMatch}
        open={!!modalMatch}
        onOpenChange={(o) => !o && setModalMatch(null)}
      />
    </TooltipProvider>
  );
}
