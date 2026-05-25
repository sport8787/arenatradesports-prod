import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Check, AlertTriangle, X, Minus, ShieldAlert } from 'lucide-react';
import type { Match } from '@/components/dashboard/MatchCard';
import { computeCriteria, getCriteriaSummary, type CriteriaState } from '@/lib/matchCriteria';

interface CriteriaDetailModalProps {
  match: Match | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const stateMeta: Record<CriteriaState, { color: string; bg: string; border: string; icon: JSX.Element; label: string }> = {
  green: {
    color: 'text-[#4ADE80]',
    bg: 'bg-[#14532D]/40',
    border: 'border-[#22C55E]/50',
    icon: <Check className="w-4 h-4" />,
    label: 'OK',
  },
  yellow: {
    color: 'text-[#FBBF24]',
    bg: 'bg-[#713F12]/40',
    border: 'border-[#F59E0B]/50',
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Atenção',
  },
  red: {
    color: 'text-[#F87171]',
    bg: 'bg-[#7F1D1D]/40',
    border: 'border-[#EF4444]/50',
    icon: <X className="w-4 h-4" />,
    label: 'Vetado',
  },
  gray: {
    color: 'text-muted-foreground',
    bg: 'bg-muted/20',
    border: 'border-border',
    icon: <Minus className="w-4 h-4" />,
    label: 'Sem dados',
  },
};

export default function CriteriaDetailModal({ match, open, onOpenChange }: CriteriaDetailModalProps) {
  if (!match) return null;
  const criteria = computeCriteria(match);
  const { greens, eliminatoryFailed, vetoSummary } = getCriteriaSummary(criteria);
  const isImminent = !eliminatoryFailed && greens >= 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-orbitron uppercase tracking-wider text-base">
            🎯 Critérios B1–B5 · {match.home} vs {match.away}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {match.minute}' · {match.championship} · placar {match.scoreHome}–{match.scoreAway}
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div
          className={cn(
            'rounded-lg border p-3 flex items-center justify-between gap-3',
            eliminatoryFailed
              ? 'border-destructive/40 bg-destructive/10'
              : isImminent
                ? 'border-[#F59E0B]/50 bg-[#713F12]/30'
                : greens === 5
                  ? 'border-[#22C55E]/60 bg-[#14532D]/30'
                  : 'border-border bg-muted/20',
          )}
        >
          <div>
            <div className="text-2xl font-orbitron font-bold text-foreground">{greens}/5</div>
            <div className="text-xs text-muted-foreground">
              {eliminatoryFailed
                ? `Veto eliminatório${vetoSummary ? ` — ${vetoSummary}` : ''}`
                : greens === 5
                  ? '⚡ APROVADO LABAREDAS — entrada forte'
                  : isImminent
                    ? '⚠️ Entrada iminente — acompanhar'
                    : greens >= 2
                      ? 'Em formação'
                      : 'Sem oportunidade no momento'}
            </div>
          </div>
          {eliminatoryFailed && (
            <ShieldAlert className="w-8 h-8 text-destructive shrink-0" />
          )}
        </div>

        {/* Lista de critérios */}
        <div className="space-y-2">
          {criteria.map((c) => {
            const meta = stateMeta[c.state];
            return (
              <div
                key={c.key}
                className={cn('rounded-lg border p-3 space-y-1.5', meta.bg, meta.border)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn('shrink-0', meta.color)}>{meta.icon}</span>
                    <div>
                      <div className="font-orbitron text-sm font-bold text-foreground">
                        {c.label}
                        {c.eliminatory && (
                          <span className="ml-2 text-[10px] uppercase tracking-wider text-destructive">
                            eliminatório
                          </span>
                        )}
                      </div>
                      <div className={cn('text-xs font-semibold', meta.color)}>
                        {meta.label} — {c.detail}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed pl-6">{c.description}</p>
                <div className="text-[10px] font-mono text-muted-foreground/80 pl-6">
                  📊 dado: <span className="text-foreground/80">{c.source}</span>
                </div>
                {c.vetoReason && (
                  <div className={cn('text-[11px] pl-6 font-medium', meta.color)}>
                    ↳ {c.vetoReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-[11px] text-muted-foreground border-t border-border pt-3 leading-relaxed">
          <strong className="text-foreground">Como ler:</strong> 5/5 verde = APROVADO LABAREDAS (entrada forte).
          4/5 = APROVADO (entrada iminente, fique atento). Qualquer eliminatório vermelho (B1, B2 ou B4) veta o entrada independente dos demais.
          B3 e B5 qualificam mas não vetam sozinhos.
        </div>
      </DialogContent>
    </Dialog>
  );
}
