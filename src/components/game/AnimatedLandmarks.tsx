/**
 * AnimatedLandmarks Component
 * Enhanced facial landmarks with pulsing animations when micro-expressions are detected
 * Highlights specific facial regions based on detected events
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface HighlightedRegion {
  name: string;
  landmarkIndices: number[];
  color: string;
  pulse: boolean;
  intensity: number; // 0-1
}

interface AnimatedLandmarksProps {
  landmarks: number[][] | null;
  width: number;
  height: number;
  microExpression?: string | null;
  gazeDeviation?: number; // 0-100
  stressLevel?: number; // 0-100
  highlightedRegions?: HighlightedRegion[];
  showConnections?: boolean;
  isActive?: boolean;
  className?: string;
}

// Facial region landmark mappings
const FACIAL_REGIONS = {
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightBrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  forehead: [10, 67, 109, 108, 69, 104, 68, 71, 21, 54, 103, 338, 337, 336, 299, 333, 298, 301, 251, 284],
  mouth: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
  jaw: [172, 58, 132, 93, 234, 127, 162, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136],
  nose: [1, 2, 98, 327, 4, 5, 195, 197, 6, 168],
  leftIris: [468, 469, 470, 471, 472],
  rightIris: [473, 474, 475, 476, 477],
};

// Micro-expression to region mapping
const EXPRESSION_REGIONS: Record<string, { regions: string[]; color: string }> = {
  surprise: { regions: ['leftBrow', 'rightBrow', 'forehead', 'mouth'], color: '#fbbf24' },
  fear: { regions: ['forehead', 'leftEye', 'rightEye', 'leftBrow', 'rightBrow'], color: '#f87171' },
  contempt: { regions: ['mouth', 'jaw'], color: '#c084fc' },
  disgust: { regions: ['nose', 'mouth'], color: '#4ade80' },
  anger: { regions: ['leftBrow', 'rightBrow', 'jaw'], color: '#ef4444' },
  happiness: { regions: ['mouth', 'leftEye', 'rightEye'], color: '#22c55e' },
  sadness: { regions: ['mouth', 'leftBrow', 'rightBrow'], color: '#3b82f6' },
};

export function AnimatedLandmarks({
  landmarks,
  width,
  height,
  microExpression,
  gazeDeviation = 0,
  stressLevel = 0,
  highlightedRegions = [],
  showConnections = true,
  isActive = true,
  className,
}: AnimatedLandmarksProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const pulsePhaseRef = useRef(0);

  // Calculate regions to highlight based on micro-expression
  const activeHighlights = useMemo(() => {
    const highlights: HighlightedRegion[] = [...highlightedRegions];

    // Add expression-based highlights
    if (microExpression && EXPRESSION_REGIONS[microExpression]) {
      const config = EXPRESSION_REGIONS[microExpression];
      config.regions.forEach((regionName) => {
        if (FACIAL_REGIONS[regionName as keyof typeof FACIAL_REGIONS]) {
          highlights.push({
            name: regionName,
            landmarkIndices: FACIAL_REGIONS[regionName as keyof typeof FACIAL_REGIONS],
            color: config.color,
            pulse: true,
            intensity: 0.8,
          });
        }
      });
    }

    // Add gaze deviation highlights
    if (gazeDeviation > 30) {
      highlights.push({
        name: 'leftEye',
        landmarkIndices: [...FACIAL_REGIONS.leftEye, ...FACIAL_REGIONS.leftIris],
        color: '#fbbf24',
        pulse: true,
        intensity: gazeDeviation / 100,
      });
      highlights.push({
        name: 'rightEye',
        landmarkIndices: [...FACIAL_REGIONS.rightEye, ...FACIAL_REGIONS.rightIris],
        color: '#fbbf24',
        pulse: true,
        intensity: gazeDeviation / 100,
      });
    }

    return highlights;
  }, [microExpression, gazeDeviation, highlightedRegions]);

  // Create a set of highlighted landmark indices for quick lookup
  const highlightedIndices = useMemo(() => {
    const indexMap = new Map<number, { color: string; pulse: boolean; intensity: number }>();
    
    activeHighlights.forEach((region) => {
      region.landmarkIndices.forEach((idx) => {
        // Higher intensity overrides lower
        const existing = indexMap.get(idx);
        if (!existing || region.intensity > existing.intensity) {
          indexMap.set(idx, {
            color: region.color,
            pulse: region.pulse,
            intensity: region.intensity,
          });
        }
      });
    });

    return indexMap;
  }, [activeHighlights]);

  // Draw animated landmarks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !landmarks || !isActive) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      pulsePhaseRef.current += 0.1;

      // Draw connections first
      if (showConnections) {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.lineWidth = 1;

        // Draw region connections
        Object.values(FACIAL_REGIONS).forEach((indices) => {
          if (indices.length < 2) return;
          
          ctx.beginPath();
          const firstPoint = landmarks[indices[0]];
          if (firstPoint) {
            ctx.moveTo(firstPoint[0] * width, firstPoint[1] * height);
            
            for (let i = 1; i < indices.length; i++) {
              const point = landmarks[indices[i]];
              if (point) {
                ctx.lineTo(point[0] * width, point[1] * height);
              }
            }
          }
          ctx.stroke();
        });
      }

      // Draw all landmarks with highlighting
      landmarks.forEach(([x, y], index) => {
        const scaledX = x * width;
        const scaledY = y * height;
        
        const highlight = highlightedIndices.get(index);
        const isIris = index >= 468 && index <= 477;
        
        let pointSize = 1.5;
        let color = '#22c55e'; // Default green
        let pulseEffect = false;

        if (highlight) {
          pointSize = 3 + highlight.intensity * 2;
          color = highlight.color;
          pulseEffect = highlight.pulse;
        } else if (isIris) {
          pointSize = 2.5;
          color = '#3b82f6';
        }

        // Pulse animation
        if (pulseEffect) {
          const pulse = Math.sin(pulsePhaseRef.current) * 0.5 + 0.5;
          pointSize += pulse * 2;
        }

        // Glow effect for highlighted points
        if (highlight && highlight.intensity > 0.5) {
          const glowSize = pointSize * 3;
          const gradient = ctx.createRadialGradient(scaledX, scaledY, 0, scaledX, scaledY, glowSize);
          gradient.addColorStop(0, color.replace(')', ', 0.6)').replace('rgb', 'rgba').replace('#', 'rgba('));
          gradient.addColorStop(1, 'transparent');
          
          ctx.beginPath();
          ctx.arc(scaledX, scaledY, glowSize, 0, Math.PI * 2);
          ctx.fillStyle = `${color}40`;
          ctx.fill();
        }

        // Draw point
        ctx.beginPath();
        ctx.arc(scaledX, scaledY, pointSize, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [landmarks, width, height, highlightedIndices, showConnections, isActive]);

  if (!landmarks || !isActive) {
    return null;
  }

  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
        style={{ mixBlendMode: 'screen' }}
      />

      {/* Expression label */}
      <AnimatePresence>
        {microExpression && microExpression !== 'neutral' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'absolute top-4 right-4 px-3 py-1.5 rounded-lg',
              'bg-background/80 backdrop-blur-sm border',
              'text-xs font-mono'
            )}
            style={{ 
              borderColor: EXPRESSION_REGIONS[microExpression]?.color || '#22c55e',
              color: EXPRESSION_REGIONS[microExpression]?.color || '#22c55e',
            }}
          >
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              🎭 {microExpression.toUpperCase()}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gaze deviation indicator */}
      <AnimatePresence>
        {gazeDeviation > 30 && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute top-4 left-4 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/50 text-xs font-mono text-yellow-500"
          >
            👁️ Desvio: {gazeDeviation.toFixed(0)}%
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stress level indicator */}
      <AnimatePresence>
        {stressLevel > 60 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/50 text-xs font-mono text-red-500"
          >
            <motion.span
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              ⚠️ TENSÃO: {stressLevel.toFixed(0)}%
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AnimatedLandmarks;
