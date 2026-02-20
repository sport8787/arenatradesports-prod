/**
 * COGNITIVE LEAK REPORT — Visual feedback panel
 * Shown inline after evaluation when a leak pattern is detected.
 */
import { motion } from 'framer-motion';
import { Brain, AlertTriangle, ShieldAlert, Lightbulb } from 'lucide-react';
import type { DetectedLeak } from '@/services/cognitiveLeaksService';

interface CognitiveLeakReportProps {
  leak: DetectedLeak;
}

const classeIcons: Record<string, string> = {
  A: '🔴',
  B: '🟠',
  C: '🟡',
};

const classeColors: Record<string, { border: string; bg: string; text: string }> = {
  A: {
    border: 'border-[hsl(var(--destructive)_/_0.4)]',
    bg: 'bg-[hsl(var(--destructive)_/_0.06)]',
    text: 'text-[hsl(var(--destructive))]',
  },
  B: {
    border: 'border-[hsl(var(--arena-gold)_/_0.4)]',
    bg: 'bg-[hsl(var(--arena-gold)_/_0.06)]',
    text: 'text-[hsl(var(--arena-gold))]',
  },
  C: {
    border: 'border-[hsl(var(--arena-cyan)_/_0.4)]',
    bg: 'bg-[hsl(var(--arena-cyan)_/_0.06)]',
    text: 'text-[hsl(var(--arena-cyan))]',
  },
};

const CognitiveLeakReport = ({ leak }: CognitiveLeakReportProps) => {
  const colors = classeColors[leak.leak.classe] || classeColors.B;
  const icon = classeIcons[leak.leak.classe] || '🟠';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className={`border rounded-xl overflow-hidden ${colors.border} ${colors.bg}`}
    >
      {/* Header */}
      <div className={`px-5 py-3 flex items-center gap-2 border-b ${colors.border}`}>
        <Brain className={`w-5 h-5 ${colors.text}`} />
        <span className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
          Leak Cognitivo Detectado
        </span>
        <span className={`ml-auto font-mono text-xs font-bold px-2 py-0.5 rounded-full ${colors.border} ${colors.text}`}>
          {leak.confidence}% confiança
        </span>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Leak Identity */}
        <div className="flex items-start gap-3">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1">
            <p className={`font-mono text-sm font-black uppercase ${colors.text}`}>
              {leak.leak.code} — {leak.leak.title}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
              Classe {leak.leak.classe}: {leak.leak.classeLabel}
            </p>
          </div>
        </div>

        {/* Description */}
        <p className="font-mono text-sm text-foreground/80">{leak.leak.description}</p>

        {/* What went right / wrong */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="border border-[hsl(var(--destructive)_/_0.2)] rounded-lg p-3 bg-[hsl(var(--destructive)_/_0.03)]"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--destructive))]" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--destructive))] font-bold">Sintoma</span>
            </div>
            <p className="font-mono text-xs text-foreground/70">{leak.leak.symptom}</p>
            <p className="font-mono text-[10px] text-muted-foreground mt-1.5 italic">{leak.leak.innerVoice}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="border border-[hsl(var(--arena-cyan)_/_0.2)] rounded-lg p-3 bg-[hsl(var(--arena-cyan)_/_0.03)]"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-[hsl(var(--arena-cyan))]" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-cyan))] font-bold">Causa Raiz</span>
            </div>
            <p className="font-mono text-xs text-foreground/70">{leak.leak.rootCause}</p>
          </motion.div>
        </div>

        {/* Cost */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-between border-t border-[hsl(var(--border)_/_0.3)] pt-3"
        >
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Ocorrências: </span>
            <span className={`font-mono text-xs font-bold ${colors.text}`}>{leak.occurrences}x detectado</span>
          </div>
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">EV perdido estimado: </span>
            <span className="font-mono text-xs font-bold text-[hsl(var(--destructive))]">{leak.evLost}</span>
          </div>
        </motion.div>

        {/* Reprogramming */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="border border-[hsl(var(--success)_/_0.3)] rounded-lg p-4 bg-[hsl(var(--success)_/_0.04)]"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-4 h-4 text-[hsl(var(--success))]" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--success))] font-bold">Reprogramação Sugerida</span>
          </div>
          <p className="font-mono text-sm text-[hsl(var(--success))] italic">"{leak.reprogramming}"</p>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default CognitiveLeakReport;
