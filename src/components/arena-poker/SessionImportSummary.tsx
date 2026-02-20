import { motion } from 'framer-motion';
import { CheckCircle, AlertTriangle, Target } from 'lucide-react';
import type { ParsedHand } from '@/lib/handHistoryParser';

interface SessionImportSummaryProps {
  hands: ParsedHand[];
}

const SessionImportSummary = ({ hands }: SessionImportSummaryProps) => {
  const wins = hands.filter(h => h.heroWon).length;
  const critical = hands.filter(h => h.isCritical).length;
  const allIns = hands.filter(h => h.isAllIn).length;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="border border-[hsl(var(--arena-gold)_/_0.4)] bg-card rounded-lg p-6 text-center space-y-4"
    >
      <div className="inline-flex items-center gap-2 text-[hsl(var(--arena-gold))]">
        <CheckCircle className="w-6 h-6" />
        <span className="font-mono text-[20px] font-bold uppercase tracking-wider">
          Sessão Importada
        </span>
      </div>
      <p className="font-mono text-3xl font-bold text-foreground">
        {hands.length} <span className="text-lg text-muted-foreground">mãos detectadas</span>
      </p>
      <div className="flex items-center justify-center gap-6 text-sm font-mono">
        <div className="flex items-center gap-1.5 text-[hsl(var(--success))]">
          <CheckCircle className="w-4 h-4" />
          <span>{wins} vitórias</span>
        </div>
        <div className="flex items-center gap-1.5 text-[hsl(var(--arena-gold))]">
          <Target className="w-4 h-4" />
          <span>{critical} mãos críticas</span>
        </div>
        <div className="flex items-center gap-1.5 text-[hsl(var(--destructive))]">
          <AlertTriangle className="w-4 h-4" />
          <span>{allIns} all-ins</span>
        </div>
      </div>
    </motion.div>
  );
};

export default SessionImportSummary;
