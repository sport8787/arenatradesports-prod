/**
 * PNLTimelinePanel Component
 * Displays a horizontal timeline of facial events detected during recording
 * Shows gaze direction, micro-expressions, and stress levels
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Eye, Brain, Activity, AlertTriangle, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VideoForensicsResult, PNLAnalysis } from '@/services/videoForensicsService';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PNLTimelinePanelProps {
  timeline: VideoForensicsResult['timeline'];
  durationMs: number;
  pnlAnalysis: PNLAnalysis;
  className?: string;
}

// Event type configuration
const EVENT_CONFIG = {
  gaze: {
    left: { color: 'bg-yellow-500', label: 'Memória Visual', icon: ChevronLeft },
    right: { color: 'bg-red-500', label: 'Construção Visual', icon: ChevronRight },
    straight: { color: 'bg-emerald-500', label: 'Olhar Direto', icon: Minus },
    up: { color: 'bg-blue-500', label: 'Acesso Auditivo', icon: null },
    down: { color: 'bg-purple-500', label: 'Diálogo Interno', icon: null },
  },
  expression: {
    surprise: { color: 'bg-amber-400', label: 'Surpresa' },
    fear: { color: 'bg-orange-500', label: 'Medo' },
    contempt: { color: 'bg-pink-500', label: 'Desprezo' },
    disgust: { color: 'bg-lime-600', label: 'Desgosto' },
    anger: { color: 'bg-red-600', label: 'Raiva' },
    happiness: { color: 'bg-green-400', label: 'Felicidade' },
    sadness: { color: 'bg-blue-400', label: 'Tristeza' },
    neutral: { color: 'bg-gray-400', label: 'Neutro' },
  },
  stress: {
    low: { color: 'bg-emerald-500', label: 'Tensão Baixa' },
    medium: { color: 'bg-yellow-500', label: 'Tensão Média' },
    high: { color: 'bg-red-500', label: 'Tensão Alta' },
  },
};

// PNL interpretation labels
const PNL_LABELS: Record<string, { label: string; description: string }> = {
  visual_memory: { label: 'Memória Visual', description: 'Olhos para cima-esquerda: acesso a memórias visuais reais' },
  visual_construct: { label: 'Construção Visual', description: 'Olhos para cima-direita: criação de imagens (possível fabricação)' },
  auditory_memory: { label: 'Memória Auditiva', description: 'Olhos para esquerda: lembranças de sons/conversas' },
  auditory_construct: { label: 'Construção Auditiva', description: 'Olhos para direita: criação de narrativas sonoras' },
  kinesthetic: { label: 'Cinestésico', description: 'Olhos para baixo-direita: acesso a sensações/emoções' },
  internal_dialog: { label: 'Diálogo Interno', description: 'Olhos para baixo-esquerda: conversa interna (possível ensaio)' },
};

export function PNLTimelinePanel({
  timeline,
  durationMs,
  pnlAnalysis,
  className,
}: PNLTimelinePanelProps) {
  // Group events by type for layered display
  const eventsByType = useMemo(() => {
    const grouped = {
      gaze: [] as typeof timeline,
      expression: [] as typeof timeline,
      stress: [] as typeof timeline,
    };
    
    timeline.forEach(event => {
      if (grouped[event.type]) {
        grouped[event.type].push(event);
      }
    });
    
    return grouped;
  }, [timeline]);

  // Calculate position percentage for each event
  const getEventPosition = (timestamp: number) => {
    return Math.min(100, (timestamp / durationMs) * 100);
  };

  // Get signal color based on PNL analysis
  const getSignalStyle = (signal: PNLAnalysis['signal']) => {
    switch (signal) {
      case 'pro-conviction':
        return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
      case 'pro-bluff':
        return 'bg-red-500/20 border-red-500/50 text-red-400';
      default:
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
    }
  };

  const pnlInfo = PNL_LABELS[pnlAnalysis.accessType] || { label: 'Análise PNL', description: '' };

  return (
    <TooltipProvider>
      <div className={cn('space-y-4 p-4 bg-muted/30 rounded-lg border border-border/50', className)}>
        {/* Header with PNL Analysis */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Timeline PNL</span>
          </div>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={cn(
                'px-2 py-1 rounded text-xs font-medium border cursor-help',
                getSignalStyle(pnlAnalysis.signal)
              )}>
                {pnlInfo.label}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-xs">{pnlInfo.description}</p>
              <p className="text-xs mt-1 text-muted-foreground">
                Confiança: {Math.round(pnlAnalysis.confidence * 100)}%
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Timeline tracks */}
        <div className="space-y-2">
          {/* Gaze track */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              <span>Direção do Olhar</span>
            </div>
            <div className="relative h-4 bg-muted/50 rounded-full overflow-hidden">
              {eventsByType.gaze.map((event, idx) => {
                const config = EVENT_CONFIG.gaze[event.event as keyof typeof EVENT_CONFIG.gaze];
                if (!config) return null;
                
                return (
                  <Tooltip key={`gaze-${idx}`}>
                    <TooltipTrigger asChild>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer',
                          config.color,
                          event.significance === 'high' && 'ring-2 ring-white/50'
                        )}
                        style={{ left: `${getEventPosition(event.timestamp)}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {(event.timestamp / 1000).toFixed(1)}s
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Expression track */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="w-3 h-3" />
              <span>Micro-expressões</span>
            </div>
            <div className="relative h-4 bg-muted/50 rounded-full overflow-hidden">
              {eventsByType.expression.map((event, idx) => {
                const expressionType = event.event.replace('expression_', '');
                const config = EVENT_CONFIG.expression[expressionType as keyof typeof EVENT_CONFIG.expression];
                if (!config) return null;
                
                return (
                  <Tooltip key={`expr-${idx}`}>
                    <TooltipTrigger asChild>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer',
                          config.color,
                          event.significance === 'high' && 'ring-2 ring-white/50'
                        )}
                        style={{ left: `${getEventPosition(event.timestamp)}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {(event.timestamp / 1000).toFixed(1)}s
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Stress track */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="w-3 h-3" />
              <span>Nível de Tensão</span>
            </div>
            <div className="relative h-4 bg-muted/50 rounded-full overflow-hidden">
              {eventsByType.stress.map((event, idx) => {
                const stressLevel = event.event.replace('stress_', '') as 'low' | 'medium' | 'high';
                const config = EVENT_CONFIG.stress[stressLevel];
                if (!config) return null;
                
                return (
                  <Tooltip key={`stress-${idx}`}>
                    <TooltipTrigger asChild>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: idx * 0.02 }}
                        className={cn(
                          'absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full cursor-pointer',
                          config.color,
                          event.significance === 'high' && 'ring-2 ring-white/50'
                        )}
                        style={{ left: `${getEventPosition(event.timestamp)}%` }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{config.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {(event.timestamp / 1000).toFixed(1)}s
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {/* Time markers */}
        <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
          <span>0s</span>
          <span>{(durationMs / 2000).toFixed(0)}s</span>
          <span>{(durationMs / 1000).toFixed(0)}s</span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-muted-foreground">Direto</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-muted-foreground">Memória</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Construção</span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-muted-foreground">Micro-expressão</span>
          </div>
        </div>

        {/* PNL Reasoning */}
        <div className="text-xs text-muted-foreground italic border-t border-border/50 pt-2">
          💡 {pnlAnalysis.reasoning}
        </div>
      </div>
    </TooltipProvider>
  );
}

export default PNLTimelinePanel;
