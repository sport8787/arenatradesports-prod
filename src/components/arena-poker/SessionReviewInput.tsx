import { useState, useRef } from 'react';
import { Upload, Terminal, Zap, Plus, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface SessionReviewInputProps {
  onAnalyze: (hands: string[]) => void;
  isAnalyzing: boolean;
}

const SessionReviewInput = ({ onAnalyze, isAnalyzing }: SessionReviewInputProps) => {
  const [hands, setHands] = useState<string[]>(['']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addHand = () => {
    if (hands.length < 10) setHands(prev => [...prev, '']);
  };

  const removeHand = (index: number) => {
    if (hands.length > 1) setHands(prev => prev.filter((_, i) => i !== index));
  };

  const updateHand = (index: number, value: string) => {
    setHands(prev => prev.map((h, i) => (i === index ? value : h)));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        // Try to split multiple hands from single file
        const splitHands = content
          .split(/(?=PokerStars Hand #|Poker Hand #|Full Tilt Hand #|\*\*\*\*\* Hand History)/i)
          .map(h => h.trim())
          .filter(h => h.length > 20);

        if (splitHands.length > 1) {
          setHands(prev => {
            const nonEmpty = prev.filter(h => h.trim());
            return [...nonEmpty, ...splitHands].slice(0, 10);
          });
        } else {
          setHands(prev => {
            const firstEmpty = prev.findIndex(h => !h.trim());
            if (firstEmpty >= 0) {
              return prev.map((h, i) => (i === firstEmpty ? content : h));
            }
            return [...prev, content].slice(0, 10);
          });
        }
      };
      reader.readAsText(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validHands = hands.filter(h => h.trim().length > 20);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative border border-[hsl(var(--arena-gold)_/_0.3)] bg-black/80 rounded-lg p-6 backdrop-blur-sm"
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--arena-gold)_/_0.02)_2px,hsl(var(--arena-gold)_/_0.02)_4px)]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-[hsl(var(--arena-gold))]" />
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[hsl(var(--arena-gold))]">
            Session Review • Múltiplas Mãos
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--arena-gold)_/_0.5)] to-transparent" />
        </div>

        <p className="text-xs text-muted-foreground font-mono mb-4">
          Cole até 10 hand histories para análise em lote. Identificaremos leaks recorrentes e um plano de treino.
        </p>

        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          <AnimatePresence>
            {hands.map((hand, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="relative"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-[hsl(var(--arena-gold)_/_0.6)] uppercase tracking-wider">
                    Mão #{index + 1}
                  </span>
                  {hands.length > 1 && (
                    <button
                      onClick={() => removeHand(index)}
                      className="text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <textarea
                  value={hand}
                  onChange={(e) => updateHand(index, e.target.value)}
                  placeholder="Cole o Hand History aqui..."
                  className="w-full h-28 bg-black/60 border border-[hsl(var(--arena-gold)_/_0.15)] rounded-md p-3 font-mono text-xs text-[hsl(var(--arena-gold)_/_0.8)] placeholder:text-[hsl(var(--arena-gold)_/_0.25)] resize-none focus:outline-none focus:border-[hsl(var(--arena-gold)_/_0.5)] transition-colors"
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))] hover:bg-[hsl(var(--arena-gold)_/_0.1)] font-mono text-xs uppercase tracking-wider"
          >
            <Upload className="w-3 h-3 mr-1.5" />
            Upload .txt
          </Button>

          {hands.length < 10 && (
            <Button
              variant="outline"
              size="sm"
              onClick={addHand}
              className="border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))] hover:bg-[hsl(var(--arena-gold)_/_0.1)] font-mono text-xs uppercase tracking-wider"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Adicionar Mão
            </Button>
          )}

          <span className="font-mono text-[10px] text-muted-foreground ml-auto">
            {validHands.length}/{hands.length} válidas
          </span>

          <Button
            onClick={() => onAnalyze(validHands)}
            disabled={validHands.length < 2 || isAnalyzing}
            className="bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-40 font-mono text-xs"
          >
            <Zap className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Analisando...' : `Revisar Sessão (${validHands.length})`}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default SessionReviewInput;
