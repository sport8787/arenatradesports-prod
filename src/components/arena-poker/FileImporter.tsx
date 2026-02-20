import { useRef } from 'react';
import { Upload, FileText, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface FileImporterProps {
  onImport: (content: string) => void;
}

const FileImporter = ({ onImport }: FileImporterProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) onImport(content);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePaste = () => {
    const text = textareaRef.current?.value?.trim();
    if (text && text.length > 20) onImport(text);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl mx-auto space-y-6"
    >
      <div className="text-center space-y-3">
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="inline-flex items-center gap-3 px-5 py-2 rounded-full border border-[hsl(var(--arena-gold)_/_0.2)] bg-[hsl(var(--arena-gold)_/_0.05)]">
          <Terminal className="w-6 h-6 text-[hsl(var(--arena-gold))]" />
          <span className="font-mono text-lg font-bold tracking-wider">
            <span className="text-[hsl(var(--arena-gold))]">ARENA</span>{' '}
            <span className="text-[hsl(var(--arena-cyan))]">POKER</span>
          </span>
        </motion.div>
        <p className="font-mono text-xs text-muted-foreground tracking-wider max-w-md mx-auto">
          Importe seu arquivo .txt de Hand History. O sistema detecta automaticamente cada mão da sessão.
        </p>
      </div>

      {/* Upload Zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-[hsl(var(--arena-gold)_/_0.2)] rounded-xl p-10 text-center cursor-pointer hover:border-[hsl(var(--arena-gold)_/_0.5)] hover:bg-[hsl(var(--arena-gold)_/_0.02)] transition-all group"
      >
        <Upload className="w-10 h-10 mx-auto mb-3 text-[hsl(var(--arena-gold)_/_0.4)] group-hover:text-[hsl(var(--arena-gold))] transition-colors" />
        <p className="font-mono text-sm text-muted-foreground">
          Clique para carregar <span className="text-[hsl(var(--arena-gold))]">.txt</span> ou arraste aqui
        </p>
        <p className="font-mono text-[10px] text-muted-foreground/50 mt-1">
          PokerStars, Full Tilt, ou formatos padrão
        </p>
        <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileUpload} className="hidden" />
      </div>

      {/* Or paste */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-border" />
          <span className="font-mono text-[10px] text-muted-foreground uppercase">ou cole o conteúdo</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <textarea
          ref={textareaRef}
          placeholder="Cole um ou mais Hand Histories aqui..."
          className="w-full h-32 bg-black/60 border border-border rounded-lg p-4 font-mono text-xs text-muted-foreground placeholder:text-muted-foreground/30 resize-none focus:outline-none focus:border-[hsl(var(--arena-gold)_/_0.4)] transition-colors"
        />
        <div className="text-right">
          <Button
            onClick={handlePaste}
            variant="outline"
            size="sm"
            className="font-mono text-xs uppercase tracking-wider border-[hsl(var(--arena-gold)_/_0.3)] text-[hsl(var(--arena-gold))] hover:bg-[hsl(var(--arena-gold)_/_0.1)]"
          >
            <FileText className="w-3 h-3 mr-1.5" />
            Importar
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default FileImporter;
