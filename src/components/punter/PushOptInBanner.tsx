import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useActivationChecklist } from '@/hooks/useActivationChecklist';
import { track } from '@/lib/analytics';
import { toast } from 'sonner';

const DISMISS_KEY = 'push_optin_dismissed_until';
const DISMISS_HOURS = 24;

/**
 * Banner persistente no topo do Punter / Arena Live convidando o usuário
 * a ativar push. Desaparece quando ele aceita ou clica em "Agora não".
 *
 * Também ouve o evento global `open_push_optin` (disparado pelo checklist).
 */
export default function PushOptInBanner() {
  const { enabled, isSupported, requestPush } = usePushNotifications();
  const { markComplete } = useActivationChecklist();
  const [hidden, setHidden] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupported) return;
    if (enabled) {
      // Garante que o checklist acompanhe quando o usuário já tem push
      markComplete('enabled_push');
      setHidden(true);
      return;
    }
    try {
      const until = Number(localStorage.getItem(DISMISS_KEY) || 0);
      setHidden(until > Date.now());
    } catch {
      setHidden(false);
    }
    // Listener para forçar abrir vindo do checklist
    const force = () => setHidden(false);
    window.addEventListener('open_push_optin', force);
    return () => window.removeEventListener('open_push_optin', force);
  }, [enabled, isSupported, markComplete]);

  if (!isSupported || enabled || hidden) return null;

  const handleEnable = async () => {
    setBusy(true);
    track.custom('push_optin_clicked', { source: 'banner' });
    try {
      const ok = await requestPush();
      if (ok) {
        toast.success('Alertas ativados — você receberá os entradas aprovados');
        track.custom('push_optin_accepted', { source: 'banner' });
        await markComplete('enabled_push');
        setHidden(true);
      } else {
        toast.error('Não foi possível ativar — verifique as permissões do navegador');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_HOURS * 3600 * 1000));
    } catch {}
    track.custom('push_optin_dismissed', { source: 'banner' });
    setHidden(true);
  };

  return (
    <div className="rounded-lg border border-primary/40 bg-gradient-to-r from-primary/15 to-primary/5 backdrop-blur-sm px-4 py-2.5 flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary flex-shrink-0">
        <Bell className="w-4 h-4" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight">
          Ative os alertas do Mycroft
        </p>
        <p className="text-xs text-muted-foreground leading-tight mt-0.5">
          Receba aviso instantâneo quando um entrada forte for aprovado.
        </p>
      </div>
      <button
        onClick={handleEnable}
        disabled={busy}
        className="text-xs font-mono font-bold uppercase tracking-wider text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-60 px-3 py-1.5 rounded-md transition-colors flex-shrink-0"
      >
        {busy ? 'Ativando…' : 'Ativar'}
      </button>
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
        aria-label="Agora não"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
