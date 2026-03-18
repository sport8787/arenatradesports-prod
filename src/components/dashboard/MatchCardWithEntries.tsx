import { useState } from 'react';
import MatchCard, { type Match } from './MatchCard';
import EntryRow from './EntryRow';
import NewEntryModal, { type EntryFormData } from './NewEntryModal';
import { useFixtureEntries } from '@/hooks/useFixtureEntries';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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
  const { entries, totalStakePct, gamePnL, addEntry, markGreen, markRed, markCashout } =
    useFixtureEntries(fixtureId, userId);

  const [showNewEntry, setShowNewEntry] = useState(false);
  const [cashoutEntry, setCashoutEntry] = useState<{ id: string; stakeValue: number } | null>(null);
  const [cashoutValue, setCashoutValue] = useState('');

  const handleConfirmEntry = async (form: EntryFormData) => {
    if (!userId) return;
    const ok = await addEntry({
      user_id: userId,
      fixture_id: fixtureId,
      fixture_label: `${match.home} vs ${match.away}`,
      minute_entered: form.minute,
      plano: form.plano,
      market: form.market,
      odd: form.odd,
      stake_value: form.stakeValue,
      stake_pct: form.stakePct,
    });
    if (ok) setShowNewEntry(false);
  };

  const handleCashoutConfirm = async () => {
    if (!cashoutEntry || !cashoutValue) return;
    await markCashout(cashoutEntry.id, parseFloat(cashoutValue), cashoutEntry.stakeValue);
    setCashoutEntry(null);
    setCashoutValue('');
  };

  const hasEntries = entries.length > 0;

  return (
    <div className="relative">
      <MatchCard match={match} index={index} onAnalysisClick={onAnalysisClick} />

      {/* Entries Timeline - overlays below the card */}
      {hasEntries && (
        <div className="mx-0.5 -mt-1 rounded-b-xl border-2 border-t-0 border-border/50 bg-[hsl(0,0%,7%)] px-3 py-2 space-y-1.5">
          {/* Header */}
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
            </span>
          </div>

          {/* Entry rows */}
          {entries.map((entry, i) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              index={i + 1}
              onMarkGreen={(e) => markGreen(e.id, Number(e.odd), Number(e.stake_value))}
              onMarkRed={(e) => markRed(e.id, Number(e.stake_value))}
              onMarkCashout={(e) => {
                setCashoutEntry({ id: e.id, stakeValue: Number(e.stake_value) });
                setCashoutValue('');
              }}
            />
          ))}

          {/* Add entry button */}
          {totalStakePct < 8 && userId && (
            <button
              onClick={() => setShowNewEntry(true)}
              className="w-full text-[11px] font-orbitron text-[hsl(45,93%,47%)] hover:text-[hsl(45,93%,57%)] py-1 flex items-center justify-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" /> Registrar nova entrada
            </button>
          )}
        </div>
      )}

      {/* Add entry button when no entries yet - small subtle link */}
      {!hasEntries && userId && match.status === 'live' && (
        <div className="mx-0.5 -mt-1 rounded-b-xl border-2 border-t-0 border-border/30 bg-[hsl(0,0%,7%)] px-3 py-1.5">
          <button
            onClick={() => setShowNewEntry(true)}
            className="w-full text-[10px] font-orbitron text-muted-foreground hover:text-[hsl(45,93%,47%)] py-0.5 flex items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" /> Registrar entrada
          </button>
        </div>
      )}

      {/* New Entry Modal */}
      <NewEntryModal
        open={showNewEntry}
        onClose={() => setShowNewEntry(false)}
        onConfirm={handleConfirmEntry}
        fixtureLabel={`${match.home} vs ${match.away}`}
        currentMinute={match.minute}
        bankrollBalance={bankrollBalance}
        currentStakePct={totalStakePct}
      />

      {/* Cashout Modal */}
      <Dialog open={!!cashoutEntry} onOpenChange={(v) => !v && setCashoutEntry(null)}>
        <DialogContent className="sm:max-w-xs bg-[hsl(0,0%,8%)] border-border">
          <DialogHeader>
            <DialogTitle className="font-orbitron text-sm">Cashout</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
