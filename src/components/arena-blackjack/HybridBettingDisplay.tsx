// ══════════════════════════════════════════════════════════
// HYBRID BETTING DISPLAY - Visualização em tempo real
// ══════════════════════════════════════════════════════════

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { BetRecommendation } from '@/lib/hybrid-betting-system';
import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  Zap,
  Activity,
  AlertTriangle
} from 'lucide-react';

interface HybridBettingDisplayProps {
  recommendation: BetRecommendation;
  bankroll: number;
  currentBet?: number;
}

export function HybridBettingDisplay({ 
  recommendation, 
  bankroll,
  currentBet 
}: HybridBettingDisplayProps) {
  
  const modeConfig = {
    protective: {
      icon: Shield,
      color: 'text-[hsl(var(--destructive))]',
      bgColor: 'bg-[hsl(var(--destructive)_/_0.05)]',
      borderColor: 'border-[hsl(var(--destructive)_/_0.3)]',
      label: 'PROTEÇÃO',
      emoji: '🛡️',
      description: 'Minimizando perdas em baralho desfavorável'
    },
    recovery: {
      icon: Activity,
      color: 'text-[hsl(var(--warning))]',
      bgColor: 'bg-[hsl(var(--warning)_/_0.05)]',
      borderColor: 'border-[hsl(var(--warning)_/_0.3)]',
      label: 'RECUPERAÇÃO',
      emoji: '📈',
      description: 'Progressão conservadora para recuperar gradualmente'
    },
    attack: {
      icon: Zap,
      color: 'text-[hsl(var(--success))]',
      bgColor: 'bg-[hsl(var(--success)_/_0.05)]',
      borderColor: 'border-[hsl(var(--success)_/_0.3)]',
      label: 'ATAQUE',
      emoji: '🚀',
      description: 'Capitalizando vantagem matemática'
    },
    standard: {
      icon: Activity,
      color: 'text-primary',
      bgColor: 'bg-primary/5',
      borderColor: 'border-primary/30',
      label: 'PADRÃO',
      emoji: '⚪',
      description: 'Sistema padrão ativo'
    }
  };

  const config = modeConfig[recommendation.system];
  const Icon = config.icon;

  const getRiskBadge = (risk: 'low' | 'medium' | 'high') => {
    const riskConfig = {
      low: { variant: 'default' as const, label: 'Risco Baixo' },
      medium: { variant: 'secondary' as const, label: 'Risco Moderado' },
      high: { variant: 'destructive' as const, label: 'Risco Alto' }
    };
    return riskConfig[risk];
  };

  const riskBadge = getRiskBadge(recommendation.risk);
  const betPercentage = (recommendation.amount / bankroll) * 100;

  return (
    <div className="space-y-3">
      {/* Header - Modo Ativo */}
      <Alert className={`${config.borderColor} ${config.bgColor}`}>
        <Icon className={`h-4 w-4 ${config.color}`} />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{config.emoji}</span>
              <div>
                <div className={`font-bold text-sm ${config.color}`}>
                  MODO {config.label}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {config.description}
                </div>
              </div>
            </div>
            <Badge variant={riskBadge.variant} className="text-[10px]">
              {riskBadge.label}
            </Badge>
          </div>
        </AlertDescription>
      </Alert>

      {/* Recomendação compacta */}
      <div className="text-center p-3 rounded-lg bg-secondary/30 border border-border">
        <div className="text-[10px] text-muted-foreground mb-1">Entrada Recomendada</div>
        <div className={`text-3xl font-orbitron font-bold ${config.color}`}>
          R$ {recommendation.amount.toFixed(2)}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1">
          {betPercentage.toFixed(1)}% da banca
        </div>
      </div>

      {/* Métricas inline */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-secondary/20 border border-border">
          <div className="text-[9px] text-muted-foreground">TC</div>
          <div className={`font-bold ${
            recommendation.trueCount >= 2 ? 'text-[hsl(var(--success))]' :
            recommendation.trueCount <= -1 ? 'text-[hsl(var(--destructive))]' :
            'text-[hsl(var(--warning))]'
          }`}>
            {recommendation.trueCount >= 0 ? '+' : ''}{recommendation.trueCount}
          </div>
        </div>
        <div className="p-2 rounded-lg bg-secondary/20 border border-border">
          <div className="text-[9px] text-muted-foreground">Vantagem</div>
          <div className={`font-bold ${
            recommendation.playerEdge >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
          }`}>
            {recommendation.playerEdge >= 0 ? '+' : ''}{recommendation.playerEdge.toFixed(1)}%
          </div>
        </div>
        <div className="p-2 rounded-lg bg-secondary/20 border border-border">
          <div className="text-[9px] text-muted-foreground">EV</div>
          <div className={`font-bold ${
            recommendation.expectedValue >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]'
          }`}>
            {recommendation.expectedValue >= 0 ? '+' : ''}R${recommendation.expectedValue.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Comparação com entrada anterior */}
      {currentBet !== undefined && currentBet !== recommendation.amount && (
        <div className="flex items-center justify-between text-xs p-2 rounded-lg bg-secondary/10 border border-border">
          <span className="text-muted-foreground">Anterior:</span>
          <div className="flex items-center gap-1">
            <span className="font-mono">R${currentBet.toFixed(0)}</span>
            {recommendation.amount > currentBet ? (
              <TrendingUp className="h-3 w-3 text-[hsl(var(--success))]" />
            ) : (
              <TrendingDown className="h-3 w-3 text-[hsl(var(--destructive))]" />
            )}
            <span className="font-mono font-bold">R${recommendation.amount.toFixed(0)}</span>
          </div>
        </div>
      )}

      {/* Warning */}
      {recommendation.warning && (
        <Alert variant="destructive" className="py-2">
          <AlertTriangle className="h-3 w-3" />
          <AlertDescription className="text-[10px]">
            {recommendation.warning}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// ═══ MINI DISPLAY (versão compacta) ═══

interface MiniHybridDisplayProps {
  recommendation: BetRecommendation;
}

const MODE_LABELS: Record<string, string> = {
  hybrid: 'HÍBRIDO',
  kelly_quarter: 'KELLY QUARTER',
  kelly_half: 'KELLY HALF',
  kelly_full: 'KELLY FULL',
  martingale: 'MARTINGALE',
  flat: 'FLAT',
};

export function MiniHybridDisplay({ recommendation }: MiniHybridDisplayProps) {
  const systemEmojis = {
    protective: '🛡️',
    recovery: '📈',
    attack: '🚀',
    standard: '⚪'
  };

  const systemColors = {
    protective: 'text-[hsl(var(--destructive))] bg-[hsl(var(--destructive)_/_0.05)] border-[hsl(var(--destructive)_/_0.3)]',
    recovery: 'text-[hsl(var(--warning))] bg-[hsl(var(--warning)_/_0.05)] border-[hsl(var(--warning)_/_0.3)]',
    attack: 'text-[hsl(var(--success))] bg-[hsl(var(--success)_/_0.05)] border-[hsl(var(--success)_/_0.3)]',
    standard: 'text-primary bg-primary/5 border-primary/30'
  };

  // For hybrid mode show system label, for others show mode name
  const displayLabel = recommendation.mode === 'hybrid'
    ? (recommendation.system === 'protective' ? 'PROTEÇÃO' : recommendation.system === 'recovery' ? 'RECUPERAÇÃO' : recommendation.system === 'attack' ? 'ATAQUE' : 'PADRÃO')
    : (MODE_LABELS[recommendation.mode] || 'PADRÃO');

  return (
    <div className={`border-2 rounded-lg p-2 ${systemColors[recommendation.system]}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <span className="text-sm">{systemEmojis[recommendation.system]}</span>
          <span className="font-bold text-[10px]">
            {displayLabel}
          </span>
        </div>
        <Badge variant={recommendation.risk === 'high' ? 'destructive' : 'secondary'} className="text-[9px] h-4">
          {recommendation.risk === 'low' ? '🟢' : recommendation.risk === 'medium' ? '🟡' : '🔴'}
        </Badge>
      </div>
      
      <div className="text-center">
        <div className={`text-2xl font-bold font-orbitron`}>
          R$ {recommendation.amount.toFixed(0)}
        </div>
        <div className="text-[9px] text-muted-foreground">
          {recommendation.percentage.toFixed(1)}% • TC {recommendation.trueCount >= 0 ? '+' : ''}{recommendation.trueCount} • EV {recommendation.expectedValue >= 0 ? '+' : ''}R${recommendation.expectedValue.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
