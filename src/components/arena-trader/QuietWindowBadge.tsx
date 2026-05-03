import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';

/**
 * Mostra o aviso "Modo silencioso" quando estamos na janela de pausa
 * server-side do cron-live-matches (02h–08h BR / 05h–11h UTC).
 * Atualiza a cada minuto.
 */
export default function QuietWindowBadge() {
  const [active, setActive] = useState(() => isQuietHour());

  useEffect(() => {
    const id = setInterval(() => setActive(isQuietHour()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!active) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono uppercase tracking-wider">
      <Moon className="w-3 h-3" />
      Modo silencioso · 02h–08h BR
    </div>
  );
}

function isQuietHour(): boolean {
  const utcH = new Date().getUTCHours();
  return utcH >= 5 && utcH < 11;
}
