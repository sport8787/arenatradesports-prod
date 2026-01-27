// Mycroft Combined Analysis Panel v2.0
// Displays humanized reading + technical feedback for vocal + facial analysis
// Used by jury in multiplayer mode
// Now includes TTS audio playback and PNL Timeline visualization

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Shield, 
  AlertTriangle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Eye,
  Mic,
  Video,
  Activity,
  Volume2,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import type { CombinedReading } from '@/services/mycroftCombinedReadingService';
import { generateCombinedReadingText } from '@/services/mycroftCombinedReadingService';
import { playMycroftVerdict } from '@/services/presenterAudioService';
import type { VideoForensicsResult } from '@/services/videoForensicsService';
import PNLTimelinePanel from './PNLTimelinePanel';

interface MycroftCombinedPanelProps {
  reading: CombinedReading;
  showTechnicalDetails?: boolean;
  videoMetrics?: VideoForensicsResult;
  recordingDurationMs?: number;
  className?: string;
}

export function MycroftCombinedPanel({ 
  reading, 
  showTechnicalDetails = true,
  videoMetrics,
  recordingDurationMs = 30000,
  className 
}: MycroftCombinedPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Zone configuration
  const zoneConfig = {
    conviction: {
      bg: 'bg-emerald-900/40',
      border: 'border-emerald-500/50',
      text: 'text-emerald-400',
      barColor: 'bg-emerald-500',
      icon: Shield,
    },
    mixed: {
      bg: 'bg-yellow-900/40',
      border: 'border-yellow-500/50',
      text: 'text-yellow-400',
      barColor: 'bg-yellow-500',
      icon: AlertTriangle,
    },
    bluff: {
      bg: 'bg-red-900/40',
      border: 'border-red-500/50',
      text: 'text-red-400',
      barColor: 'bg-red-500',
      icon: AlertCircle,
    },
  };

  const config = zoneConfig[reading.zone];
  const ZoneIcon = config.icon;

  // Handle TTS audio playback
  const handlePlayAudio = async () => {
    if (isPlayingAudio) return;
    
    const readingText = generateCombinedReadingText(reading);
    
    await playMycroftVerdict(
      readingText,
      () => setIsPlayingAudio(true),
      () => setIsPlayingAudio(false)
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border-2 p-4 space-y-4",
        config.border,
        config.bg,
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg border", config.bg, config.border)}>
            <Brain className={cn("w-5 h-5", config.text)} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Leitura do Mycroft</h3>
            <p className={cn("text-lg font-bold", config.text)}>{reading.title}</p>
          </div>
        </div>
        
        {/* Zone Badge */}
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1",
          config.bg, config.text
        )}>
          <ZoneIcon className="w-3 h-3" />
          {reading.zoneLabel}
        </div>
      </div>

      {/* Reading Lines */}
      <div className="space-y-2">
        {reading.lines.map((line, index) => (
          <p key={index} className="text-sm text-foreground/90 leading-relaxed">
            {line}
          </p>
        ))}
        <p className={cn("text-base font-semibold mt-2", config.text)}>
          ➡️ {reading.conclusion}
        </p>
      </div>

      {/* Audio Playback Button */}
      <Button
        onClick={handlePlayAudio}
        disabled={isPlayingAudio}
        variant="outline"
        className={cn(
          "w-full border-current",
          config.text,
          isPlayingAudio && "animate-pulse"
        )}
      >
        {isPlayingAudio ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Reproduzindo Análise...
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4 mr-2" />
            🎧 Ouvir Análise do Mycroft
          </>
        )}
      </Button>

      {/* Technical Summary Badge */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 rounded-lg">
        <Activity className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-mono">
          📊 {reading.technicalSummary}
        </span>
      </div>

      {/* Combined Score Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ZoneIcon className="w-3 h-3" />
            Índice de Suspeita Combinado
          </span>
          <span className="font-mono">{Math.round(reading.combinedScore)}%</span>
        </div>
        <Progress 
          value={reading.combinedScore} 
          className="h-2"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Convicção</span>
          <span>Atenção</span>
          <span>Blefe</span>
        </div>
      </div>

      {/* Technical Details Toggle */}
      {showTechnicalDetails && (
        <div className="pt-2 border-t border-border/50">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="w-3 h-3" />
            Ver métricas detalhadas
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {/* Vocal Score */}
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Mic className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium">Análise Vocal</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Suspicion</span>
                      <span className={cn(
                        "font-mono text-sm font-bold",
                        reading.vocalScore < 35 ? "text-emerald-400" :
                        reading.vocalScore < 65 ? "text-yellow-400" : "text-red-400"
                      )}>
                        {Math.round(reading.vocalScore)}%
                      </span>
                    </div>
                    <Progress 
                      value={reading.vocalScore} 
                      className="h-1.5 mt-1"
                    />
                  </div>

                  {/* Facial Score */}
                  <div className="p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Video className="w-4 h-4 text-primary" />
                      <span className="text-xs font-medium">Análise Facial</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Suspicion</span>
                      <span className={cn(
                        "font-mono text-sm font-bold",
                        reading.facialScore < 35 ? "text-emerald-400" :
                        reading.facialScore < 65 ? "text-yellow-400" : "text-red-400"
                      )}>
                        {Math.round(reading.facialScore)}%
                      </span>
                    </div>
                    <Progress 
                      value={reading.facialScore} 
                      className="h-1.5 mt-1"
                    />
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-muted-foreground text-center">
                  Combinado = 60% Vocal + 40% Facial
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* PNL Timeline Panel */}
      {videoMetrics && videoMetrics.timeline && videoMetrics.timeline.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <Activity className="w-3 h-3" />
            Ver Timeline PNL
            {showTimeline ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {showTimeline && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <PNLTimelinePanel
                  timeline={videoMetrics.timeline}
                  durationMs={recordingDurationMs}
                  pnlAnalysis={videoMetrics.pnlAnalysis}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
