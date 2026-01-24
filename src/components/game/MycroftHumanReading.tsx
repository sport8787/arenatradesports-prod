import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MycroftHumanReading as Reading } from '@/services/mycroftHumanReadingService';
import { VoiceMetrics } from '@/services/audioForensicsService';

interface MycroftHumanReadingProps {
  reading: Reading;
  bluffScore: number;
  metrics?: VoiceMetrics;
  showTechnicalButton?: boolean;
  className?: string;
}

export function MycroftHumanReadingPanel({
  reading,
  bluffScore,
  metrics,
  showTechnicalButton = true,
  className
}: MycroftHumanReadingProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  
  const getBarColor = () => {
    if (reading.color === 'emerald') return 'bg-emerald-500';
    if (reading.color === 'yellow') return 'bg-yellow-500';
    return 'bg-red-500';
  };
  
  const getGlowColor = () => {
    if (reading.color === 'emerald') return 'shadow-emerald-500/50';
    if (reading.color === 'yellow') return 'shadow-yellow-500/50';
    return 'shadow-red-500/50';
  };
  
  const getTextColor = () => {
    if (reading.color === 'emerald') return 'text-emerald-400';
    if (reading.color === 'yellow') return 'text-yellow-400';
    return 'text-red-400';
  };
  
  const getBorderColor = () => {
    if (reading.color === 'emerald') return 'border-emerald-500/50';
    if (reading.color === 'yellow') return 'border-yellow-500/50';
    return 'border-red-500/50';
  };
  
  const getBgColor = () => {
    if (reading.color === 'emerald') return 'bg-emerald-500/10';
    if (reading.color === 'yellow') return 'bg-yellow-500/10';
    return 'bg-red-500/10';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-xl border backdrop-blur-sm overflow-hidden',
        getBorderColor(),
        getBgColor(),
        className
      )}
    >
      {/* Header */}
      <div className={cn('px-4 py-3 border-b', getBorderColor())}>
        <div className="flex items-center gap-2">
          <Brain className={cn('w-5 h-5', getTextColor())} />
          <span className={cn('font-bold tracking-wide', getTextColor())}>
            LEITURA DO MYCROFT
          </span>
        </div>
      </div>
      
      {/* Main Reading Block */}
      <div className="p-4 space-y-4">
        {/* Reading Lines */}
        <div className="space-y-1">
          {reading.lines.map((line, i) => (
            <p key={i} className="text-foreground/90 text-sm leading-relaxed">
              {line}
            </p>
          ))}
        </div>
        
        {/* Conclusion with Arrow */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">➡️</span>
          <span className={cn('font-semibold', getTextColor())}>
            {reading.conclusion}
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
            {/* Gradient Background */}
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
                getBarColor(),
                getGlowColor()
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
              {reading.zoneLabel}
            </span>
          </div>
        </div>
        
        {/* Technical Details Button */}
        {showTechnicalButton && metrics && (
          <div className="pt-2">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Activity className="w-3 h-3" />
              Ver análise técnica
              {showTechnical ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
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
                  <div className="mt-3 p-3 rounded-lg bg-background/30 border border-border/50 space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      {metrics.responseLatencyMs !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Latência:</span>
                          <span className="ml-1 text-foreground">{metrics.responseLatencyMs}ms</span>
                        </div>
                      )}
                      {metrics.avgPitch !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Pitch:</span>
                          <span className="ml-1 text-foreground">{metrics.avgPitch.toFixed(0)}Hz</span>
                        </div>
                      )}
                      {metrics.jitter !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Jitter:</span>
                          <span className="ml-1 text-foreground">{metrics.jitter.toFixed(2)}%</span>
                        </div>
                      )}
                      {metrics.shimmer !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Shimmer:</span>
                          <span className="ml-1 text-foreground">{metrics.shimmer.toFixed(2)}%</span>
                        </div>
                      )}
                      {metrics.speechRateBPM !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Taxa:</span>
                          <span className="ml-1 text-foreground">{metrics.speechRateBPM} BPM</span>
                        </div>
                      )}
                      {metrics.stressDeviation?.overallStressScore !== undefined && (
                        <div>
                          <span className="text-muted-foreground">Stress:</span>
                          <span className="ml-1 text-foreground">{metrics.stressDeviation.overallStressScore.toFixed(0)}</span>
                        </div>
                      )}
                    </div>
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

// Compact version for inline use
export function MycroftReadingCompact({
  reading,
  className
}: {
  reading: Reading;
  className?: string;
}) {
  const getTextColor = () => {
    if (reading.color === 'emerald') return 'text-emerald-400';
    if (reading.color === 'yellow') return 'text-yellow-400';
    return 'text-red-400';
  };
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Brain className={cn('w-4 h-4', getTextColor())} />
      <span className={cn('text-sm font-medium', getTextColor())}>
        {reading.conclusion}
      </span>
    </div>
  );
}
