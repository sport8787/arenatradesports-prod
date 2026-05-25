import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Play } from 'lucide-react';
import type {
  SessionConfig, TableType, DeckCount, Penetration, LiveBettingSystem,
} from '@/lib/blackjack/live/liveTypes';

interface Props {
  onStart: (cfg: SessionConfig) => void;
}

export default function SessionSetup({ onStart }: Props) {
  const [tableType, setTableType] = useState<TableType>('classic');
  const [decks, setDecks] = useState<DeckCount>(6);
  const [penetration, setPenetration] = useState<Penetration>(0.75);
  const [baseBet, setBaseBet] = useState(5);
  const [initialBankroll, setInitialBankroll] = useState(200);
  const [bettingSystem, setBettingSystem] = useState<LiveBettingSystem>('martingale');
  const [maxRedStreak, setMaxRedStreak] = useState(4);

  const Toggle = <T extends string | number>({ value, current, set, label }: {
    value: T; current: T; set: (v: T) => void; label: string;
  }) => (
    <button
      type="button"
      onClick={() => set(value)}
      className={`px-3 py-2 rounded-md text-sm font-medium border transition-all ${
        current === value
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-secondary text-foreground border-border hover:border-primary/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Configuração da Sessão Ao Vivo</CardTitle>
        <p className="text-sm text-muted-foreground">Defina os parâmetros da mesa antes de começar a contar.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="mb-2 block">Tipo de mesa</Label>
          <div className="flex gap-2">
            <Toggle<TableType> value="classic" current={tableType} set={setTableType} label="Clássica (7 posições)" />
            <Toggle<TableType> value="infinity" current={tableType} set={setTableType} label="Infinity (ilimitada)" />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Número de decks</Label>
          <div className="flex gap-2">
            {[4, 6, 8].map(d => (
              <Toggle<DeckCount> key={d} value={d as DeckCount} current={decks} set={setDecks} label={`${d}D`} />
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Penetração do shoe</Label>
          <div className="flex gap-2 flex-wrap">
            <Toggle<Penetration> value={0.60} current={penetration} set={setPenetration} label="Conservadora · 60%" />
            <Toggle<Penetration> value={0.75} current={penetration} set={setPenetration} label="Média · 75%" />
            <Toggle<Penetration> value={0.85} current={penetration} set={setPenetration} label="Profunda · 85%" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bb" className="mb-2 block">Entrada base (R$)</Label>
            <Input id="bb" type="number" min={1} step={1} value={baseBet} onChange={e => setBaseBet(Math.max(1, +e.target.value || 0))} />
          </div>
          <div>
            <Label htmlFor="bk" className="mb-2 block">Banca inicial (R$)</Label>
            <Input id="bk" type="number" min={1} step={1} value={initialBankroll} onChange={e => setInitialBankroll(Math.max(1, +e.target.value || 0))} />
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Sistema de gestão</Label>
          <div className="flex gap-2 flex-wrap">
            <Toggle<LiveBettingSystem> value="martingale" current={bettingSystem} set={setBettingSystem} label="Martingale Conservador" />
            <Toggle<LiveBettingSystem> value="kelly" current={bettingSystem} set={setBettingSystem} label="Kelly" />
            <Toggle<LiveBettingSystem> value="hybrid" current={bettingSystem} set={setBettingSystem} label="Híbrido" />
          </div>
        </div>

        <div>
          <Label htmlFor="mrs" className="mb-2 block">Limite de reds consecutivos antes de pausar</Label>
          <Input id="mrs" type="number" min={2} max={10} value={maxRedStreak} onChange={e => setMaxRedStreak(Math.max(2, Math.min(10, +e.target.value || 4)))} />
        </div>

        <div className="flex items-center justify-between pt-2">
          <Badge variant="outline">{decks * 52} cartas no shoe</Badge>
          <Button onClick={() => onStart({
            tableType, decks, penetration, baseBet, bettingSystem,
            initialBankroll, maxRedStreak,
          })}>
            <Play className="h-4 w-4 mr-2" /> Iniciar Sessão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
