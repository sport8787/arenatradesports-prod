/**
 * FacialTensionHeatmap Component
 * Renders a heat map overlay on facial landmarks based on stress/tension levels
 * Colors range from green (calm) to yellow (moderate) to red (tense)
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TensionZone {
  name: string;
  landmarkIndices: number[];
  tensionLevel: number; // 0-1
}

interface FacialTensionHeatmapProps {
  landmarks: number[][] | null;
  width: number;
  height: number;
  tensionData?: {
    forehead: number;
    leftEye: number;
    rightEye: number;
    nose: number;
    leftCheek: number;
    rightCheek: number;
    mouth: number;
    jaw: number;
    overall: number;
  };
  isActive?: boolean;
  showLabels?: boolean;
  className?: string;
}

// Landmark indices for each facial zone
const ZONE_LANDMARKS = {
  forehead: [10, 67, 109, 108, 69, 104, 68, 71, 21, 54, 103, 338, 337, 336, 299, 333, 298, 301, 251, 284],
  leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
  leftBrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
  rightBrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
  nose: [1, 2, 98, 327, 4, 5, 195, 197, 6, 168],
  leftCheek: [116, 117, 118, 119, 100, 126, 142, 36, 205, 187],
  rightCheek: [345, 346, 347, 348, 329, 355, 371, 266, 425, 411],
  mouth: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308],
  jaw: [172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136],
};

// Get color for tension level (0-1)
function getTensionColor(tension: number): string {
  if (tension < 0.33) {
    // Green to yellow
    const t = tension / 0.33;
    const r = Math.round(34 + (255 - 34) * t);
    const g = Math.round(197 + (255 - 197) * t);
    const b = Math.round(94 * (1 - t));
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  } else if (tension < 0.66) {
    // Yellow to orange
    const t = (tension - 0.33) / 0.33;
    const r = 255;
    const g = Math.round(255 - (255 - 165) * t);
    const b = 0;
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  } else {
    // Orange to red
    const t = (tension - 0.66) / 0.34;
    const r = 255;
    const g = Math.round(165 * (1 - t));
    const b = 0;
    return `rgba(${r}, ${g}, ${b}, 0.6)`;
  }
}

// Get glow color for tension
function getTensionGlow(tension: number): string {
  if (tension < 0.33) return 'rgba(34, 197, 94, 0.4)';
  if (tension < 0.66) return 'rgba(255, 255, 0, 0.4)';
  return 'rgba(255, 0, 0, 0.5)';
}

export function FacialTensionHeatmap({
  landmarks,
  width,
  height,
  tensionData = {
    forehead: 0,
    leftEye: 0,
    rightEye: 0,
    nose: 0,
    leftCheek: 0,
    rightCheek: 0,
    mouth: 0,
    jaw: 0,
    overall: 0,
  },
  isActive = true,
  showLabels = false,
  className,
}: FacialTensionHeatmapProps) {
  // Calculate zone centers and render heat zones
  const heatZones = useMemo(() => {
    if (!landmarks || !isActive) return [];

    const zones: Array<{
      name: string;
      centerX: number;
      centerY: number;
      radius: number;
      tension: number;
    }> = [];

    // Map zone names to tension data
    const tensionMap: Record<string, number> = {
      forehead: tensionData.forehead,
      leftEye: tensionData.leftEye,
      rightEye: tensionData.rightEye,
      leftBrow: tensionData.forehead * 0.8,
      rightBrow: tensionData.forehead * 0.8,
      nose: tensionData.nose,
      leftCheek: tensionData.leftCheek,
      rightCheek: tensionData.rightCheek,
      mouth: tensionData.mouth,
      jaw: tensionData.jaw,
    };

    Object.entries(ZONE_LANDMARKS).forEach(([zoneName, indices]) => {
      let sumX = 0;
      let sumY = 0;
      let count = 0;

      indices.forEach((idx) => {
        if (landmarks[idx]) {
          sumX += landmarks[idx][0] * width;
          sumY += landmarks[idx][1] * height;
          count++;
        }
      });

      if (count > 0) {
        const tension = tensionMap[zoneName] || 0;
        zones.push({
          name: zoneName,
          centerX: sumX / count,
          centerY: sumY / count,
          radius: getZoneRadius(zoneName, width),
          tension,
        });
      }
    });

    return zones;
  }, [landmarks, width, height, tensionData, isActive]);

  if (!landmarks || !isActive) {
    return null;
  }

  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      <svg
        width={width}
        height={height}
        className="w-full h-full"
        style={{ mixBlendMode: 'screen' }}
      >
        <defs>
          {/* Create radial gradients for each zone */}
          {heatZones.map((zone, idx) => (
            <radialGradient
              key={`gradient-${idx}`}
              id={`heat-gradient-${idx}`}
              cx="50%"
              cy="50%"
              r="50%"
              fx="50%"
              fy="50%"
            >
              <stop offset="0%" stopColor={getTensionColor(zone.tension)} />
              <stop offset="70%" stopColor={getTensionColor(zone.tension * 0.5)} />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          ))}
        </defs>

        {/* Render heat zones */}
        {heatZones.map((zone, idx) => (
          <g key={`zone-${idx}`}>
            {/* Outer glow */}
            {zone.tension > 0.5 && (
              <motion.circle
                cx={zone.centerX}
                cy={zone.centerY}
                r={zone.radius * 1.5}
                fill="none"
                stroke={getTensionGlow(zone.tension)}
                strokeWidth={2}
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
            
            {/* Heat circle */}
            <motion.circle
              cx={zone.centerX}
              cy={zone.centerY}
              r={zone.radius}
              fill={`url(#heat-gradient-${idx})`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: zone.tension > 0.1 ? 1 : 0.3,
                scale: 1 + zone.tension * 0.2,
              }}
              transition={{ duration: 0.3 }}
            />

            {/* Pulsing effect for high tension */}
            {zone.tension > 0.6 && (
              <motion.circle
                cx={zone.centerX}
                cy={zone.centerY}
                r={zone.radius * 0.5}
                fill={getTensionColor(zone.tension)}
                animate={{ 
                  scale: [1, 1.3, 1],
                  opacity: [0.6, 0.2, 0.6],
                }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
            )}

            {/* Zone label */}
            {showLabels && zone.tension > 0.3 && (
              <text
                x={zone.centerX}
                y={zone.centerY + zone.radius + 12}
                textAnchor="middle"
                className="text-[8px] fill-white font-mono"
              >
                {zone.tension > 0.6 ? '⚠️' : ''} {(zone.tension * 100).toFixed(0)}%
              </text>
            )}
          </g>
        ))}
      </svg>

      {/* Overall tension indicator */}
      {tensionData.overall > 0.5 && (
        <motion.div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-red-500/30 border border-red-500/50"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <span className="text-[10px] font-mono text-red-400">
            TENSÃO ELEVADA: {(tensionData.overall * 100).toFixed(0)}%
          </span>
        </motion.div>
      )}
    </div>
  );
}

// Get appropriate radius for each zone
function getZoneRadius(zoneName: string, width: number): number {
  const baseRadius = width * 0.05;
  
  const radiusMultipliers: Record<string, number> = {
    forehead: 2.5,
    leftEye: 1.2,
    rightEye: 1.2,
    leftBrow: 1.5,
    rightBrow: 1.5,
    nose: 1.0,
    leftCheek: 1.8,
    rightCheek: 1.8,
    mouth: 2.0,
    jaw: 2.5,
  };

  return baseRadius * (radiusMultipliers[zoneName] || 1);
}

export default FacialTensionHeatmap;
