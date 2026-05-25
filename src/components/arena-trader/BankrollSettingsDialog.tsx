import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import GoldButton from '@/components/game/GoldButton';
import { Wallet, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface BankrollSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  onSave: (newBalance: number) => Promise<{ success: boolean; error?: string }>;
}

const PRESETS = [200, 500, 1000, 2000, 5000, 10000];

export default function BankrollSettingsDialog({ isOpen, onClose, currentBalance, onSave }: BankrollSettingsDialogProps) {
  const [selected, setSelected] = useState<string>(String(currentBalance));
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);

  const isCustom = !PRESETS.includes(Number(selected));
  const finalValue = selected === 'custom' ? Number(custom) : Number(selected);

  const handleSave = async () => {
    if (!finalValue || finalValue < 100) {
      toast.error('Valor mínimo: R$ 100');
      return;
    }
    setSaving(true);
    const result = await onSave(finalValue);
    setSaving(false);
    if (result.success) {
      toast.success(`Banca definida: R$ ${finalValue.toLocaleString('pt-BR')}`);
      onClose();
    } else {
      toast.error(result.error || 'Erro ao salvar');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-orbitron flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Definir Banca Virtual
          </DialogTitle>
          <DialogDescription>
            Escolha o valor inicial da sua banca virtual. Isso irá resetar todas as estatísticas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RadioGroup value={selected} onValueChange={setSelected} className="grid grid-cols-3 gap-2">
            {PRESETS.map(v => (
              <div key={v}>
                <RadioGroupItem value={String(v)} id={`preset-${v}`} className="peer sr-only" />
                <Label
                  htmlFor={`preset-${v}`}
                  className="flex items-center justify-center rounded-lg border-2 border-border bg-secondary/30 p-3 cursor-pointer font-orbitron text-sm transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary hover:border-muted-foreground"
                >
                  R$ {v.toLocaleString('pt-BR')}
                </Label>
              </div>
            ))}
            <div>
              <RadioGroupItem value="custom" id="preset-custom" className="peer sr-only" />
              <Label
                htmlFor="preset-custom"
                className="flex items-center justify-center rounded-lg border-2 border-border bg-secondary/30 p-3 cursor-pointer font-orbitron text-sm transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 peer-data-[state=checked]:text-primary hover:border-muted-foreground"
              >
                Outro
              </Label>
            </div>
          </RadioGroup>

          {selected === 'custom' && (
            <div className="space-y-1.5">
              <Label htmlFor="custom-value" className="text-xs text-muted-foreground">Valor personalizado (R$)</Label>
              <Input
                id="custom-value"
                type="number"
                min={100}
                placeholder="Ex: 3000"
                value={custom}
                onChange={e => setCustom(e.target.value)}
                className="font-orbitron"
              />
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <p className="text-xs text-warning">
              Ao redefinir a banca, todas as estatísticas (win rate, green/red, ROI) serão zeradas. Entradas pendentes não serão afetadas.
            </p>
          </div>
        </div>

        <DialogFooter>
          <GoldButton variant="outline" size="sm" onClick={onClose}>Cancelar</GoldButton>
          <GoldButton size="sm" onClick={handleSave} disabled={saving || (selected === 'custom' && (!custom || Number(custom) < 100))}>
            {saving ? 'Salvando...' : 'Confirmar'}
          </GoldButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
