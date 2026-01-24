/**
 * MycroftPreviewPanel - Preview da análise do Mycroft para o apresentador
 * Exibido antes de liberar para o júri
 * Agora usa leitura humanizada com 10 cenários baseados em métricas reais
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Eye, Send, Volume2, Loader2, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoldButton from '@/components/game/GoldButton';
import { cn } from '@/lib/utils';
import { playMycroftVerdict } from '@/services/presenterAudioService';
import { 
  generateHumanReading, 
  getBluffScore, 
  generateReadingText,
  getFallbackReading,
  type MycroftHumanReading as Reading
} from '@/services/mycroftHumanReadingService';
import type { VoiceMetrics } from '@/services/audioForensicsService';

interface MycroftAnalysis {
  verdict: string;
  confidence: number;
  forensicDetails: string;
  metrics?: VoiceMetrics | Record<string, unknown>;
}

interface MycroftPreviewPanelProps {
  analysis: MycroftAnalysis;
  isReleased: boolean;
  onRelease: () => void;
}

export function MycroftPreviewPanel({ 
  analysis, 
  isReleased, 
  onRelease 
}: MycroftPreviewPanelProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  
  // Generate human reading from metrics
  const humanReading = useMemo<Reading>(() => {
    if (analysis.metrics && 'responseLatencyMs' in analysis.metrics) {
      return generateHumanReading(analysis.metrics as VoiceMetrics);
    }
    return getFallbackReading();
  }, [analysis.metrics]);
  
  const bluffScore = useMemo(() => {
    if (analysis.metrics && 'responseLatencyMs' in analysis.metrics) {
      return getBluffScore(analysis.metrics as VoiceMetrics);
    }
    return 50;
  }, [analysis.metrics]);
  
  // Cast metrics for technical display
  const voiceMetrics = analysis.metrics && 'responseLatencyMs' in analysis.metrics 
    ? analysis.metrics as VoiceMetrics 
    : null;
  
  const getBarColor = () => {
    if (humanReading.color === 'emerald') return 'bg-emerald-500';
    if (humanReading.color === 'yellow') return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  const getTextColor = () => {
    if (humanReading.color === 'emerald') return 'text-emerald-400';
    if (humanReading.color === 'yellow') return 'text-yellow-400';
    return 'text-red-400';
  };
  
  const getBorderColor = () => {
    if (humanReading.color === 'emerald') return 'border-emerald-500/50';
    if (humanReading.color === 'yellow') return 'border-yellow-500/50';
    return 'border-red-500/50';
  };
  
  const getBgColor = () => {
    if (humanReading.color === 'emerald') return 'bg-emerald-500/10';
    if (humanReading.color === 'yellow') return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  const handlePlayAudio = async () => {
    if (isPlayingAudio) return;
    
    // Use the humanized reading text for TTS
    const readingText = generateReadingText(humanReading);
    
    await playMycroftVerdict(
      readingText,
      () => setIsPlayingAudio(true),
      () => setIsPlayingAudio(false)
    );
  };

  if (isReleased) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-success/10 border border-success/50 rounded-xl p-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-success">Análise Liberada para o Júri</p>
            <p className="text-xs text-muted-foreground">
              O júri está visualizando a leitura do Mycroft
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            className="border-success/50 text-success hover:bg-success/10"
          >
            {isPlayingAudio ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border overflow-hidden',
        getBorderColor(),
        getBgColor()
      )}
    >
      {/* Header */}
      <div className={cn('flex items-center justify-between p-4 border-b', getBorderColor())}>
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', getBgColor())}>
            <Brain className={cn('w-5 h-5', getTextColor())} />
          </div>
          <div>
            <p className={cn('font-semibold flex items-center gap-2', getTextColor())}>
              <Eye className="w-4 h-4" />
              Preview da Leitura
            </p>
            <p className="text-xs text-muted-foreground">
              Somente você pode ver isso
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            className={cn(
              'border-current opacity-70 hover:opacity-100',
              getTextColor(),
              isPlayingAudio && 'animate-pulse'
            )}
          >
            {isPlayingAudio ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Tocando...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Tocar Voz
              </>
            )}
          </Button>
          <GoldButton onClick={onRelease} size="sm">
            <Send className="w-4 h-4 mr-2" />
            Liberar para Júri
          </GoldButton>
        </div>
      </div>

      {/* Human Reading Content */}
      <div className="p-4 space-y-4">
        {/* Main Header */}
        <div className="flex items-center gap-2">
          <Brain className={cn('w-5 h-5', getTextColor())} />
          <span className={cn('font-bold tracking-wide uppercase text-sm', getTextColor())}>
            LEITURA DO MYCROFT
          </span>
        </div>
        
        {/* Reading Lines */}
        <div className="space-y-1">
          {humanReading.lines.map((line, i) => (
            <p key={i} className="text-foreground/90 text-sm leading-relaxed">
              {line}
            </p>
          ))}
        </div>
        
        {/* Conclusion */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">➡️</span>
          <span className={cn('font-semibold', getTextColor())}>
            {humanReading.conclusion}
          </span>
        </div>
        
        {/* Visual Indicator Bar */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Verdade</span>
            <span>Atenção</span>
            <span>Blefe</span>
          </div>
          
          {/* Bar Track */}
          <div className="relative h-3 bg-background/50 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 via-yellow-500/30 to-red-500/30" />
            
            {/* Indicator */}
            <motion.div
              initial={{ left: '50%' }}
              animate={{ left: `${bluffScore}%` }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="absolute top-0 bottom-0 w-1"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div className={cn(
                'w-4 h-4 -mt-0.5 rounded-full border-2 border-white shadow-lg',
                getBarColor()
              )} />
            </motion.div>
          </div>
          
          {/* Zone Label */}
          <div className="text-center">
            <span className={cn(
              'inline-block px-3 py-1 rounded-full text-xs font-bold',
              getBgColor(),
              getTextColor()
            )}>
              {humanReading.zoneLabel}
            </span>
          </div>
        </div>
        
        {/* Technical Details Toggle */}
        {voiceMetrics && (
          <div className="pt-2 border-t border-border/30">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <Activity className="w-3 h-3" />
              🔍 Ver análise técnica
              {showTechnical ? (
                <ChevronUp className="w-3 h-3 ml-auto" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-auto" />
              )}
            </button>
            
            <AnimatePresence>
              {showTechnical && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 rounded-lg bg-background/30 border border-border/50 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Latência:</span>
                        <span className="text-foreground">{voiceMetrics.responseLatencyMs}ms</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pitch:</span>
                        <span className="text-foreground">{voiceMetrics.avgPitch.toFixed(0)}Hz</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Jitter:</span>
                        <span className="text-foreground">{voiceMetrics.jitter.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shimmer:</span>
                        <span className="text-foreground">{voiceMetrics.shimmer.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Taxa:</span>
                        <span className="text-foreground">{voiceMetrics.speechRateBPM} BPM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">HNR:</span>
                        <span className="text-foreground">{voiceMetrics.harmonicsToNoise.toFixed(1)} dB</span>
                      </div>
                    </div>
                    
                    {analysis.forensicDetails && (
                      <div className="pt-2 border-t border-border/30">
                        <p className="text-xs text-muted-foreground">{analysis.forensicDetails}</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default MycroftPreviewPanel;
