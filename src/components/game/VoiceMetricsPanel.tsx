/**
 * Painel de Métricas Vocais para o Apresentador
 * Exibe dados biométricos de voz capturados durante a gravação
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Clock, Gauge, Radio, Volume2, Waves } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { VoiceMetrics } from '@/services/audioForensicsService';

interface VoiceMetricsPanelProps {
  metrics: VoiceMetrics | null;
  playerName?: string;
  isLoading?: boolean;
}

export default function VoiceMetricsPanel({ 
  metrics, 
  playerName = 'Jogador',
  isLoading = false 
}: VoiceMetricsPanelProps) {
  if (!metrics && !isLoading) {
    return (
      <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Métricas Vocais</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          Aguardando gravação do jogador...
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30">
        <div className="flex items-center gap-2 mb-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Activity className="w-4 h-4 text-primary" />
          </motion.div>
          <h3 className="font-semibold text-sm">Analisando voz...</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-muted/50 rounded w-1/3 mb-2" />
              <div className="h-2 bg-muted/30 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Calcular indicadores de risco baseados nas métricas
  const latencyRisk = metrics!.responseLatencyMs > 1500 ? 'high' : metrics!.responseLatencyMs > 800 ? 'medium' : 'low';
  const pitchRisk = metrics!.pitchStability === 'unstable' ? 'high' : metrics!.pitchStability === 'micro-tremors' ? 'medium' : 'low';
  const speechRateNormal = metrics!.speechRateBPM >= 80 && metrics!.speechRateBPM <= 180;

  const getRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-success';
      case 'medium': return 'text-warning';
      case 'high': return 'text-destructive';
    }
  };

  const getRiskBg = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'bg-success/20';
      case 'medium': return 'bg-warning/20';
      case 'high': return 'bg-destructive/20';
    }
  };

  // Convert pitch stability to percentage for display
  const getPitchStabilityPercent = (stability: string) => {
    switch (stability) {
      case 'stable': return 95;
      case 'micro-tremors': return 65;
      case 'unstable': return 30;
      default: return 50;
    }
  };

  const pitchStabilityPercent = getPitchStabilityPercent(metrics!.pitchStability);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="bg-background/30 backdrop-blur-sm rounded-xl p-4 border border-border/30"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Métricas Vocais</h3>
          </div>
          <span className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded-full">
            {playerName}
          </span>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Response Latency */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className={cn(
              "p-3 rounded-lg border",
              getRiskBg(latencyRisk),
              "border-border/30"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Latência</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-lg font-bold", getRiskColor(latencyRisk))}>
                {metrics!.responseLatencyMs.toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground">ms</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {latencyRisk === 'high' ? 'Hesitação detectada' : 
               latencyRisk === 'medium' ? 'Leve hesitação' : 'Resposta rápida'}
            </p>
          </motion.div>

          {/* Pitch Stability */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.05 }}
            className={cn(
              "p-3 rounded-lg border",
              getRiskBg(pitchRisk),
              "border-border/30"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Waves className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Estabilidade</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-lg font-bold", getRiskColor(pitchRisk))}>
                {pitchStabilityPercent}
              </span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <Progress 
              value={pitchStabilityPercent} 
              className="h-1 mt-2"
            />
            <p className="text-[10px] text-muted-foreground mt-1 capitalize">
              {metrics!.pitchStability === 'micro-tremors' ? 'Micro-tremores' : 
               metrics!.pitchStability === 'unstable' ? 'Instável' : 'Estável'}
            </p>
          </motion.div>

          {/* Speech Rate */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className={cn(
              "p-3 rounded-lg border",
              speechRateNormal ? "bg-success/20" : "bg-warning/20",
              "border-border/30"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Velocidade</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-lg font-bold",
                speechRateNormal ? "text-success" : "text-warning"
              )}>
                {metrics!.speechRateBPM}
              </span>
              <span className="text-xs text-muted-foreground">p/m</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {metrics!.speechRateBPM > 180 ? 'Fala acelerada' : 
               metrics!.speechRateBPM < 80 ? 'Fala lenta' : 'Ritmo normal'}
            </p>
          </motion.div>

          {/* Average Pitch */}
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15 }}
            className="p-3 rounded-lg border bg-primary/10 border-border/30"
          >
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pitch Médio</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-primary">
                {metrics!.avgPitch}
              </span>
              <span className="text-xs text-muted-foreground">Hz</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Variância: ±{metrics!.pitchVariance}Hz
            </p>
          </motion.div>
        </div>

        {/* Additional Stats */}
        <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Volume2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Amplitude máx:</span>
            <span className="font-medium">{(metrics!.peakAmplitude * 100).toFixed(0)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Duração:</span>
            <span className="font-medium">{(metrics!.recordingDurationMs / 1000).toFixed(1)}s</span>
          </div>
        </div>

        {/* Risk Summary */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "mt-3 p-2 rounded-lg text-center text-xs font-medium",
            latencyRisk === 'high' || pitchRisk === 'high' 
              ? "bg-destructive/20 text-destructive"
              : latencyRisk === 'medium' || pitchRisk === 'medium'
                ? "bg-warning/20 text-warning"
                : "bg-success/20 text-success"
          )}
        >
          {latencyRisk === 'high' || pitchRisk === 'high' 
            ? '⚠️ Sinais de possível blefe detectados'
            : latencyRisk === 'medium' || pitchRisk === 'medium'
              ? '🤔 Alguns indicadores suspeitos'
              : '✓ Padrão vocal estável'}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
