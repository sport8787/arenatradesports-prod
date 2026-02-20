import { motion } from 'framer-motion';
import { Eye, AlertTriangle, BarChart3, Search } from 'lucide-react';

interface Leak {
  id: string;
  title: string;
  severity: 'grave' | 'atencao' | 'info';
  description: string;
  category: string;
}

interface MycroftAnalysisPanelProps {
  leaks: Leak[];
  technicalNotes: string[];
  isLoading: boolean;
}

const severityConfig = {
  grave: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'GRAVE', icon: '🔴' },
  atencao: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'ATENÇÃO', icon: '🟡' },
  info: { color: 'bg-[hsl(var(--arena-cyan)_/_0.15)] text-[hsl(var(--arena-cyan))] border-[hsl(var(--arena-cyan)_/_0.3)]', label: 'INFO', icon: '🔵' },
};

const MycroftAnalysisPanel = ({ leaks, technicalNotes, isLoading }: MycroftAnalysisPanelProps) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    className="flex flex-col h-full border border-[hsl(var(--arena-cyan)_/_0.25)] bg-black/70 rounded-lg overflow-hidden"
  >
    {/* Header */}
    <div className="p-4 border-b border-[hsl(var(--arena-cyan)_/_0.2)] bg-[hsl(var(--arena-cyan)_/_0.05)]">
      <div className="flex items-center gap-2">
        <Eye className="w-5 h-5 text-[hsl(var(--arena-cyan))]" />
        <h3 className="font-mono text-sm uppercase tracking-[0.2em] text-[hsl(var(--arena-cyan))]">
          Mycroft • Análise Técnica
        </h3>
      </div>
      <p className="text-[10px] font-mono text-[hsl(var(--arena-cyan)_/_0.5)] mt-1 tracking-wider">
        LEAK DETECTION SYSTEM v2.0
      </p>
    </div>

    {/* Content */}
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Search className="w-8 h-8 text-[hsl(var(--arena-cyan)_/_0.4)] animate-pulse" />
          <span className="font-mono text-xs text-[hsl(var(--arena-cyan)_/_0.4)] tracking-wider">
            Scanning hand data...
          </span>
        </div>
      ) : leaks.length === 0 ? (
        <div className="text-center py-8">
          <BarChart3 className="w-8 h-8 text-[hsl(var(--arena-cyan)_/_0.3)] mx-auto mb-2" />
          <p className="font-mono text-xs text-muted-foreground">Nenhuma análise ainda</p>
        </div>
      ) : (
        <>
          {/* Leak cards */}
          {leaks.map((leak, i) => {
            const cfg = severityConfig[leak.severity];
            return (
              <motion.div
                key={leak.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-3 rounded-md border ${cfg.color}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-bold">{cfg.icon} {leak.title}</span>
                  <span className="font-mono text-[9px] px-2 py-0.5 rounded-full border border-current opacity-70">
                    {cfg.label}
                  </span>
                </div>
                <p className="text-xs opacity-80 leading-relaxed">{leak.description}</p>
                <span className="font-mono text-[9px] opacity-50 mt-1 block">{leak.category}</span>
              </motion.div>
            );
          })}

          {/* Technical notes */}
          {technicalNotes.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[hsl(var(--arena-cyan)_/_0.15)]">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--arena-cyan)_/_0.5)] mb-2 block">
                Notas Técnicas
              </span>
              {technicalNotes.map((note, i) => (
                <p key={i} className="text-xs text-muted-foreground font-mono leading-relaxed mb-1">
                  → {note}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>

    {/* Waveform decoration */}
    <div className="h-8 border-t border-[hsl(var(--arena-cyan)_/_0.15)] bg-black/50 flex items-center px-4 gap-0.5 overflow-hidden">
      {[...Array(40)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-[hsl(var(--arena-cyan)_/_0.3)] rounded-full"
          animate={{ height: [2, Math.random() * 16 + 4, 2] }}
          transition={{ duration: 1.5, delay: i * 0.05, repeat: Infinity, repeatType: 'reverse' }}
        />
      ))}
    </div>
  </motion.div>
);

export default MycroftAnalysisPanel;
