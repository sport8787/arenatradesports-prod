import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Bell, Wallet, Eye, Zap, X } from 'lucide-react';
import { useActivationChecklist, type ActivationKey } from '@/hooks/useActivationChecklist';
import { useState, useEffect } from 'react';
import { track } from '@/lib/analytics';

const STORAGE_DISMISS_KEY = 'activation_checklist_dismissed_until';

interface Step {
  key: ActivationKey;
  icon: React.ReactNode;
  title: string;
  cta: string;
  onClick: (nav: ReturnType<typeof useNavigate>) => void;
}

const STEPS: Step[] = [
  {
    key: 'saw_first_signal',
    icon: <Eye className="w-4 h-4" />,
    title: 'Ver o primeiro entrada aprovado do Mycroft',
    cta: 'Abrir Arena Punter',
    onClick: (nav) => nav('/punter'),
  },
  {
    key: 'enabled_push',
    icon: <Bell className="w-4 h-4" />,
    title: 'Ativar alertas para receber entradas novos',
    cta: 'Ativar push',
    onClick: () => {
      // disparado pelo PushOptInModal/banner; apenas leva ao Punter onde o banner aparece
      window.dispatchEvent(new Event('open_push_optin'));
    },
  },
  {
    key: 'placed_first_virtual_bet',
    icon: <Zap className="w-4 h-4" />,
    title: 'Fazer sua 1ª entrada virtual (ganha BC se acertar)',
    cta: 'Ver entradas',
    onClick: (nav) => nav('/punter'),
  },
  {
    key: 'configured_bankroll',
    icon: <Wallet className="w-4 h-4" />,
    title: 'Configurar sua banca virtual',
    cta: 'Configurar',
    onClick: (nav) => nav('/punter/banca-virtual'),
  },
];

export default function ActivationChecklist() {
  const navigate = useNavigate();
  const { state, completedCount, totalCount, isAllComplete } = useActivationChecklist();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(STORAGE_DISMISS_KEY) || 0);
      if (until > Date.now()) setDismissed(true);
    } catch {}
  }, []);

  if (isAllComplete || dismissed) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(STORAGE_DISMISS_KEY, String(Date.now() + 24 * 3600 * 1000));
    } catch {}
    setDismissed(true);
  };

  const pct = (completedCount / totalCount) * 100;

  return (
    <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-card/60 backdrop-blur-sm p-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Esconder por 24 horas"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center justify-between mb-3 pr-6">
        <div>
          <h3 className="font-mono text-xs uppercase tracking-wider text-primary font-bold">
            Comece em 4 passos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completedCount} de {totalCount} concluídos · destrave o Mycroft no seu fluxo diário
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary">{Math.round(pct)}%</div>
        </div>
      </div>

      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step) => {
          const done = state[step.key];
          return (
            <div
              key={step.key}
              className={`flex items-center gap-3 rounded-lg border p-2.5 transition-all ${
                done
                  ? 'border-emerald-500/30 bg-emerald-500/5 opacity-70'
                  : 'border-border/60 bg-background/40 hover:border-primary/40'
              }`}
            >
              {done ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {step.title}
                </p>
              </div>
              {!done && (
                <button
                  onClick={() => {
                    track.custom('activation_step_clicked', { step: step.key });
                    step.onClick(navigate);
                  }}
                  className="text-[11px] font-mono font-semibold uppercase tracking-wider text-primary hover:text-primary/80 px-2 py-1 rounded border border-primary/30 hover:bg-primary/10 transition-colors flex-shrink-0"
                >
                  {step.cta}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
