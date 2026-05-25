// ══════════════════════════════════════════════════════════
// BETTING SYSTEM SELECTOR - Seletor de modo de entradas
// ══════════════════════════════════════════════════════════

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BettingMode, 
  BettingConfig,
  simulateBetting
} from '@/lib/hybrid-betting-system';

interface BettingSystemSelectorProps {
  initialBankroll: number;
  baseUnit: number;
  increment: number;
  maxBet: number;
  stopLoss: number;
  stopWin: number;
  onConfigChange: (mode: BettingMode, kellyFraction: 0.25 | 0.5 | 1.0) => void;
}

export function BettingSystemSelector({ 
  initialBankroll,
  baseUnit,
  increment,
  maxBet,
  stopLoss,
  stopWin,
  onConfigChange 
}: BettingSystemSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<BettingMode>('hybrid');
  const [kellyFraction, setKellyFraction] = useState<0.25 | 0.5 | 1.0>(0.5);
  const [showSimulation, setShowSimulation] = useState(false);

  const handleModeSelect = (mode: BettingMode) => {
    setSelectedMode(mode);
    onConfigChange(mode, kellyFraction);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-orbitron">🎯 Sistema de Gestão de Banca</CardTitle>
        <CardDescription className="text-xs">
          Escolha a estratégia de entradas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={selectedMode} onValueChange={(v) => handleModeSelect(v as BettingMode)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="hybrid" className="text-xs">Híbrido 🧠</TabsTrigger>
            <TabsTrigger value="kelly_half" className="text-xs">Kelly 📊</TabsTrigger>
            <TabsTrigger value="martingale" className="text-xs">Martingale 📈</TabsTrigger>
          </TabsList>

          {/* HÍBRIDO */}
          <TabsContent value="hybrid" className="space-y-3">
            <Alert className="border-primary/30 bg-primary/5">
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="text-[10px]">RECOMENDADO</Badge>
                    <span className="font-bold text-xs">Sistema Inteligente Adaptativo</span>
                  </div>
                  
                  <div className="text-[11px] space-y-1.5">
                    <div className="flex items-start gap-1.5">
                      <span>🛡️</span>
                      <div>
                        <span className="font-semibold">TC ≤ -1:</span> Entrada mínima (proteção)
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>📈</span>
                      <div>
                        <span className="font-semibold">TC 0 a +1:</span> Martingale conservador
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span>🚀</span>
                      <div>
                        <span className="font-semibold">TC ≥ +2:</span> Kelly Criterion (ataque)
                      </div>
                    </div>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* KELLY */}
          <TabsContent value="kelly_half" className="space-y-3">
            <Alert className="border-accent/30 bg-accent/5">
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">AVANÇADO</Badge>
                    <span className="font-bold text-xs">Critério de Kelly</span>
                  </div>
                  
                  <p className="text-[11px] text-muted-foreground">
                    Entrada proporcional à vantagem matemática.
                  </p>

                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { val: 0.25 as const, label: 'Quarter', desc: 'Conservador' },
                      { val: 0.5 as const, label: 'Half', desc: 'Balanceado' },
                      { val: 1.0 as const, label: 'Full', desc: 'Agressivo' },
                    ]).map(k => (
                      <Button
                        key={k.val}
                        variant={kellyFraction === k.val ? "default" : "outline"}
                        size="sm"
                        className="flex-col h-auto py-2 text-[10px]"
                        onClick={() => {
                          setKellyFraction(k.val);
                          const modeMap = { 0.25: 'kelly_quarter', 0.5: 'kelly_half', 1.0: 'kelly_full' } as const;
                          setSelectedMode(modeMap[k.val]);
                          onConfigChange(modeMap[k.val], k.val);
                        }}
                      >
                        <span className="font-bold">{k.label}</span>
                        <span className="text-[9px] opacity-70">{k.desc}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </TabsContent>

          {/* MARTINGALE */}
          <TabsContent value="martingale" className="space-y-3">
            <Alert className="border-[hsl(var(--warning)_/_0.3)] bg-[hsl(var(--warning)_/_0.05)]">
              <AlertDescription>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">SIMPLES</Badge>
                    <span className="font-bold text-xs">Martingale Conservador</span>
                  </div>
                  
                  <div className="bg-secondary/50 p-2 rounded font-mono text-[10px]">
                    R$5 ❌ → R$7 ❌ → R$9 ❌ → R$11 ✅ → R$9 ✅ → R$7 ✅ → R$5
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    💡 Funciona melhor quando combinado com contagem (use Híbrido)
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Simulação */}
        <div className="pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => setShowSimulation(!showSimulation)}
          >
            {showSimulation ? 'Ocultar' : 'Ver'} Simulação 1000 Mãos
          </Button>

          {showSimulation && (
            <SimulationDisplay
              config={{
                mode: selectedMode,
                baseUnit,
                bankroll: initialBankroll,
                initialBankroll,
                increment,
                maxBet,
                kellyFraction,
                stopLoss,
                stopWin
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══ COMPONENTE DE SIMULAÇÃO ═══

function SimulationDisplay({ config }: { config: BettingConfig }) {
  const generateTCDistribution = (hands: number): number[] => {
    const distribution: number[] = [];
    for (let i = 0; i < hands; i++) {
      const random = Math.random();
      if (random < 0.05) distribution.push(-3);
      else if (random < 0.15) distribution.push(-2);
      else if (random < 0.30) distribution.push(-1);
      else if (random < 0.50) distribution.push(0);
      else if (random < 0.70) distribution.push(1);
      else if (random < 0.85) distribution.push(2);
      else if (random < 0.95) distribution.push(3);
      else if (random < 0.98) distribution.push(4);
      else distribution.push(5);
    }
    return distribution;
  };

  const tcDist = generateTCDistribution(1000);
  const result = simulateBetting(config, 1000, tcDist);

  const getRiskColor = (roi: number) => {
    if (roi >= 20) return 'text-[hsl(var(--success))]';
    if (roi >= 10) return 'text-primary';
    if (roi >= 0) return 'text-[hsl(var(--warning))]';
    return 'text-[hsl(var(--destructive))]';
  };

  return (
    <Card className="mt-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Resultado da Simulação</CardTitle>
        <CardDescription className="text-[10px]">1000 mãos com distribuição realista de TCs</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] text-muted-foreground">Banca Final</div>
            <div className="text-lg font-bold font-orbitron">R$ {result.finalBankroll.toFixed(0)}</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Lucro</div>
            <div className={`text-lg font-bold font-orbitron ${getRiskColor(result.roi)}`}>
              {result.profit >= 0 ? '+' : ''}R$ {result.profit.toFixed(0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-[10px]">
          <div>
            <div className="text-muted-foreground">ROI</div>
            <div className={`font-bold ${getRiskColor(result.roi)}`}>{result.roi.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Win Rate</div>
            <div className="font-bold">{result.winRate.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Drawdown</div>
            <div className="font-bold text-[hsl(var(--destructive))]">-{result.maxDrawdownPercent.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-muted-foreground">Maior Entrada</div>
            <div className="font-bold">R${result.largestBet.toFixed(0)}</div>
          </div>
        </div>

        {config.mode === 'hybrid' && (
          <div className="pt-2 border-t border-border text-[10px] space-y-1">
            <div className="font-semibold">Distribuição de Modos:</div>
            <div className="flex justify-between">
              <span>🛡️ Proteção</span>
              <span className="font-mono">{result.protectiveSuggestions} ({((result.protectiveSuggestions / result.totalHands) * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex justify-between">
              <span>📈 Recuperação</span>
              <span className="font-mono">{result.martingaleSuggestions} ({((result.martingaleSuggestions / result.totalHands) * 100).toFixed(0)}%)</span>
            </div>
            <div className="flex justify-between">
              <span>🚀 Ataque</span>
              <span className="font-mono">{result.kellySuggestions} ({((result.kellySuggestions / result.totalHands) * 100).toFixed(0)}%)</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
