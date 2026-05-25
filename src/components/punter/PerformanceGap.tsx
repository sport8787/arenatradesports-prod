import { motion } from 'framer-motion';
import { Bot, TrendingUp, TrendingDown, Trophy, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Bankroll } from '@/hooks/useBankroll';
import type { ManualBankroll } from '@/hooks/useManualBankroll';

interface PerformanceGapProps {
  horus: Bankroll;
  manual: ManualBankroll;
  username?: string;
}

export default function PerformanceGap({ horus, manual, username = 'Manual' }: PerformanceGapProps) {
  const horusROI = horus.total_staked > 0 ? ((horus.total_profit || 0) / horus.total_staked * 100) : 0;
  const manualROI = manual.total_staked > 0 ? ((manual.total_profit || 0) / (manual.total_staked || 1) * 100) : 0;
  const roiGap = horusROI - manualROI;

  const horusPL = (horus.total_profit || 0);
  const manualPL = (manual.total_profit || 0);
  const profitGap = horusPL - manualPL;

  const horusSettled = (horus.green_bets || 0) + (horus.red_bets || 0);
  const manualSettled = (manual.green_bets || 0) + (manual.red_bets || 0);
  const horusWR = horusSettled > 0 ? ((horus.green_bets || 0) / horusSettled * 100) : 0;
  const manualWR = manualSettled > 0 ? ((manual.green_bets || 0) / manualSettled * 100) : 0;
  const wrGap = horusWR - manualWR;

  // Don't show if not enough data
  if (horusSettled < 3 && manualSettled < 3) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-border rounded-lg bg-card overflow-hidden"
    >
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <span className="font-mono text-xs font-semibold text-muted-foreground tracking-wider">
          ANÁLISE COMPARATIVA
        </span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[260px] text-xs">
              <p>Compara performance entre Hórus IA (automático) e suas decisões manuais. Apenas entradas liquidadas.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border">
        {/* ROI Gap */}
        <div className="p-4 text-center">
          <p className="text-[10px] font-mono text-muted-foreground mb-1.5">GAP ROI</p>
          <div className="flex items-center justify-center gap-1.5">
            <p className={cn(
              "text-xl font-mono font-bold",
              roiGap >= 0 ? 'text-primary' : 'text-success'
            )}>
              {roiGap >= 0 ? '+' : ''}{roiGap.toFixed(1)}pp
            </p>
            {roiGap >= 0 ? (
              <TrendingUp className="w-4 h-4 text-primary" />
            ) : (
              <TrendingDown className="w-4 h-4 text-success" />
            )}
          </div>
          <p className="text-[9px] font-mono text-muted-foreground mt-1">
            {roiGap >= 0 ? 'Hórus lidera' : username + ' lidera'}
          </p>
        </div>

        {/* Profit Gap */}
        <div className="p-4 text-center">
          <p className="text-[10px] font-mono text-muted-foreground mb-1.5">GAP LUCRO</p>
          <p className={cn(
            "text-xl font-mono font-bold",
            profitGap >= 0 ? 'text-primary' : 'text-success'
          )}>
            {profitGap >= 0 ? '+' : ''}R$ {Math.abs(profitGap).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[9px] font-mono text-muted-foreground mt-1">
            {profitGap >= 0 ? 'Hórus > ' + username : username + ' > Hórus'}
          </p>
        </div>

        {/* Win Rate Gap */}
        <div className="p-4 text-center">
          <p className="text-[10px] font-mono text-muted-foreground mb-1.5">GAP WIN RATE</p>
          <p className={cn(
            "text-xl font-mono font-bold",
            wrGap >= 0 ? 'text-primary' : 'text-success'
          )}>
            {wrGap >= 0 ? '+' : ''}{wrGap.toFixed(1)}pp
          </p>
          <p className="text-[9px] font-mono text-muted-foreground mt-1">
            H: {horusWR.toFixed(0)}% vs M: {manualWR.toFixed(0)}%
          </p>
        </div>
      </div>

      {/* Insight Banner */}
      {Math.abs(roiGap) > 10 && (
        <div className={cn(
          "mx-3 mb-3 rounded-lg p-3 flex items-start gap-2.5",
          roiGap > 0
            ? 'bg-primary/5 border border-primary/15'
            : 'bg-success/5 border border-success/15'
        )}>
          {roiGap > 0 ? (
            <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          ) : (
            <Trophy className="w-4 h-4 text-success mt-0.5 shrink-0" />
          )}
          <div>
            <p className={cn(
              "text-xs font-mono font-semibold mb-0.5",
              roiGap > 0 ? 'text-primary' : 'text-success'
            )}>
              {roiGap > 0 ? '💬 Insight Hórus' : '🏆 Parabéns!'}
            </p>
            <p className="text-[11px] text-foreground/70 leading-relaxed">
              {roiGap > 20
                ? `Sua performance manual está ${roiGap.toFixed(1)}pp abaixo. Considere seguir mais recomendações de alta confiança (Score ≥80).`
                : roiGap > 10
                ? `Há espaço para melhoria. Tente aumentar o compliance com recomendações de alta confiança.`
                : roiGap < -10
                ? `Você está superando Hórus em ${Math.abs(roiGap).toFixed(1)}pp! Seus critérios de seleção estão excelentes.`
                : `Diferença moderada. Continue testando e ajustando sua abordagem.`}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
