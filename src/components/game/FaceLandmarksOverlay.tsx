/**
 * FaceLandmarksOverlay Component
 * Renders 478 green biometric landmarks over the video feed in real-time
 * Creates the cinematic "high-tech scanning" effect from the trailer
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FACE_LANDMARKS } from '@/services/faceMeshService';

interface FaceLandmarksOverlayProps {
  landmarks: number[][] | null;
  width: number;
  height: number;
  showConnections?: boolean;
  highlightAnomalies?: boolean;
  anomalyIndices?: number[];
  isScanning?: boolean;
  className?: string;
}

// Connection paths for facial regions
const FACE_CONNECTIONS = {
  // Face oval (contour)
  faceOval: FACE_LANDMARKS.FACE_OVAL,
  
  // Left eye
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33],
  
  // Right eye  
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398, 362],
  
  // Left eyebrow
  leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  
  // Right eyebrow
  rightBrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  
  // Lips outer
  lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185, 61],
  
  // Lips inner
  lipsInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191, 78],
  
  // Left iris
  leftIris: [468, 469, 470, 471, 472],
  
  // Right iris
  rightIris: [473, 474, 475, 476, 477],
};

// Key landmark indices for drawing individual points
const KEY_LANDMARKS = [
  // Eyes
  33, 133, 145, 159, 263, 362, 374, 386,
  // Eyebrows
  70, 107, 300, 336,
  // Nose
  4, 168, 1, 2, 98, 327,
  // Lips
  61, 291, 13, 14, 78, 308,
  // Face outline
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
  // Jaw
  172, 397, 152,
  // Iris centers
  468, 473,
];

export function FaceLandmarksOverlay({
  landmarks,
  width,
  height,
  showConnections = true,
  highlightAnomalies = false,
  anomalyIndices = [],
  isScanning = false,
  className,
}: FaceLandmarksOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanLineRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);

  // Memoize landmark scaling
  const scaledLandmarks = useMemo(() => {
    if (!landmarks) return null;
    return landmarks.map(([x, y]) => [x * width, y * height]);
  }, [landmarks, width, height]);

  // Draw landmarks and connections
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !scaledLandmarks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Set global composite operation for glow effect
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

      // Draw connections first (behind points)
      if (showConnections) {
        ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
        ctx.lineWidth = 1;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw each connection group
        Object.entries(FACE_CONNECTIONS).forEach(([key, indices]) => {
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

      // Draw all 478 landmark points
      scaledLandmarks.forEach(([x, y], index) => {
        const isKey = KEY_LANDMARKS.includes(index);
        const isAnomaly = highlightAnomalies && anomalyIndices.includes(index);
        const isIris = index >= 468 && index <= 477;
        
        // Point size based on importance
        let pointSize = 1.5;
        if (isKey) pointSize = 2.5;
        if (isIris) pointSize = 3;
        if (isAnomaly) pointSize = 4;

        // Glow effect for key points
        if (isKey || isAnomaly) {
          const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, pointSize * 3);
          glowGradient.addColorStop(0, isAnomaly ? 'rgba(239, 68, 68, 0.6)' : 'rgba(34, 197, 94, 0.6)');
          glowGradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
          
          ctx.beginPath();
          ctx.arc(x, y, pointSize * 3, 0, Math.PI * 2);
          ctx.fillStyle = glowGradient;
          ctx.fill();
        }

        // Draw point
        ctx.beginPath();
        ctx.arc(x, y, pointSize, 0, Math.PI * 2);
        
        if (isAnomaly) {
          ctx.fillStyle = '#ef4444'; // Red for anomalies
        } else if (isIris) {
          ctx.fillStyle = '#3b82f6'; // Blue for iris
        } else {
          ctx.fillStyle = '#22c55e'; // Green for normal
        }
        ctx.fill();
      });

      // Continue animation if scanning
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
  }, [scaledLandmarks, width, height, showConnections, highlightAnomalies, anomalyIndices, isScanning]);

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
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full"
          style={{ mixBlendMode: 'screen' }}
        />
        
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
      </motion.div>
    </AnimatePresence>
  );
}

export default FaceLandmarksOverlay;
