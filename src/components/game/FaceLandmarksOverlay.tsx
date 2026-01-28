/**
 * FaceLandmarksOverlay Component
 * Renders 478 green biometric landmarks over the video feed in real-time
 * Creates the cinematic "high-tech scanning" effect from the trailer
 * Now with heat map, animated regions, and bluff detection overlay
 */

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FACE_LANDMARKS } from '@/services/faceMeshService';
import AnimatedLandmarks from './AnimatedLandmarks';
import FacialTensionHeatmap from './FacialTensionHeatmap';
import BluffDetectionOverlay from './BluffDetectionOverlay';

interface FaceLandmarksOverlayProps {
  landmarks: number[][] | null;
  width: number;
  height: number;
  showConnections?: boolean;
  highlightAnomalies?: boolean;
  anomalyIndices?: number[];
  isScanning?: boolean;
  // New enhanced props
  microExpression?: string | null;
  gazeDeviation?: number;
  stressLevel?: number;
  lipTension?: number;
  showHeatmap?: boolean;
  showAnimatedHighlights?: boolean;
  enableBluffAlerts?: boolean;
  className?: string;
}

// Connection paths for facial regions
const FACE_CONNECTIONS = {
  faceOval: FACE_LANDMARKS.FACE_OVAL,
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33],
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362],
  leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightBrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61],
  lipsInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78],
  leftIris: [468, 469, 470, 471, 472],
  rightIris: [473, 474, 475, 476, 477],
};

// Key landmark indices for drawing individual points
const KEY_LANDMARKS = [
  33, 133, 145, 159, 263, 362, 374, 386, // Eyes
  70, 107, 300, 336, // Eyebrows
  4, 168, 1, 2, 98, 327, // Nose
  61, 291, 13, 14, 78, 308, // Lips
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, // Face outline
  172, 397, 152, // Jaw
  468, 473, // Iris centers
];

export function FaceLandmarksOverlay({
  landmarks,
  width,
  height,
  showConnections = true,
  highlightAnomalies = false,
  anomalyIndices = [],
  isScanning = false,
  microExpression = null,
  gazeDeviation = 0,
  stressLevel = 0,
  lipTension = 0,
  showHeatmap = false,
  showAnimatedHighlights = true,
  enableBluffAlerts = true,
  className,
}: FaceLandmarksOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanLineRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Bluff alert state
  const [showBluffAlert, setShowBluffAlert] = useState(false);
  const [alertType, setAlertType] = useState<'suspicious' | 'micro-expression' | 'gaze-deviation' | 'stress-spike'>('suspicious');
  const lastAlertTimeRef = useRef(0);

  // Check for bluff detection triggers
  const checkBluffTriggers = useCallback(() => {
    if (!enableBluffAlerts) return;
    
    const now = Date.now();
    if (now - lastAlertTimeRef.current < 5000) return; // Cooldown between alerts

    // Suspicious pattern: high stress + fear/contempt expression
    if (stressLevel > 70 && (microExpression === 'fear' || microExpression === 'contempt')) {
      setAlertType('suspicious');
      setShowBluffAlert(true);
      lastAlertTimeRef.current = now;
      return;
    }

    // Micro-expression detected (non-neutral, non-happy)
    if (microExpression && !['neutral', 'happiness'].includes(microExpression) && stressLevel > 50) {
      setAlertType('micro-expression');
      setShowBluffAlert(true);
      lastAlertTimeRef.current = now;
      return;
    }

    // Significant gaze deviation
    if (gazeDeviation > 60) {
      setAlertType('gaze-deviation');
      setShowBluffAlert(true);
      lastAlertTimeRef.current = now;
      return;
    }

    // Stress spike
    if (stressLevel > 80) {
      setAlertType('stress-spike');
      setShowBluffAlert(true);
      lastAlertTimeRef.current = now;
    }
  }, [enableBluffAlerts, stressLevel, microExpression, gazeDeviation]);

  // Monitor for bluff triggers
  useEffect(() => {
    checkBluffTriggers();
  }, [stressLevel, microExpression, gazeDeviation, checkBluffTriggers]);

  // Memoize landmark scaling
  const scaledLandmarks = useMemo(() => {
    if (!landmarks) return null;
    return landmarks.map(([x, y]) => [x * width, y * height]);
  }, [landmarks, width, height]);

  // Calculate tension data for heatmap
  const tensionData = useMemo(() => ({
    forehead: Math.min(1, stressLevel / 100 * 0.8),
    leftEye: Math.min(1, (stressLevel / 100) * 0.6 + (gazeDeviation / 100) * 0.4),
    rightEye: Math.min(1, (stressLevel / 100) * 0.6 + (gazeDeviation / 100) * 0.4),
    nose: Math.min(1, stressLevel / 100 * 0.3),
    leftCheek: Math.min(1, stressLevel / 100 * 0.5),
    rightCheek: Math.min(1, stressLevel / 100 * 0.5),
    mouth: Math.min(1, lipTension / 100),
    jaw: Math.min(1, (lipTension / 100) * 0.7 + (stressLevel / 100) * 0.3),
    overall: stressLevel / 100,
  }), [stressLevel, gazeDeviation, lipTension]);

  // Draw base landmarks and connections (without animations - those are in AnimatedLandmarks)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scaledLandmarks || showAnimatedHighlights) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      // Draw scan line effect if scanning
      if (isScanning) {
        const scanY = (scanLineRef.current % height);
        const gradient = ctx.createLinearGradient(0, scanY - 20, 0, scanY + 20);
        gradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
        gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0.3)');
        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, scanY - 20, width, 40);
        
        scanLineRef.current = (scanLineRef.current + 3) % height;
      }

      // Draw connections
      if (showConnections) {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        Object.entries(FACE_CONNECTIONS).forEach(([, indices]) => {
          if (indices.length < 2) return;
          
          ctx.beginPath();
          const firstPoint = scaledLandmarks[indices[0]];
          if (firstPoint) {
            ctx.moveTo(firstPoint[0], firstPoint[1]);
            
            for (let i = 1; i < indices.length; i++) {
              const point = scaledLandmarks[indices[i]];
              if (point) {
                ctx.lineTo(point[0], point[1]);
              }
            }
          }
          ctx.stroke();
        });
      }

      // Draw landmarks
      scaledLandmarks.forEach(([x, y], index) => {
        const isKey = KEY_LANDMARKS.includes(index);
        const isAnomaly = highlightAnomalies && anomalyIndices.includes(index);
        const isIris = index >= 468 && index <= 477;
        
        let pointSize = 1.5;
        if (isKey) pointSize = 2.5;
        if (isIris) pointSize = 3;
        if (isAnomaly) pointSize = 4;

        if (isKey || isAnomaly) {
          const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, pointSize * 3);
          glowGradient.addColorStop(0, isAnomaly ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)');
          glowGradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
          
          ctx.beginPath();
          ctx.arc(x, y, pointSize * 3, 0, Math.PI * 2);
          ctx.fillStyle = glowGradient;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, Math.PI * 2);
        
        if (isAnomaly) {
          ctx.fillStyle = '#ef4444';
        } else if (isIris) {
          ctx.fillStyle = '#3b82f6';
        } else {
          ctx.fillStyle = '#22c55e';
        }
        ctx.fill();
      });

      if (isScanning) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scaledLandmarks, width, height, showConnections, highlightAnomalies, anomalyIndices, isScanning, showAnimatedHighlights]);

  if (!landmarks) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className={cn('absolute inset-0 pointer-events-none', className)}
      >
        {/* Heat map layer (behind landmarks) */}
        {showHeatmap && (
          <FacialTensionHeatmap
            landmarks={landmarks}
            width={width}
            height={height}
            tensionData={tensionData}
            isActive={true}
            showLabels={stressLevel > 50}
          />
        )}

        {/* Animated landmarks with expression highlights (replaces basic canvas) */}
        {showAnimatedHighlights ? (
          <AnimatedLandmarks
            landmarks={landmarks}
            width={width}
            height={height}
            microExpression={microExpression}
            gazeDeviation={gazeDeviation}
            stressLevel={stressLevel}
            showConnections={showConnections}
            isActive={true}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full"
            style={{ mixBlendMode: 'screen' }}
          />
        )}
        
        {/* Corner brackets for scanning effect */}
        <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-success/60" />
        <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-success/60" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-success/60" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-success/60" />
        
        {/* Scanning label */}
        {isScanning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="absolute top-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-success/20 border border-success/40 rounded text-xs text-success font-mono"
          >
            ANALISANDO 478 LANDMARKS
          </motion.div>
        )}

        {/* Bluff detection overlay */}
        {enableBluffAlerts && (
          <BluffDetectionOverlay
            isActive={showBluffAlert}
            alertType={alertType}
            stressScore={stressLevel}
            microExpression={microExpression || undefined}
            onDismiss={() => setShowBluffAlert(false)}
            autoHideDuration={3000}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default FaceLandmarksOverlay;
