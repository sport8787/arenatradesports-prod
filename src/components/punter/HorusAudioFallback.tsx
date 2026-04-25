import { Volume2, X } from 'lucide-react';

interface HorusAudioFallbackProps {
  visible: boolean;
  label?: string;
  onPlay: () => void;
  onDismiss: () => void;
}

/**
 * Banner de fallback exibido quando o navegador bloqueia o autoplay
 * do áudio do Hórus. Permite ao usuário iniciar manualmente.
 */
export default function HorusAudioFallback({
  visible,
  label = 'Tocar mensagem do Hórus',
  onPlay,
  onDismiss,
}: HorusAudioFallbackProps) {
  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 sm:left-auto sm:right-4 sm:w-80 animate-in slide-in-from-bottom-4 fade-in">
      <div className="rounded-xl border border-primary/40 bg-card/95 backdrop-blur-xl shadow-lg p-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onPlay}
          className="flex items-center gap-2 flex-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary px-3 py-2 text-sm font-semibold transition-colors"
        >
          <Volume2 className="w-4 h-4" />
          {label}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dispensar"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
