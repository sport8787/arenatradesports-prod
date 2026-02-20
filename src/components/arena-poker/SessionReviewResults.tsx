import { motion } from 'framer-motion';
import { TrendingDown, Target, Calendar, Tag, AlertTriangle, Brain, BookOpen } from 'lucide-react';

interface RecurringLeak {
  title: string;
  frequency: number;
  severity: 'grave' | 'atencao' | 'info';
  description: string;
  hands: number[];
}

interface TrainingSession {
  day: string;
  focus: string;
  exercises: string[];
}

interface SessionReviewData {
  totalHands: number;
  overallScore: number;
  recurringLeaks: RecurringLeak[];
  spotClusters: { type: string; count: number; insight: string }[];
  trainingPlan: TrainingSession[];
  tags: string[];
  summary: string;
}

interface SessionReviewResultsProps {
  data: SessionReviewData;
}

const severityConfig = {
  grave: { color: 'border-red-500/30 bg-red-500/10 text-red-400', icon: '🔴' },
  atencao: { color: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400', icon: '🟡' },
  info: { color: 'border-[hsl(var(--arena-cyan)_/_0.3)] bg-[hsl(var(--arena-cyan)_/_0.1)] text-[hsl(var(--arena-cyan))]', icon: '🔵' },
};

const SessionReviewResults = ({ data }: SessionReviewResultsProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="space-y-4"
  >
    {/* Header Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: 'Mãos Analisadas', value: data.totalHands, icon: BookOpen },
        { label: 'Score Geral', value: `${data.overallScore}/100`, icon: Target },
        { label: 'Leaks Recorrentes', value: data.recurringLeaks.length, icon: AlertTriangle },
        { label: 'Clusters', value: data.spotClusters.length, icon: Brain },
      ].map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="border border-[hsl(var(--arena-gold)_/_0.2)] bg-black/60 rounded-lg p-3 text-center"
        >
          <stat.icon className="w-4 h-4 text-[hsl(var(--arena-gold))] mx-auto mb-1" />
          <div className="font-mono text-lg font-bold text-[hsl(var(--arena-gold))]">{stat.value}</div>
          <div className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
        </motion.div>
      ))}
    </div>

    {/* Summary */}
    <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] bg-black/60 rounded-lg p-4">
      <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-cyan))] mb-2">
        Resumo da Sessão
      </h3>
      <p className="text-sm text-foreground/80 leading-relaxed">{data.summary}</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Recurring Leaks */}
      <div className="border border-red-500/20 bg-black/60 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-red-400" />
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-red-400">
            Leaks Recorrentes
          </h3>
        </div>
        <div className="space-y-2">
          {data.recurringLeaks.map((leak, i) => {
            const cfg = severityConfig[leak.severity];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
                className={`p-3 rounded-md border ${cfg.color}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold">{cfg.icon} {leak.title}</span>
                  <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-current opacity-70">
                    {leak.frequency}x detectado
                  </span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed">{leak.description}</p>
                <span className="font-mono text-[9px] opacity-50 mt-1 block">
                  Mãos: {leak.hands.map(h => `#${h}`).join(', ')}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Spot Clusters */}
      <div className="border border-[hsl(var(--arena-cyan)_/_0.2)] bg-black/60 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-[hsl(var(--arena-cyan))]" />
          <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-cyan))]">
            Clusters de Spots
          </h3>
        </div>
        <div className="space-y-2">
          {data.spotClusters.map((cluster, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="p-3 rounded-md border border-[hsl(var(--arena-cyan)_/_0.15)] bg-[hsl(var(--arena-cyan)_/_0.03)]"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold text-[hsl(var(--arena-cyan))]">{cluster.type}</span>
                <span className="font-mono text-[9px] text-[hsl(var(--arena-cyan)_/_0.6)]">{cluster.count} mãos</span>
              </div>
              <p className="text-xs text-foreground/70 leading-relaxed">{cluster.insight}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>

    {/* Training Plan */}
    <div className="border border-[hsl(var(--arena-gold)_/_0.2)] bg-black/60 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-[hsl(var(--arena-gold))]" />
        <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-[hsl(var(--arena-gold))]">
          Plano de Treino Semanal
        </h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data.trainingPlan.map((session, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + i * 0.15 }}
            className="p-3 rounded-md border border-[hsl(var(--arena-gold)_/_0.15)] bg-[hsl(var(--arena-gold)_/_0.03)]"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-[hsl(var(--arena-gold))] font-bold">
              {session.day}
            </span>
            <p className="text-xs text-foreground/80 font-medium mt-1">{session.focus}</p>
            <ul className="mt-2 space-y-1">
              {session.exercises.map((ex, j) => (
                <li key={j} className="text-[11px] text-muted-foreground font-mono">→ {ex}</li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>

    {/* Tags */}
    {data.tags.length > 0 && (
      <div className="flex items-center gap-2 flex-wrap">
        <Tag className="w-3 h-3 text-[hsl(var(--arena-gold)_/_0.5)]" />
        {data.tags.map((tag, i) => (
          <span
            key={i}
            className="px-2 py-0.5 rounded-full border border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))] text-[10px] font-mono bg-[hsl(var(--arena-gold)_/_0.08)]"
          >
            {tag}
          </span>
        ))}
      </div>
    )}
  </motion.div>
);

export default SessionReviewResults;
