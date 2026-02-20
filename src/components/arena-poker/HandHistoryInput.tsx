import { useState, useRef } from 'react';
import { Upload, Terminal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface HandHistoryInputProps {
  onAnalyze: (handHistory: string) => void;
  isAnalyzing: boolean;
}

const HandHistoryInput = ({ onAnalyze, isAnalyzing }: HandHistoryInputProps) => {
  const [text, setText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative border border-[hsl(var(--arena-cyan)_/_0.3)] bg-black/80 rounded-lg p-6 backdrop-blur-sm"
    >
      {/* Scanline effect */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,hsl(var(--arena-cyan)_/_0.03)_2px,hsl(var(--arena-cyan)_/_0.03)_4px)]" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="w-5 h-5 text-[hsl(var(--arena-cyan))]" />
          <h2 className="font-mono text-sm uppercase tracking-[0.2em] text-[hsl(var(--arena-cyan))]">
            Módulo de Descriptografia • Hand History
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-[hsl(var(--arena-cyan)_/_0.5)] to-transparent" />
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Cole seu Hand History aqui...\n\nExemplo:\nPokerStars Hand #123456789\nTable 'Nova' 6-max Seat #3 is the button\nSeat 1: Player1 ($100)\n...`}
          className="w-full h-48 bg-black/60 border border-[hsl(var(--arena-cyan)_/_0.2)] rounded-md p-4 font-mono text-sm text-[hsl(var(--arena-cyan)_/_0.8)] placeholder:text-[hsl(var(--arena-cyan)_/_0.3)] resize-none focus:outline-none focus:border-[hsl(var(--arena-cyan)_/_0.6)] transition-colors"
        />

        <div className="flex items-center gap-3 mt-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="border-[hsl(var(--arena-cyan)_/_0.3)] text-[hsl(var(--arena-cyan))] hover:bg-[hsl(var(--arena-cyan)_/_0.1)] font-mono text-xs uppercase tracking-wider"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload .txt
          </Button>

          <Button
            onClick={() => text.trim() && onAnalyze(text.trim())}
            disabled={!text.trim() || isAnalyzing}
            className="ml-auto bg-gradient-to-r from-[hsl(var(--arena-gold))] to-[hsl(38_92%_55%)] text-black font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-40"
          >
            <Zap className="w-4 h-4 mr-2" />
            {isAnalyzing ? 'Processando...' : 'Analisar'}
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default HandHistoryInput;
