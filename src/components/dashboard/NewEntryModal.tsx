import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NewEntryModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (form: EntryFormData) => void;
  fixtureLabel: string;
  currentMinute: number;
  bankrollBalance: number;
  currentStakePct: number; // total % already committed in this fixture
}

export interface EntryFormData {
  minute: number;
  plano: string;
  market: string;
  odd: number;
  stakePct: number;
  stakeValue: number;
}

const PLANO_OPTIONS = ['APROVADO', 'SITUACIONAL', 'LABAREDA', 'CUIDADO', 'MANUAL'];

export default function NewEntryModal({
  open,
  onClose,
  onConfirm,
  fixtureLabel,
  currentMinute,
  bankrollBalance,
  currentStakePct,
}: NewEntryModalProps) {
  const [minute, setMinute] = useState(currentMinute);
  const [plano, setPlano] = useState('SITUACIONAL');
  const [market, setMarket] = useState('');
  const [odd, setOdd] = useState('');
  const [stakePct, setStakePct] = useState(2);

  const stakeValue = (bankrollBalance * stakePct) / 100;
  const totalAfter = currentStakePct + stakePct;
  const overLimit = totalAfter > 8;
  const canSubmit = market.trim() !== '' && odd !== '' && parseFloat(odd) > 1 && !overLimit;

  const handleConfirm = () => {
    onConfirm({
      minute,
      plano,
      market: market.trim(),
      odd: parseFloat(odd),
      stakePct,
      stakeValue: parseFloat(stakeValue.toFixed(2)),
    });
    // Reset
    setMarket('');
    setOdd('');
    setStakePct(2);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md bg-[hsl(0,0%,8%)] border-border">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-sm">Registrar Entrada</DialogTitle>
          <p className="text-xs text-muted-foreground">{fixtureLabel}</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Minuto</Label>
              <Input
                type="number"
                min={0}
                max={120}
                value={minute}
                onChange={(e) => setMinute(parseInt(e.target.value) || 0)}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Plano</Label>
              <Select value={plano} onValueChange={setPlano}>
                <SelectTrigger className="mt-1 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANO_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Mercado</Label>
            <Input
              placeholder="Ex: Over 2.5 Total, Back Barcelona..."
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">Odd</Label>
            <Input
              type="number"
              step="0.01"
              min="1.01"
              placeholder="1.80"
              value={odd}
              onChange={(e) => setOdd(e.target.value)}
              className="mt-1 h-9 text-sm"
            />
          </div>

          <div>
            <Label className="text-xs">
              Stake: {stakePct}% = R$ {stakeValue.toFixed(2)}
            </Label>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[stakePct]}
              onValueChange={(v) => setStakePct(v[0])}
              className="mt-2"
            />
          </div>

          <div
            className={cn(
              'text-xs p-2 rounded-md border',
              overLimit
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border bg-muted/30 text-muted-foreground'
            )}
          >
            Stake total neste jogo: {totalAfter.toFixed(0)}%
            {overLimit && <span className="font-bold ml-1">— Acima do limite de 8%</span>}
          </div>

          <Button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className="w-full font-orbitron text-xs uppercase tracking-wider bg-primary hover:bg-primary/90"
          >
            Confirmar Entrada
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
