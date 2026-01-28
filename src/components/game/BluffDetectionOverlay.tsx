/**
 * BluffDetectionOverlay Component
 * Cinematic overlay that appears when suspicious patterns are detected
 * Features glitch effect, scanlines, and dramatic alerts
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Scan, Eye, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BluffDetectionOverlayProps {
  isActive: boolean;
  alertType?: 'suspicious' | 'micro-expression' | 'gaze-deviation' | 'stress-spike';
  stressScore?: number;
  microExpression?: string;
  onDismiss?: () => void;
  autoHideDuration?: number;
}

const ALERT_MESSAGES = {
  'suspicious': {
    title: '⚠️ PADRÃO SUSPEITO DETECTADO',
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/60',
  },
  'micro-expression': {
    title: '🎭 MICRO-EXPRESSÃO CAPTURADA',
    icon: Eye,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500/60',
  },
  'gaze-deviation': {
    title: '👁️ DESVIO DE OLHAR DETECTADO',
    icon: Scan,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/60',
  },
  'stress-spike': {
    title: '📊 PICO DE TENSÃO FACIAL',
    icon: Brain,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/60',
  },
};

// Glitch text effect component
function GlitchText({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <span className="relative z-10">{text}</span>
      <span 
        className="absolute top-0 left-0.5 text-cyan-400 opacity-70 animate-pulse" 
        aria-hidden
      >
        {text}
      </span>
      <span 
        className="absolute top-0 -left-0.5 text-red-400 opacity-70 animate-pulse" 
        style={{ animationDelay: '0.1s' }}
        aria-hidden
      >
        {text}
      </span>
    </div>
  );
}

// Scanline effect component
function Scanlines() {
  return (
    <div 
      className="absolute inset-0 pointer-events-none z-10 opacity-20"
      style={{
        backgroundImage: `repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 0, 0, 0.3) 2px,
          rgba(0, 0, 0, 0.3) 4px
        )`,
      }}
    />
  );
}

export function BluffDetectionOverlay({
  isActive,
  alertType = 'suspicious',
  stressScore,
  microExpression,
  onDismiss,
  autoHideDuration = 3000,
}: BluffDetectionOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, autoHideDuration);

      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isActive, autoHideDuration, onDismiss]);

  const alertConfig = ALERT_MESSAGES[alertType];
  const IconComponent = alertConfig.icon;

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 pointer-events-none z-50 overflow-hidden"
        >
          {/* Dark vignette overlay */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-black/30 to-black/60" />
          
          {/* Scanlines effect */}
          <Scanlines />
          
          {/* Alert box */}
          <motion.div
            initial={{ y: -20, opacity: 0, scale: 0.95 }}
            animate={{ 
              y: 0, 
              opacity: 1, 
              scale: 1,
            }}
            exit={{ y: -20, opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 15, stiffness: 300 }}
            className={cn(
              'absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'px-6 py-4 rounded-lg border-2',
              alertConfig.bgColor,
              alertConfig.borderColor,
              'backdrop-blur-md shadow-2xl'
            )}
          >
            {/* Flashing border effect */}
            <motion.div
              className={cn('absolute inset-0 rounded-lg border-2', alertConfig.borderColor)}
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            
            {/* Icon */}
            <div className="flex items-center gap-3 mb-2">
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                <IconComponent className={cn('w-6 h-6', alertConfig.color)} />
              </motion.div>
              
              <GlitchText 
                text={alertConfig.title} 
                className={cn('font-bold font-mono text-sm', alertConfig.color)}
              />
            </div>
            
            {/* Additional info */}
            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
              {stressScore !== undefined && (
                <span>
                  Stress: <span className={alertConfig.color}>{stressScore.toFixed(0)}%</span>
                </span>
              )}
              {microExpression && (
                <span>
                  Expressão: <span className={alertConfig.color}>{microExpression}</span>
                </span>
              )}
            </div>
          </motion.div>
          
          {/* Corner brackets animation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-8"
          >
            {/* Top left */}
            <motion.div 
              className={cn('absolute top-0 left-0 w-12 h-12 border-l-2 border-t-2', alertConfig.borderColor)}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            {/* Top right */}
            <motion.div 
              className={cn('absolute top-0 right-0 w-12 h-12 border-r-2 border-t-2', alertConfig.borderColor)}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.25 }}
            />
            {/* Bottom left */}
            <motion.div 
              className={cn('absolute bottom-0 left-0 w-12 h-12 border-l-2 border-b-2', alertConfig.borderColor)}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
            />
            {/* Bottom right */}
            <motion.div 
              className={cn('absolute bottom-0 right-0 w-12 h-12 border-r-2 border-b-2', alertConfig.borderColor)}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1, repeat: Infinity, delay: 0.75 }}
            />
          </motion.div>
          
          {/* Radar sweep effect */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `conic-gradient(from 0deg, transparent 0deg, rgba(34, 197, 94, 0.1) 30deg, transparent 60deg)`,
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default BluffDetectionOverlay;
