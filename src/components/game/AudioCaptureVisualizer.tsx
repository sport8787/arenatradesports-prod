/**
 * AudioCaptureVisualizer Component
 * Visual indicator showing real-time audio capture during video recording
 * Displays waveform, amplitude, and capture status for debugging
 */

import { motion } from 'framer-motion';
import { Mic, Volume2, VolumeX, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioCaptureVisualizerProps {
  waveformData: number[];
  isCapturing: boolean;
  amplitude: number;
  samplesCollected: number;
  className?: string;
}

export default function AudioCaptureVisualizer({
  waveformData,
  isCapturing,
  amplitude,
  samplesCollected,
  className,
}: AudioCaptureVisualizerProps) {
  const hasSignal = amplitude > 0.01;
  const signalStrength = Math.min(amplitude * 10, 1); // Normalize to 0-1
  
  return (
    <div className={cn(
      "p-3 rounded-xl border bg-background/80 backdrop-blur-sm",
      isCapturing ? "border-success/50" : "border-muted",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-lg",
            isCapturing && hasSignal ? "bg-success/20" : "bg-muted"
          )}>
            {hasSignal ? (
              <Volume2 className={cn(
                "w-4 h-4",
                isCapturing ? "text-success" : "text-muted-foreground"
              )} />
            ) : (
              <VolumeX className="w-4 h-4 text-warning" />
            )}
          </div>
          <div>
            <p className="text-xs font-medium">Captura de Áudio</p>
            <p className={cn(
              "text-[10px]",
              isCapturing && hasSignal ? "text-success" : "text-muted-foreground"
            )}>
              {isCapturing ? (hasSignal ? "Capturando..." : "Sem sinal") : "Aguardando"}
            </p>
          </div>
        </div>
        
        {/* Capture indicator */}
        {isCapturing && (
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="flex items-center gap-1.5"
          >
            <div className={cn(
              "w-2 h-2 rounded-full",
              hasSignal ? "bg-success" : "bg-warning"
            )} />
            <span className="text-[10px] font-mono text-muted-foreground">
              {samplesCollected.toLocaleString()}
            </span>
          </motion.div>
        )}
      </div>
      
      {/* Waveform visualization */}
      <div className="relative h-10 bg-muted/30 rounded-lg overflow-hidden flex items-center justify-center px-1">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i}
              className="absolute w-full h-px bg-muted-foreground"
              style={{ top: `${(i + 1) * 20}%` }}
            />
          ))}
        </div>
        
        {/* Waveform bars */}
        <div className="flex items-center gap-[2px] h-full py-1 z-10">
          {waveformData.map((value, i) => (
            <motion.div
              key={i}
              className={cn(
                "w-1 rounded-full transition-colors",
                value > 0.5 ? "bg-success" : value > 0.2 ? "bg-primary" : "bg-muted-foreground/50"
              )}
              animate={{ 
                height: Math.max(3, value * 32),
              }}
              transition={{ duration: 0.05 }}
            />
          ))}
        </div>
        
        {/* No signal overlay */}
        {isCapturing && !hasSignal && (
          <div className="absolute inset-0 flex items-center justify-center bg-warning/10">
            <span className="text-[10px] text-warning font-medium">
              Fale algo para testar
            </span>
          </div>
        )}
      </div>
      
      {/* Metrics row */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3" />
          <span>Amplitude: {(amplitude * 100).toFixed(1)}%</span>
        </div>
        
        {/* Signal strength indicator */}
        <div className="flex items-center gap-1">
          <span>Sinal:</span>
          <div className="flex gap-0.5">
            {[0.2, 0.4, 0.6, 0.8].map((threshold, i) => (
              <div
                key={i}
                className={cn(
                  "w-1 rounded-sm transition-colors",
                  signalStrength >= threshold ? "bg-success" : "bg-muted"
                )}
                style={{ height: 4 + i * 2 }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
