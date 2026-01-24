/**
 * Gráfico de Evolução Temporal das Métricas Vocais
 * Mostra tendências ao longo das rodadas para o apresentador
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Activity, AlertTriangle } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface RoundMetrics {
  round: number;
  pitch: number;
  latency: number;
  jitter: number;
  stressScore: number;
  playerName?: string;
}

interface VoiceMetricsChartProps {
  metricsHistory: RoundMetrics[];
  currentPlayerName?: string;
}

const chartConfig = {
  pitch: {
    label: "Pitch (Hz)",
    color: "hsl(var(--primary))",
  },
  latency: {
    label: "Latência (ms)",
    color: "hsl(var(--warning))",
  },
  jitter: {
    label: "Jitter (%)",
    color: "hsl(var(--destructive))",
  },
  stressScore: {
    label: "Estresse",
    color: "hsl(var(--accent))",
  },
} satisfies ChartConfig;

export default function VoiceMetricsChart({
  metricsHistory,
  currentPlayerName = 'Jogador'
}: VoiceMetricsChartProps) {
  // Calculate trend analysis
  const trendAnalysis = useMemo(() => {
    if (metricsHistory.length < 2) return null;
    
    const recent = metricsHistory.slice(-3);
    const avgStress = recent.reduce((sum, m) => sum + m.stressScore, 0) / recent.length;
    const firstHalf = metricsHistory.slice(0, Math.floor(metricsHistory.length / 2));
    const secondHalf = metricsHistory.slice(Math.floor(metricsHistory.length / 2));
    
    const firstAvgStress = firstHalf.reduce((sum, m) => sum + m.stressScore, 0) / firstHalf.length;
    const secondAvgStress = secondHalf.reduce((sum, m) => sum + m.stressScore, 0) / secondHalf.length;
    
    const trend = secondAvgStress > firstAvgStress + 5 ? 'increasing' :
                  secondAvgStress < firstAvgStress - 5 ? 'decreasing' : 'stable';
    
    return { avgStress, trend };
  }, [metricsHistory]);

  if (metricsHistory.length === 0) {
    return (
      <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Evolução Temporal</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          Dados serão exibidos após a primeira rodada com gravação
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Evolução Temporal</h3>
        </div>
        {trendAnalysis && (
          <div className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
            trendAnalysis.trend === 'increasing' ? "bg-destructive/20 text-destructive" :
            trendAnalysis.trend === 'decreasing' ? "bg-success/20 text-success" :
            "bg-muted/30 text-muted-foreground"
          )}>
            {trendAnalysis.trend === 'increasing' && <AlertTriangle className="w-3 h-3" />}
            {trendAnalysis.trend === 'increasing' ? 'Estresse Crescente' :
             trendAnalysis.trend === 'decreasing' ? 'Estabilizando' : 'Estável'}
          </div>
        )}
      </div>

      {/* Stress Score Chart */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-2">Score de Estresse por Rodada</p>
        <ChartContainer config={chartConfig} className="h-[120px] w-full">
          <AreaChart data={metricsHistory} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis 
              dataKey="round" 
              tickFormatter={(value) => `R${value}`}
              className="text-xs"
              tick={{ fontSize: 10 }}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fontSize: 10 }}
              width={30}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="stressScore"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              fill="url(#stressGradient)"
              name="Estresse"
            />
          </AreaChart>
        </ChartContainer>
      </div>

      {/* Multi-metric Line Chart */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Métricas Detalhadas</p>
        <ChartContainer config={chartConfig} className="h-[140px] w-full">
          <LineChart data={metricsHistory} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis 
              dataKey="round" 
              tickFormatter={(value) => `R${value}`}
              tick={{ fontSize: 10 }}
            />
            <YAxis tick={{ fontSize: 10 }} width={30} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              type="monotone"
              dataKey="pitch"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Pitch (Hz)"
            />
            <Line
              type="monotone"
              dataKey="jitter"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Jitter (%)"
            />
          </LineChart>
        </ChartContainer>
      </div>

      {/* Summary Stats */}
      {metricsHistory.length >= 2 && (
        <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-3 gap-2 text-xs">
          <div className="text-center">
            <span className="text-muted-foreground block">Média Pitch</span>
            <span className="font-bold text-primary">
              {Math.round(metricsHistory.reduce((s, m) => s + m.pitch, 0) / metricsHistory.length)}Hz
            </span>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground block">Média Latência</span>
            <span className="font-bold text-warning">
              {Math.round(metricsHistory.reduce((s, m) => s + m.latency, 0) / metricsHistory.length)}ms
            </span>
          </div>
          <div className="text-center">
            <span className="text-muted-foreground block">Média Jitter</span>
            <span className="font-bold text-destructive">
              {(metricsHistory.reduce((s, m) => s + m.jitter, 0) / metricsHistory.length).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
