import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, RefreshCw, FileText, CheckCircle2, AlertTriangle, X, ArrowRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBetImport } from '@/hooks/useBetImport';
import { toast } from 'sonner';
import type { ParsedBet } from '@/services/betImportParser';

interface BetImportPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const resultColors: Record<string, string> = {
  green: 'text-success',
  red: 'text-destructive',
  void: 'text-muted-foreground',
  pending: 'text-warning',
};

const resultLabels: Record<string, string> = {
  green: '✅ Green',
  red: '❌ Red',
  void: '⚪ Void',
  pending: '⏳ Pendente',
};

export default function BetImportPanel({ isOpen, onClose }: BetImportPanelProps) {
  const { parseFile, confirmImport, syncBetfair, clearPreview, preview, format, parsing, importing, syncing } = useBetImport();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  const handleImport = async () => {
    const result = await confirmImport(preview);
    if (result.success) {
      toast.success(`${result.count} entradas importadas com sucesso!`);
      onClose();
    } else {
      toast.error(result.error || 'Erro ao importar');
    }
  };

  const handleBetfairSync = async () => {
    const result = await syncBetfair();
    if (result.success) {
      toast.success(`Betfair: ${result.synced} entradas sincronizadas (${result.settled} liquidadas, ${result.pending} pendentes)`);
      onClose();
    } else {
      toast.error(result.error || 'Erro ao sincronizar Betfair');
    }
  };

  const stats = {
    total: preview.length,
    green: preview.filter(b => b.result === 'green').length,
    red: preview.filter(b => b.result === 'red').length,
    totalPL: preview.reduce((s, b) => s + b.profit_loss, 0),
    totalStake: preview.reduce((s, b) => s + b.stake, 0),
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-full md:w-[550px] bg-card border-l border-border flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
              <h2 className="font-orbitron text-sm font-bold text-primary uppercase tracking-wider">
                📥 Importar Entradas
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary/50 text-muted-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Betfair Sync */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🟡</span>
                  <h3 className="font-mono text-sm font-bold text-foreground">Betfair Exchange</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sincronize automaticamente suas entradas da Betfair. Configure suas credenciais nas Configurações primeiro.
                </p>
                <button
                  onClick={handleBetfairSync}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary font-mono text-sm font-bold hover:bg-primary/20 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4", syncing && "animate-spin")} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar Betfair'}
                </button>
              </div>

              {/* CSV/PDF/Image Upload */}
              <div className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent" />
                  <h3 className="font-mono text-sm font-bold text-foreground">Import CSV / PDF / Imagem</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Suporta: Bet365, Betano e formato genérico. Aceita <span className="text-primary font-bold">screenshots PNG/JPG</span> de comprovantes de entradas.
                </p>

                {/* Drop zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                    dragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                  )}
                  onClick={() => document.getElementById('bet-file-input')?.click()}
                >
                  <input
                    id="bet-file-input"
                    type="file"
                    accept=".csv,.txt,.pdf,.png,.jpg,.jpeg,.webp,image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {parsing ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 text-primary animate-spin" />
                      <span className="text-sm text-muted-foreground">Processando arquivo...</span>
                      <span className="text-xs text-muted-foreground/60">
                        Imagens podem levar alguns segundos (IA analisando)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Arraste CSV, PDF ou <span className="text-primary font-semibold">Screenshot</span> aqui
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        ou clique para selecionar • PNG, JPG, CSV, PDF
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Preview */}
              {preview.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-success/30 bg-success/5 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-sm font-bold text-success flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      {stats.total} entradas encontradas
                    </h3>
                    <button onClick={clearPreview} className="p-1 text-muted-foreground hover:text-foreground">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Stats summary */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-card rounded p-2">
                      <p className="text-[10px] text-muted-foreground font-mono">TOTAL</p>
                      <p className="text-sm font-bold text-foreground">{stats.total}</p>
                    </div>
                    <div className="bg-card rounded p-2">
                      <p className="text-[10px] text-muted-foreground font-mono">GREEN</p>
                      <p className="text-sm font-bold text-success">{stats.green}</p>
                    </div>
                    <div className="bg-card rounded p-2">
                      <p className="text-[10px] text-muted-foreground font-mono">RED</p>
                      <p className="text-sm font-bold text-destructive">{stats.red}</p>
                    </div>
                    <div className="bg-card rounded p-2">
                      <p className="text-[10px] text-muted-foreground font-mono">P&L</p>
                      <p className={cn("text-sm font-bold", stats.totalPL >= 0 ? 'text-success' : 'text-destructive')}>
                        {stats.totalPL >= 0 ? '+' : ''}R$ {stats.totalPL.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-muted-foreground font-mono">
                    Formato detectado: <span className="text-foreground font-bold uppercase">{format}</span>
                  </p>

                  {/* Bet list preview */}
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {preview.slice(0, 20).map((bet, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded bg-card text-xs">
                        <div className="flex-1 truncate">
                          <span className="text-foreground font-medium">{bet.event_name}</span>
                          {bet.selection && <span className="text-muted-foreground ml-1">• {bet.selection}</span>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="text-muted-foreground">{bet.odd.toFixed(2)}</span>
                          <span className="text-foreground font-mono">R$ {bet.stake.toFixed(2)}</span>
                          <span className={cn("font-bold", resultColors[bet.result])}>
                            {resultLabels[bet.result]}
                          </span>
                        </div>
                      </div>
                    ))}
                    {preview.length > 20 && (
                      <p className="text-center text-xs text-muted-foreground py-1">
                        ... e mais {preview.length - 20} entradas
                      </p>
                    )}
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-success text-success-foreground font-orbitron text-sm font-bold uppercase hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {importing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {importing ? 'Importando...' : `Confirmar Import (${stats.total} entradas)`}
                  </button>
                </motion.div>
              )}

              {/* Instructions */}
              <div className="border border-border rounded-lg p-4 space-y-2">
                <h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Formatos aceitos
                </h3>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p><span className="text-primary font-bold">📸 Screenshot (PNG/JPG):</span> Comprovante de entrada da Betano, Bet365 ou similar — a IA extrai automaticamente!</p>
                  <p><span className="text-foreground font-bold">Bet365:</span> CSV com colunas Date, Event, Selection, Odds, Stake, Returns</p>
                  <p><span className="text-foreground font-bold">Betano:</span> CSV com colunas Data, Evento, Mercado, Seleção, Odd, Stake, Resultado</p>
                  <p><span className="text-foreground font-bold">Genérico:</span> CSV com colunas Evento, Mercado, Odd, Stake, Resultado, Lucro</p>
                  <p><span className="text-foreground font-bold">PDF:</span> Extrato em PDF (tentará extrair odds e stakes automaticamente)</p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
