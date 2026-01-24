/**
 * RecordingModeSelector Component
 * Allows player to choose between audio-only or video recording
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Video, ChevronRight, Eye, Waves, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type RecordingMode = 'audio' | 'video';

interface RecordingModeSelectorProps {
  onSelect: (mode: RecordingMode) => void;
  mycroftConsent: boolean | null;
  disabled?: boolean;
}

export default function RecordingModeSelector({
  onSelect,
  mycroftConsent,
  disabled = false,
}: RecordingModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<RecordingMode | null>(null);

  const modes = [
    {
      id: 'audio' as RecordingMode,
      title: 'Apenas Áudio',
      description: 'Grave sua justificativa com análise vocal',
      icon: Mic,
      features: [
        'Análise de pitch e tom de voz',
        'Detecção de hesitações',
        'Jitter e Shimmer vocal',
      ],
      badge: 'Clássico',
      badgeColor: 'bg-primary/20 text-primary',
    },
    {
      id: 'video' as RecordingMode,
      title: 'Vídeo + Áudio',
      description: 'Análise completa com micro-expressões faciais',
      icon: Video,
      features: [
        'Tudo do modo áudio +',
        'Rastreamento de olhar (PNL)',
        'Micro-expressões faciais',
        'Análise de tensão facial',
      ],
      badge: 'Mycroft 2.0',
      badgeColor: 'bg-success/20 text-success',
      recommended: true,
    },
  ];

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-bold mb-2">Como você quer gravar sua justificativa?</h3>
        <p className="text-sm text-muted-foreground">
          Escolha o modo de gravação para sua defesa
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isHovered = hoveredMode === mode.id;
          
          return (
            <motion.button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              onMouseEnter={() => setHoveredMode(mode.id)}
              onMouseLeave={() => setHoveredMode(null)}
              disabled={disabled}
              className={cn(
                "relative p-5 rounded-xl border-2 text-left transition-all",
                "hover:border-primary hover:bg-primary/5",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                mode.recommended 
                  ? "border-success/50 bg-success/5" 
                  : "border-border bg-background/50"
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Recommended badge */}
              {mode.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-success text-success-foreground text-xs font-bold rounded-full">
                  Recomendado
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  mode.recommended ? "bg-success/20" : "bg-primary/20"
                )}>
                  <Icon className={cn(
                    "w-6 h-6",
                    mode.recommended ? "text-success" : "text-primary"
                  )} />
                </div>
                
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  mode.badgeColor
                )}>
                  {mode.badge}
                </span>
              </div>

              {/* Title & Description */}
              <h4 className="text-base font-semibold mb-1">{mode.title}</h4>
              <p className="text-sm text-muted-foreground mb-4">{mode.description}</p>

              {/* Features */}
              <ul className="space-y-2 mb-4">
                {mode.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {mode.id === 'audio' ? (
                      <Waves className="w-3 h-3 text-primary shrink-0" />
                    ) : (
                      <Eye className="w-3 h-3 text-success shrink-0" />
                    )}
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Select indicator */}
              <div className={cn(
                "flex items-center justify-center gap-2 py-2 rounded-lg transition-colors",
                isHovered 
                  ? mode.recommended ? "bg-success/20 text-success" : "bg-primary/20 text-primary"
                  : "bg-muted/50 text-muted-foreground"
              )}>
                <span className="text-sm font-medium">Selecionar</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Privacy notice */}
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Shield className="w-4 h-4" />
        <span>
          {mycroftConsent 
            ? 'Mycroft está ativado para análise comportamental' 
            : 'Configure o Mycroft para análise avançada'}
        </span>
      </div>
    </div>
  );
}
