/**
 * MycroftPreviewPanel - Preview da análise do Mycroft para o apresentador
 * Exibido antes de liberar para o júri
 */

import { motion } from 'framer-motion';
import { Brain, Eye, Send, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import GoldButton from '@/components/game/GoldButton';
import { cn } from '@/lib/utils';

interface MycroftAnalysis {
  verdict: string;
  confidence: number;
  forensicDetails: string;
  metrics?: Record<string, unknown>;
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
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-red-400';
    if (confidence >= 40) return 'text-yellow-400';
    return 'text-emerald-400';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 70) return 'Alta suspeita de blefe';
    if (confidence >= 40) return 'Inconclusivo';
    return 'Provavelmente verdade';
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
          <div>
            <p className="font-semibold text-success">Análise Liberada para o Júri</p>
            <p className="text-xs text-muted-foreground">
              O júri está visualizando a análise forense
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-purple-900/20 border border-purple-500/50 rounded-xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-purple-500/30 bg-purple-900/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <p className="font-semibold text-purple-300 flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview da Análise
            </p>
            <p className="text-xs text-muted-foreground">
              Somente você pode ver isso
            </p>
          </div>
        </div>
        <GoldButton
          onClick={onRelease}
          size="sm"
        >
          <Send className="w-4 h-4 mr-2" />
          Liberar para Júri
        </GoldButton>
      </div>

      {/* Analysis Content */}
      <div className="p-4 space-y-4">
        {/* Confidence Meter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Nível de Suspeita</span>
            <span className={cn("font-bold", getConfidenceColor(analysis.confidence))}>
              {analysis.confidence}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${analysis.confidence}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={cn(
                "h-full rounded-full",
                analysis.confidence >= 70 ? "bg-gradient-to-r from-red-500 to-red-400" :
                analysis.confidence >= 40 ? "bg-gradient-to-r from-yellow-500 to-yellow-400" :
                "bg-gradient-to-r from-emerald-500 to-emerald-400"
              )}
            />
          </div>
          <p className={cn("text-xs text-center font-medium", getConfidenceColor(analysis.confidence))}>
            {getConfidenceLabel(analysis.confidence)}
          </p>
        </div>

        {/* Verdict */}
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Veredito:</p>
          <p className="text-sm font-medium">{analysis.verdict}</p>
        </div>

        {/* Forensic Details */}
        <div className="bg-background/30 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Análise Forense:
          </p>
          <p className="text-sm text-purple-200">{analysis.forensicDetails}</p>
        </div>

        {/* Metrics Preview */}
        {analysis.metrics && (
          <div className="bg-background/30 rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-2">Métricas Vocais:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {Object.entries(analysis.metrics).slice(0, 4).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-purple-300 font-mono">
                    {typeof value === 'number' ? value.toFixed(2) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default MycroftPreviewPanel;
