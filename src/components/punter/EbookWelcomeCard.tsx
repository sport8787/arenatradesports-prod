import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Download, X } from 'lucide-react';

const EBOOK_URL = 'https://affquongjlhmusxzohjl.supabase.co/storage/v1/object/public/public-assets/ebooks/entradas-de-valor.pdf';
const STORAGE_KEY = 'ebook_welcome_dismissed';

export default function EbookWelcomeCard() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="relative border border-warning/40 bg-gradient-to-r from-warning/10 via-warning/5 to-transparent rounded-lg p-3 sm:p-4 mb-3"
        >
          <button
            onClick={dismiss}
            aria-label="Dispensar"
            className="absolute top-2 right-2 p-1 rounded hover:bg-warning/10 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pr-6">
            <div className="shrink-0 w-10 h-10 rounded-md bg-warning/20 border border-warning/40 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-widest text-warning/80">
                🎁 Bônus de boas-vindas
              </p>
              <p className="text-sm sm:text-base font-bold text-foreground leading-tight">
                E-book "Entradas de Valor: Como Encontrar Edge Matemático"
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Leitura rápida — fundamentos do que torna uma entrada lucrativa no longo prazo.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href={EBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-warning text-warning-foreground font-bold text-xs uppercase tracking-wider rounded hover:opacity-90 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" /> Baixar
              </a>
              <button
                onClick={dismiss}
                className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Não mostrar mais
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
