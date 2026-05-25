import { useState } from 'react';
import MatchCard, { type Match } from './MatchCard';
import EntryRow from './EntryRow';
import SignalHealthPanel from './SignalHealthPanel';
import { useFixtureEntries } from '@/hooks/useFixtureEntries';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { estimateLiveOdd, extrairLinha, extrairTipo } from '@/lib/estimateLiveOdd';
import { toast } from 'sonner';

interface MatchCardWithEntriesProps {
  match: Match;
  index: number;
  userId?: string;
  bankrollBalance?: number;
  onAnalysisClick?: (matchId: string) => void;
}

export default function MatchCardWithEntries({
  match,
  index,
  userId,
  bankrollBalance = 500,
  onAnalysisClick,
}: MatchCardWithEntriesProps) {
  const fixtureId = match.matchId || match.id;

  const matchContext = {
    minute: match.minute,
    scoreHome: match.scoreHome,
    scoreAway: match.scoreAway,
  };

  const { entries, totalStakePct, gamePnL, addEntry, markGreen, markRed, markCashout } =
    useFixtureEntries(fixtureId, userId, matchContext);

  const [stakeStr, setStakeStr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cashoutEntry, setCashoutEntry] = useState<{ id: string; stakeValue: number; estimatedCashout: number | null } | null>(null);
  const [cashoutValue, setCashoutValue] = useState('');

  const inheritedMarket = match.market || null;
  const inheritedPlano = match.planName || 'SITUACIONAL';
  const oddPre = match.approvalOdd ?? undefined;

  const handleConfirm = async () => {
    if (!userId) {
      toast.error('Faça login para apostar');
      return;
    }
    if (!inheritedMarket) {
      toast.error('Aguardando entrada aprovado para este jogo');
      return;
    }
    const stakeValue = parseFloat(stakeStr.replace(',', '.'));
    if (!stakeValue || stakeValue <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (bankrollBalance > 0 && stakeValue > bankrollBalance) {
      toast.error('Valor acima do saldo da banca virtual');
      return;
    }

    setSubmitting(true);
    try {
      let odd: number | null = null;
      let source = 'estimated';
      try {
        const { data } = await supabase.functions.invoke('futodds-live-odd', {
          body: {
            fixture_id: match.matchId || match.id,
            home: match.home,
            away: match.away,
            market: inheritedMarket,
          },
        });
        if (data?.odd && data.odd > 1.01) {
          odd = Number(data.odd);
          source = data.source || 'live';
        }
      } catch (_) { /* fallback */ }

      if (!odd) {
        try {
          const { data } = await supabase.functions.invoke('fetch-sportmonks-live-odd', {
            body: { fixture_id: match.matchId || match.id, market: inheritedMarket },
          });
          if (data?.odd && data.odd > 1.01) {
            odd = Number(data.odd);
            source = data.source || 'live';
          }
        } catch (_) { /* fallback estimador abaixo */ }
      }

      // 2. Fallback: estimador Poisson
      if (!odd) {
        const linha = extrairLinha(inheritedMarket);
        const tipo = extrairTipo(inheritedMarket);
        if (linha != null && tipo) {
          odd = estimateLiveOdd({
            oddPre,
            linha,
            minuto: match.minute,
            golsAtuais: (match.scoreHome || 0) + (match.scoreAway || 0),
            tipo,
          });
        } else {
          odd = oddPre || 1.85;
        }
      }

      const stakePct = bankrollBalance > 0
        ? Math.min(8, Math.round((stakeValue / bankrollBalance) * 1000) / 10)
        : 2;

      const ok = await addEntry({
        user_id: userId,
        fixture_id: fixtureId,
        fixture_label: `${match.home} vs ${match.away}`,
        minute_entered: match.minute,
        plano: inheritedPlano,
        market: inheritedMarket,
        odd,
        stake_value: parseFloat(stakeValue.toFixed(2)),
        stake_pct: stakePct,
        odd_source: source,
      } as any);

      if (ok) {
        toast.success(`Entrada confirmada @ ${odd.toFixed(2)}`);
        setStakeStr('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCashoutConfirm = async () => {
    if (!cashoutEntry || !cashoutValue) return;
    await markCashout(cashoutEntry.id, parseFloat(cashoutValue), cashoutEntry.stakeValue);
    setCashoutEntry(null);
    setCashoutValue('');
  };

  const hasEntries = entries.length > 0;
  const hasPendingEntries = entries.some(e => e.status === 'pending');
  const canBet =
    !!userId &&
    match.status === 'live' &&
    !!inheritedMarket &&
    totalStakePct < 8;

  return (
    <div className="relative">
      <MatchCard match={match} index={index} onAnalysisClick={onAnalysisClick} />

      {/* Saúde do Entrada — só renderiza se tiver mercado aprovado e jogo ao vivo */}
      {match.status === 'live' && inheritedMarket && (
        <SignalHealthPanel market={inheritedMarket} stats={match.healthStats ?? null} />
      )}
      {/* Entries list */}
      {hasEntries && (
        <div className="mx-0.5 -mt-1 rounded-b-xl border-2 border-t-0 border-border/50 bg-[hsl(0,0%,7%)] px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-orbitron text-muted-foreground uppercase tracking-wider">
              {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
            </span>
            <span
              className={cn(
                'text-xs font-orbitron font-bold',
                gamePnL >= 0 ? 'text-[hsl(142,71%,45%)]' : 'text-[hsl(0,84%,60%)]'
              )}
            >
              {gamePnL >= 0 ? '+' : ''}R$ {Math.abs(gamePnL).toFixed(2)}
              {hasPendingEntries && (
                <span className="ml-1 text-[9px] text-muted-foreground/70 font-normal">EST</span>
              )}
            </span>
          </div>

          {entries.map((entry, i) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              index={i + 1}
              onMarkGreen={(e) => markGreen(e.id, Number(e.odd), Number(e.stake_value))}
              onMarkRed={(e) => markRed(e.id, Number(e.stake_value))}
              onMarkCashout={(e) => {
                const estimated = e.estimatedCashout ?? null;
                setCashoutEntry({ id: e.id, stakeValue: Number(e.stake_value), estimatedCashout: estimated });
                setCashoutValue(estimated ? estimated.toFixed(2) : '');
              }}
            />
          ))}
        </div>
      )}

      {/* Inline Betfair-style bet bar */}
      {canBet && (
        <div
          className={cn(
            'mx-0.5 -mt-1 rounded-b-xl border-2 border-t-0 border-border/50 bg-[hsl(0,0%,7%)] px-3 py-2',
            !hasEntries && 'rounded-b-xl',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-[9px] font-orbitron text-muted-foreground uppercase tracking-wider mb-0.5">
                {inheritedMarket}
              </div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                placeholder="R$ 0,00"
                value={stakeStr}
                onChange={(e) => setStakeStr(e.target.value)}
                disabled={submitting}
                className="h-9 text-sm font-orbitron"
              />
            </div>
            <Button
              onClick={handleConfirm}
              disabled={submitting || !stakeStr || parseFloat(stakeStr.replace(',', '.')) <= 0}
              className="h-9 self-end font-orbitron text-[11px] uppercase tracking-wider bg-primary hover:bg-primary/90 px-3"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirmar'}
            </Button>
          </div>
          <div className="text-[9px] text-muted-foreground/70 mt-1 text-right">
            Saldo: R$ {bankrollBalance.toFixed(2)} • Stake total no jogo: {totalStakePct.toFixed(1)}%
          </div>
        </div>
      )}

      {/* Sem entrada aprovado ainda */}
      {!canBet && match.status === 'live' && userId && !inheritedMarket && (
        <div className="mx-0.5 -mt-1 rounded-b-xl border-2 border-t-0 border-border/30 bg-[hsl(0,0%,7%)] px-3 py-1.5">
          <p className="text-[10px] text-center text-muted-foreground/70 font-orbitron uppercase tracking-wider">
            Aguardando entrada do Mycroft
          </p>
        </div>
      )}

      {/* Cashout Modal */}
      <Dialog open={!!cashoutEntry} onOpenChange={(v) => !v && setCashoutEntry(null)}>
        <DialogContent className="sm:max-w-xs bg-[hsl(0,0%,8%)] border-border">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-sm">Cashout</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {cashoutEntry?.estimatedCashout != null && (
              <div className={cn(
                'text-xs p-2 rounded-lg border',
                cashoutEntry.estimatedCashout >= cashoutEntry.stakeValue
                  ? 'bg-[hsl(142,71%,45%)]/10 border-[hsl(142,71%,45%)]/30 text-[hsl(142,71%,45%)]'
                  : 'bg-[hsl(0,84%,60%)]/10 border-[hsl(0,84%,60%)]/30 text-[hsl(0,84%,60%)]'
              )}>
                <span className="text-muted-foreground">Valor estimado: </span>
                <span className="font-bold font-orbitron">R$ {cashoutEntry.estimatedCashout.toFixed(2)}</span>
                <span className="text-[9px] text-muted-foreground/70 ml-1">EST</span>
              </div>
            )}
            <div>
              <Label className="text-xs">Valor recebido no cashout (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={cashoutValue}
                onChange={(e) => setCashoutValue(e.target.value)}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <Button
              onClick={handleCashoutConfirm}
              disabled={!cashoutValue || parseFloat(cashoutValue) <= 0}
              className="w-full font-orbitron text-xs"
            >
              Confirmar Cashout
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
