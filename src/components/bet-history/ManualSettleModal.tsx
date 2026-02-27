import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ManualSettleModalProps {
  open: boolean;
  onClose: () => void;
  bet: {
    id: string;
    match_name: string;
    market: string;
    odd: number;
    stake: number;
    source: 'sports' | 'punter';
  } | null;
  onSettle: (data: {
    betId: string;
    scoreHome: number;
    scoreAway: number;
    redCardHome: boolean;
    redCardAway: boolean;
    source: 'sports' | 'punter';
  }) => Promise<void>;
}

export default function ManualSettleModal({ open, onClose, bet, onSettle }: ManualSettleModalProps) {
  const [scoreHome, setScoreHome] = useState('');
  const [scoreAway, setScoreAway] = useState('');
  const [redCardHome, setRedCardHome] = useState(false);
  const [redCardAway, setRedCardAway] = useState(false);
  const [settling, setSettling] = useState(false);

  if (!bet) return null;

  const teams = bet.match_name.split(' vs ');
  const homeTeam = teams[0] || 'Casa';
  const awayTeam = teams[1] || 'Fora';

  const h = parseInt(scoreHome);
  const a = parseInt(scoreAway);
  const hasScore = !isNaN(h) && !isNaN(a) && h >= 0 && a >= 0;

  // Preview result
  let previewResult: 'green' | 'red' | null = null;
  if (hasScore) {
    const market = bet.market.toLowerCase();
    const totalGoals = h + a;
    if (market === 'casa' || market === 'home' || market === '1') {
      previewResult = h > a ? 'green' : 'red';
    } else if (market === 'fora' || market === 'away' || market === '2') {
      previewResult = a > h ? 'green' : 'red';
    } else if (market === 'empate' || market === 'draw' || market === 'x') {
      previewResult = h === a ? 'green' : 'red';
    } else if (market.includes('over')) {
      const line = parseFloat(market.replace(/[^0-9.]/g, '')) || 2.5;
      previewResult = totalGoals > line ? 'green' : 'red';
    } else if (market.includes('under')) {
      const line = parseFloat(market.replace(/[^0-9.]/g, '')) || 2.5;
      previewResult = totalGoals < line ? 'green' : 'red';
    } else if (market.includes('btts') || market.includes('ambas')) {
      previewResult = h > 0 && a > 0 ? 'green' : 'red';
    }
  }

  const previewProfit = previewResult === 'green'
    ? +(bet.stake * (bet.odd - 1)).toFixed(2)
    : previewResult === 'red'
      ? -bet.stake
      : null;

  const handleSettle = async () => {
    if (!hasScore || !previewResult) return;
    setSettling(true);
    await onSettle({
      betId: bet.id,
      scoreHome: h,
      scoreAway: a,
      redCardHome,
      redCardAway,
      source: bet.source,
    });
    setSettling(false);
    setScoreHome('');
    setScoreAway('');
    setRedCardHome(false);
    setRedCardAway(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-orbitron text-primary text-sm">
            Liquidação Manual
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Match info */}
          <div className="bg-secondary/30 rounded-lg p-3 text-center">
            <p className="font-orbitron text-sm font-bold text-foreground">{bet.match_name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Mercado: <span className="text-foreground">{bet.market}</span> | Odd: <span className="text-foreground">{bet.odd.toFixed(2)}</span> | Stake: <span className="text-foreground">R$ {bet.stake.toFixed(2)}</span>
            </p>
          </div>

          {/* Score input */}
          <div className="flex items-center gap-3 justify-center">
            <div className="flex flex-col items-center gap-1 flex-1">
              <Label className="text-xs text-muted-foreground truncate max-w-full">{homeTeam}</Label>
              <Input
                type="number"
                min={0}
                value={scoreHome}
                onChange={e => setScoreHome(e.target.value)}
                className="text-center text-lg font-orbitron font-bold h-12"
                placeholder="0"
              />
            </div>
            <span className="text-muted-foreground font-orbitron text-lg mt-5">×</span>
            <div className="flex flex-col items-center gap-1 flex-1">
              <Label className="text-xs text-muted-foreground truncate max-w-full">{awayTeam}</Label>
              <Input
                type="number"
                min={0}
                value={scoreAway}
                onChange={e => setScoreAway(e.target.value)}
                className="text-center text-lg font-orbitron font-bold h-12"
                placeholder="0"
              />
            </div>
          </div>

          {/* Red card toggles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 bg-secondary/20 rounded-lg p-3">
              <Switch checked={redCardHome} onCheckedChange={setRedCardHome} />
              <Label className="text-xs text-muted-foreground">🟥 {homeTeam.substring(0, 12)}</Label>
            </div>
            <div className="flex items-center gap-2 bg-secondary/20 rounded-lg p-3">
              <Switch checked={redCardAway} onCheckedChange={setRedCardAway} />
              <Label className="text-xs text-muted-foreground">🟥 {awayTeam.substring(0, 12)}</Label>
            </div>
          </div>

          {/* Preview */}
          {hasScore && previewResult && (
            <div className={cn(
              "rounded-lg p-3 text-center border",
              previewResult === 'green' ? 'bg-success/10 border-success/30' : 'bg-destructive/10 border-destructive/30'
            )}>
              <div className="flex items-center justify-center gap-2">
                {previewResult === 'green' ? (
                  <CheckCircle2 className="w-5 h-5 text-success" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                )}
                <span className={cn(
                  "font-orbitron font-bold text-sm",
                  previewResult === 'green' ? 'text-success' : 'text-destructive'
                )}>
                  {previewResult === 'green' ? 'GREEN' : 'RED'} — {previewProfit! >= 0 ? '+' : ''}R$ {previewProfit!.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Placar: {h} × {a}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={settling}>Cancelar</Button>
          <Button
            onClick={handleSettle}
            disabled={!hasScore || !previewResult || settling}
            className={cn(
              "font-orbitron",
              previewResult === 'green' ? 'bg-success hover:bg-success/90' : 'bg-destructive hover:bg-destructive/90'
            )}
          >
            {settling ? 'Liquidando...' : 'Confirmar Liquidação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
