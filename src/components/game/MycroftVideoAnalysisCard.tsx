/**
 * MycroftVideoAnalysisCard Component
 * Displays combined vocal + facial analysis for the jury
 * Includes video replay with timeline markers
 */

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, Brain, Video, Play, Pause, Volume2, VolumeX,
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  Waves, Scan, Clock, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { type VoiceMetrics } from '@/services/audioForensicsService';
import { 
  type VideoForensicsResult,
  generateFacialAnalysisSummary 
} from '@/services/videoForensicsService';

interface CombinedAnalysis {
  vocalMetrics: VoiceMetrics;
  facialAnalysis: VideoForensicsResult;
  combinedScore: number;
  overallVerdict: 'conviction' | 'suspicious' | 'bluff';
}

interface MycroftVideoAnalysisCardProps {
  videoUrl: string;
  analysis: CombinedAnalysis;
  isReleased: boolean;
  playerName?: string;
}

export default function MycroftVideoAnalysisCard({
  videoUrl,
  analysis,
  isReleased,
  playerName = 'Jogador',
}: MycroftVideoAnalysisCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'vocal' | 'facial' | 'combined'>('combined');
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const { vocalMetrics, facialAnalysis, combinedScore, overallVerdict } = analysis;
  const facialSummary = generateFacialAnalysisSummary(facialAnalysis);

  // Verdict styling
  const verdictConfig = {
    conviction: {
      label: 'Convicção Detectada',
      color: 'text-success',
      bgColor: 'bg-success/10',
      borderColor: 'border-success/30',
      icon: CheckCircle,
    },
    suspicious: {
      label: 'Sinais Ambíguos',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      borderColor: 'border-warning/30',
      icon: AlertTriangle,
    },
    bluff: {
      label: 'Possível Blefe',
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      borderColor: 'border-destructive/30',
      icon: AlertTriangle,
    },
  };

  const config = verdictConfig[overallVerdict];
  const VerdictIcon = config.icon;

  // Video controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Timeline events from facial analysis
  const timelineEvents = facialAnalysis.timeline.filter(e => e.significance !== 'low');

  if (!isReleased) {
    return (
      <div className="p-6 rounded-xl bg-muted/20 border border-muted text-center">
        <Eye className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
        <p className="text-muted-foreground">
          Análise do Mycroft ainda não liberada
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden",
        config.borderColor,
        config.bgColor
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", config.bgColor)}>
              <Brain className={cn("w-5 h-5", config.color)} />
            </div>
            <div>
              <h3 className="font-semibold">Análise Mycroft 2.0</h3>
              <p className="text-xs text-muted-foreground">
                Justificativa de {playerName}
              </p>
            </div>
          </div>
          
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            config.bgColor, config.borderColor, "border"
          )}>
            <VerdictIcon className={cn("w-4 h-4", config.color)} />
            <span className={cn("text-sm font-medium", config.color)}>
              {config.label}
            </span>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className="relative aspect-video bg-black">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full h-full object-cover"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          playsInline
        />

        {/* Video overlay controls */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30">
          <Button
            variant="ghost"
            size="lg"
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-white/20 hover:bg-white/30"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-white" />
            ) : (
              <Play className="w-8 h-8 text-white ml-1" />
            )}
          </Button>
        </div>

        {/* Timeline markers */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
          <div className="relative h-2 bg-white/20 rounded-full mb-2">
            {/* Progress */}
            <div 
              className="absolute inset-y-0 left-0 bg-primary rounded-full"
              style={{ width: `${(currentTime / duration) * 100}%` }}
            />
            
            {/* Event markers */}
            {timelineEvents.map((event, index) => {
              const position = (event.timestamp / 1000 / duration) * 100;
              if (position > 100 || position < 0) return null;
              
              return (
                <button
                  key={index}
                  onClick={() => seekTo(event.timestamp / 1000)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white",
                    event.significance === 'high' ? 'bg-destructive' : 'bg-warning'
                  )}
                  style={{ left: `${position}%` }}
                  title={event.event}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-white/80">
            <span>{formatTime(currentTime)}</span>
            <button onClick={toggleMute}>
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Combined Score */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Índice de Suspeita Combinado</span>
          <span className={cn("font-bold text-lg", config.color)}>
            {Math.round(combinedScore)}%
          </span>
        </div>
        <Progress 
          value={combinedScore} 
          className="h-3"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex border-y border-border/50">
        <button
          onClick={() => setActiveTab('combined')}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors",
            activeTab === 'combined' 
              ? "bg-primary/10 text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Activity className="w-4 h-4 mx-auto mb-1" />
          Combinado
        </button>
        <button
          onClick={() => setActiveTab('vocal')}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors",
            activeTab === 'vocal' 
              ? "bg-primary/10 text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Waves className="w-4 h-4 mx-auto mb-1" />
          Vocal
        </button>
        <button
          onClick={() => setActiveTab('facial')}
          className={cn(
            "flex-1 py-2 text-sm font-medium transition-colors",
            activeTab === 'facial' 
              ? "bg-primary/10 text-primary border-b-2 border-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Scan className="w-4 h-4 mx-auto mb-1" />
          Facial
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-4 space-y-4">
        <AnimatePresence mode="wait">
          {activeTab === 'combined' && (
            <motion.div
              key="combined"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Waves className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">Score Vocal</span>
                  </div>
                  <span className="text-xl font-bold">
                    {Math.round(typeof vocalMetrics.stressDeviation === 'number' ? vocalMetrics.stressDeviation : 0)}%
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Scan className="w-4 h-4 text-primary" />
                    <span className="text-xs font-medium">Score Facial</span>
                  </div>
                  <span className="text-xl font-bold">
                    {Math.round(facialAnalysis.overallFacialSuspicion)}%
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm">
                  {facialSummary.headline}
                </p>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">
                  {facialSummary.conclusion}
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === 'vocal' && (
            <motion.div
              key="vocal"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded bg-muted/30">
                  <span className="text-xs text-muted-foreground">Pitch Médio</span>
                  <p className="font-medium">{vocalMetrics.avgPitch?.toFixed(0) || '-'} Hz</p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <span className="text-xs text-muted-foreground">Latência</span>
                  <p className="font-medium">{vocalMetrics.responseLatencyMs || '-'} ms</p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <span className="text-xs text-muted-foreground">Jitter</span>
                  <p className="font-medium">{(vocalMetrics.jitter || 0).toFixed(3)}</p>
                </div>
                <div className="p-2 rounded bg-muted/30">
                  <span className="text-xs text-muted-foreground">Shimmer</span>
                  <p className="font-medium">{(vocalMetrics.shimmer || 0).toFixed(3)}</p>
                </div>
              </div>

              <div className="p-2 rounded bg-muted/30">
                <span className="text-xs text-muted-foreground">Estabilidade do Pitch</span>
                <p className="font-medium">{vocalMetrics.pitchStability || 'Normal'}</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'facial' && (
            <motion.div
              key="facial"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="space-y-3"
            >
              {/* Eye Gaze */}
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Direção do Olhar</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dominante: <strong className="text-foreground">
                    {facialAnalysis.eyeGaze.dominantDirection === 'left' ? 'Esquerda' :
                     facialAnalysis.eyeGaze.dominantDirection === 'right' ? 'Direita' :
                     facialAnalysis.eyeGaze.dominantDirection === 'up' ? 'Cima' :
                     facialAnalysis.eyeGaze.dominantDirection === 'down' ? 'Baixo' : 'Direto'}
                  </strong> ({facialAnalysis.eyeGaze.directionChanges} mudanças)
                </p>
                {facialAnalysis.eyeGaze.suspiciousPatterns.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {facialAnalysis.eyeGaze.suspiciousPatterns.map((pattern, i) => (
                      <li key={i} className="text-xs text-warning flex items-start gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        {pattern}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* PNL Analysis */}
              <div className="p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">Análise PNL</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {facialAnalysis.pnlAnalysis.reasoning}
                </p>
                <div className={cn(
                  "mt-2 inline-block px-2 py-0.5 rounded text-xs font-medium",
                  facialAnalysis.pnlAnalysis.signal === 'pro-conviction' 
                    ? "bg-success/20 text-success" 
                    : facialAnalysis.pnlAnalysis.signal === 'pro-bluff'
                      ? "bg-destructive/20 text-destructive"
                      : "bg-muted text-muted-foreground"
                )}>
                  {facialAnalysis.pnlAnalysis.signal === 'pro-conviction' ? 'Pró-Convicção' :
                   facialAnalysis.pnlAnalysis.signal === 'pro-bluff' ? 'Pró-Blefe' : 'Neutro'}
                </div>
              </div>

              {/* Micro-expressions */}
              {facialAnalysis.microExpressions.detected.length > 0 && (
                <div className="p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Scan className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Micro-Expressões</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {facialAnalysis.microExpressions.detected.map((expr, i) => (
                      <span 
                        key={i}
                        className="px-2 py-0.5 bg-warning/20 text-warning text-xs rounded"
                      >
                        {expr.type} @ {formatTime(expr.timestamp / 1000)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timeline Events */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="w-full p-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors border-t border-border/50"
      >
        <Clock className="w-4 h-4" />
        {showDetails ? 'Ocultar Timeline' : 'Ver Timeline de Eventos'}
        {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-border/50 space-y-2 max-h-48 overflow-y-auto">
              {timelineEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  Nenhum evento significativo detectado
                </p>
              ) : (
                timelineEvents.map((event, index) => (
                  <button
                    key={index}
                    onClick={() => seekTo(event.timestamp / 1000)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-muted/50 transition-colors",
                      event.significance === 'high' && "bg-destructive/5"
                    )}
                  >
                    <span className="text-xs font-mono text-muted-foreground w-12">
                      {formatTime(event.timestamp / 1000)}
                    </span>
                    <span className={cn(
                      "w-2 h-2 rounded-full shrink-0",
                      event.significance === 'high' ? 'bg-destructive' : 'bg-warning'
                    )} />
                    <span className="text-xs flex-1">{event.event}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      {event.type}
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
