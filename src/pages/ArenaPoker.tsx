import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, RotateCcw, Activity, Swords, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import FileImporter from '@/components/arena-poker/FileImporter';
import SessionImportSummary from '@/components/arena-poker/SessionImportSummary';
import HandGrid from '@/components/arena-poker/HandGrid';
import HandAnalysisModal from '@/components/arena-poker/HandAnalysisModal';
import TrainingMode from '@/components/arena-poker/TrainingMode';
import TrendsAlertPanel from '@/components/arena-poker/TrendsAlertPanel';
import StreetContinuationTraining from '@/components/arena-poker/StreetContinuationTraining';
import { parseSessionFile, parseHandHistory, type ParsedHand } from '@/lib/handHistoryParser';
import { toast } from 'sonner';

type Phase = 'import' | 'grid' | 'training' | 'street-training';

const ArenaPoker = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('import');
  const [hands, setHands] = useState<ParsedHand[]>([]);
  const [selectedHand, setSelectedHand] = useState<ParsedHand | null>(null);
  const [trainingContext, setTrainingContext] = useState<string | undefined>();
  const [showTrends, setShowTrends] = useState(false);

  const handleImport = (content: string) => {
    const parsed = parseSessionFile(content);
    if (parsed.length === 0) {
      const single = parseHandHistory(content);
      if (single) {
        setHands([single]);
        setPhase('grid');
        toast.success(`Sessão Importada: 1 mão detectada`);
        return;
      }
      toast.error('Nenhuma mão detectada. Verifique o formato do arquivo.');
      return;
    }
    setHands(parsed);
    setPhase('grid');
    toast.success(`Sessão Importada: ${parsed.length} mãos detectadas`);
  };

  const resetAll = () => {
    setPhase('import');
    setHands([]);
    setSelectedHand(null);
    setTrainingContext(undefined);
    setShowTrends(false);
  };

  const startTraining = (handContext: string) => {
    setSelectedHand(null);
    setTrainingContext(handContext);
    setPhase('training');
  };

  if (phase === 'street-training') {
    return (
      <StreetContinuationTraining
        onBack={() => setPhase('import')}
      />
    );
  }

  if (phase === 'training') {
    return (
      <TrainingMode
        onBack={() => setPhase('grid')}
        handContext={trainingContext}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/lobby')} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Button>
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[hsl(var(--arena-gold))]" />
              <h1 className="font-mono text-sm font-bold uppercase tracking-[0.15em]">
                <span className="text-[hsl(var(--arena-gold))]">Arena</span>{' '}
                <span className="text-[hsl(var(--arena-cyan))]">Poker</span>
              </h1>
            </div>
          </div>
          {phase === 'grid' && (
            <div className="flex items-center gap-2">
              {hands.length >= 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTrends(true)}
                  className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-cyan)_/_0.4)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)]"
                >
                  <Activity className="w-3 h-3 mr-1.5" />
                  Tendências
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={resetAll}
                className="font-mono text-xs uppercase tracking-wider border-border text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="w-3 h-3 mr-1.5" />
                Nova Sessão
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {phase === 'import' && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="border border-[hsl(var(--arena-gold)_/_0.3)] rounded-xl p-6 bg-gradient-to-br from-[hsl(var(--arena-gold)_/_0.05)] to-transparent cursor-pointer hover:border-[hsl(var(--arena-gold)_/_0.6)] transition-all group"
              onClick={() => setPhase('street-training')}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[hsl(var(--arena-gold)_/_0.15)] flex items-center justify-center group-hover:bg-[hsl(var(--arena-gold)_/_0.25)] transition-colors">
                  <Swords className="w-6 h-6 text-[hsl(var(--arena-gold))]" />
                </div>
                <div className="flex-1">
                  <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-[hsl(var(--arena-gold))]">
                    Street Continuation Mode
                  </h3>
                  <p className="font-mono text-xs text-muted-foreground mt-1">
                    Sobreviva 10 decisões críticas sem quebrar. Preflop → Flop → Turn → River.
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-[hsl(var(--arena-gold)_/_0.5)] group-hover:text-[hsl(var(--arena-gold))] transition-colors" />
              </div>
            </motion.div>
            <FileImporter onImport={handleImport} />
          </div>
        )}
        {phase === 'grid' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SessionImportSummary hands={hands} />
            <HandGrid hands={hands} onSelectHand={setSelectedHand} />
          </motion.div>
        )}
      </main>

      {selectedHand && (
        <HandAnalysisModal
          hand={selectedHand}
          onClose={() => setSelectedHand(null)}
          onStartTraining={startTraining}
        />
      )}

      {showTrends && (
        <TrendsAlertPanel
          hands={hands}
          onClose={() => setShowTrends(false)}
        />
      )}
    </div>
  );
};

export default ArenaPoker;
