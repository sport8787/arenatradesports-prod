import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import FileImporter from '@/components/arena-poker/FileImporter';
import SessionImportSummary from '@/components/arena-poker/SessionImportSummary';
import HandGrid from '@/components/arena-poker/HandGrid';
import HandAnalysisModal from '@/components/arena-poker/HandAnalysisModal';
import TrainingMode from '@/components/arena-poker/TrainingMode';
import { parseSessionFile, parseHandHistory, type ParsedHand } from '@/lib/handHistoryParser';
import { toast } from 'sonner';

type Phase = 'import' | 'grid' | 'training';

const ArenaPoker = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('import');
  const [hands, setHands] = useState<ParsedHand[]>([]);
  const [selectedHand, setSelectedHand] = useState<ParsedHand | null>(null);
  const [trainingContext, setTrainingContext] = useState<string | undefined>();

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
  };

  const startTraining = (handContext: string) => {
    setSelectedHand(null);
    setTrainingContext(handContext);
    setPhase('training');
  };

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
            <Button
              variant="outline"
              size="sm"
              onClick={resetAll}
              className="font-mono text-xs uppercase tracking-wider border-border text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1.5" />
              Nova Sessão
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {phase === 'import' && <FileImporter onImport={handleImport} />}
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
    </div>
  );
};

export default ArenaPoker;
