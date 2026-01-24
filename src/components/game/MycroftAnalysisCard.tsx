// Mycroft 2.0 Analysis Card - Human-readable verdict with confidence
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Shield, 
  AlertTriangle, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp,
  Eye,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import type { VocalAnalysisResult } from '@/services/mycroft2Engine';

interface Props {
  analysis: VocalAnalysisResult;
  showTechnicalDetails?: boolean;
}

export function MycroftAnalysisCard({ analysis, showTechnicalDetails = true }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Zone colors and icons
  const zoneConfig = {
    truth: {
      bg: 'bg-emerald-900/40',
      border: 'border-emerald-500/50',
      text: 'text-emerald-400',
      icon: Shield,
      label: 'Convicção Alta',
      barColor: 'bg-emerald-500',
    },
    attention: {
      bg: 'bg-yellow-900/40',
      border: 'border-yellow-500/50',
      text: 'text-yellow-400',
      icon: AlertTriangle,
      label: 'Zona de Atenção',
      barColor: 'bg-yellow-500',
    },
    bluff: {
      bg: 'bg-red-900/40',
      border: 'border-red-500/50',
      text: 'text-red-400',
      icon: AlertCircle,
      label: 'Zona de Blefe',
      barColor: 'bg-red-500',
    },
  };

  const config = zoneConfig[analysis.zone];
  const ZoneIcon = config.icon;

  // Confidence badge colors
  const confidenceConfig = {
    low: { bg: 'bg-muted', text: 'text-muted-foreground', label: 'Baixa' },
    medium: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Média' },
    high: { bg: 'bg-purple-900/50', text: 'text-purple-400', label: 'Alta' },
  };

  const confConfig = confidenceConfig[analysis.confidence];

  // Signal icon
  const getSignalIcon = (signal: string) => {
    if (signal === 'pro-conviction') return <TrendingDown className="w-3 h-3 text-emerald-400" />;
    if (signal === 'pro-bluff') return <TrendingUp className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border-2 ${config.border} ${config.bg} p-4 space-y-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${config.bg} ${config.border} border`}>
            <Brain className={`w-5 h-5 ${config.text}`} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-muted-foreground">Leitura do Mycroft</h3>
            <p className={`text-lg font-bold ${config.text}`}>{analysis.scenarioText.title}</p>
          </div>
        </div>
        
        {/* Confidence Badge */}
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${confConfig.bg} ${confConfig.text}`}>
          Confiança: {confConfig.label}
        </div>
      </div>

      {/* Scenario Text */}
      <div className="space-y-2">
        <p className="text-sm text-foreground/90 leading-relaxed">
          {analysis.scenarioText.body}
        </p>
        <p className={`text-base font-semibold ${config.text}`}>
          ➡️ {analysis.scenarioText.conclusion}
        </p>
      </div>

      {/* Visual Bar Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <ZoneIcon className="w-3 h-3" />
            {config.label}
          </span>
          <span>{analysis.stressScore}/100</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${analysis.stressScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={`h-full ${config.barColor} rounded-full`}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Verdade</span>
          <span>Atenção</span>
          <span>Blefe</span>
        </div>
      </div>

      {/* Reasoning & Counterpoint */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <div className="text-xs">
          <span className="text-muted-foreground">📊 Análise: </span>
          <span className="text-foreground/80">{analysis.reasoning}</span>
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">⚖️ Contraponto: </span>
          <span className="text-foreground/60">{analysis.counterpoint}</span>
        </div>
      </div>

      {/* Correct Answer Badge */}
      {analysis.wasCorrect !== undefined && (
        <div className="pt-2">
          {analysis.wasCorrect ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-900/50 text-emerald-400 text-xs rounded-full">
              ✓ Resposta Correta
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/50 text-red-400 text-xs rounded-full">
              ✗ Resposta Incorreta
            </span>
          )}
        </div>
      )}

      {/* Technical Details Toggle */}
      {showTechnicalDetails && (
        <div className="pt-2 border-t border-border/50">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="w-3 h-3" />
            Ver análise técnica
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(analysis.features).map(([key, feature]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between p-2 bg-muted/30 rounded"
                    >
                      <span className="text-muted-foreground capitalize">{key}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{feature.value.toFixed(1)}</span>
                        {getSignalIcon(feature.signal)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">
                  Desvio: Verde = Pro-Convicção | Vermelho = Pro-Blefe | Neutro = Normal
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
