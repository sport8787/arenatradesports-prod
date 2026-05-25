import { Volume2, VolumeX } from 'lucide-react';
import { useHorusMode } from '@/hooks/useHorusMode';
import { cn } from '@/lib/utils';

/**
 * Botão flutuante global de mute de sessão do Hórus.
 * Não altera a preferência persistida (modo) — só silencia até refresh.
 */
export default function HorusMuteFloatingButton() {
  const { sessionMuted, setSessionMuted, mode } = useHorusMode();

  // No modo silent já não fala nada; não precisa do botão
  if (mode === 'silent') return null;

  return (
    <button
      type="button"
      onClick={() => setSessionMuted(!sessionMuted)}
      aria-label={sessionMuted ? 'Reativar voz do Hórus nesta sessão' : 'Silenciar Hórus nesta sessão'}
      title={sessionMuted ? 'Hórus silenciado nesta sessão' : 'Silenciar Hórus nesta sessão'}
      className={cn(
        'fixed bottom-3 left-3 z-30 w-9 h-9 rounded-full border backdrop-blur-md',
        'flex items-center justify-center transition-colors shadow-lg',
        sessionMuted
          ? 'border-amber-500/50 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
          : 'border-border/60 bg-card/80 text-muted-foreground hover:text-foreground hover:border-primary/40'
      )}
    >
      {sessionMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
