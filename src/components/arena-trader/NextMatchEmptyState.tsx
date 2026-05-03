import { Calendar, Bell, Zap } from 'lucide-react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

interface Props {
  nextMatch?: {
    home: string;
    away: string;
    championship?: string | null;
    datetime: string; // ISO
  } | null;
}

/**
 * Estado vazio educativo para a Arena Live quando não há jogos ao vivo.
 * Mostra o próximo jogo relevante e CTA pra ativar push.
 */
export default function NextMatchEmptyState({ nextMatch }: Props) {
  const { isSubscribed, isSupported, requestPush } = usePushNotifications();

  const handleEnablePush = async () => {
    const ok = await requestPush();
    if (ok) toast.success('Alertas ativados');
    else toast.error('Não foi possível ativar push');
  };

  const minutesUntil = nextMatch
    ? Math.max(0, Math.round((new Date(nextMatch.datetime).getTime() - Date.now()) / 60000))
    : null;

  return (
    <div className="rounded-xl border border-border/60 bg-gradient-to-br from-card/80 via-card/60 to-card/30 backdrop-blur-sm p-8 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <Zap className="w-7 h-7" />
      </span>
      <h3 className="text-lg font-bold text-foreground mb-1">
        Mycroft em modo de espera
      </h3>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
        Sem jogos das ligas-alvo no momento. O Mycroft só atua em ligas selecionadas para preservar a precisão.
      </p>

      {nextMatch ? (
        <div className="inline-flex flex-col items-center gap-1 px-4 py-3 rounded-lg border border-primary/30 bg-primary/5 mb-5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Calendar className="w-3 h-3" />
            Próximo jogo no radar
          </span>
          <span className="text-sm font-semibold text-foreground">
            {nextMatch.home} <span className="text-muted-foreground">vs</span> {nextMatch.away}
          </span>
          {nextMatch.championship && (
            <span className="text-[11px] text-muted-foreground">{nextMatch.championship}</span>
          )}
          <span className="text-xs text-primary font-mono mt-1">
            {minutesUntil !== null && minutesUntil < 60
              ? `Em ${minutesUntil} min`
              : new Date(nextMatch.datetime).toLocaleString('pt-BR', {
                  weekday: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
          </span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-5">
          Confira a aba <strong>Próximos Jogos</strong> para ver a agenda completa.
        </p>
      )}

      {isSupported && !isSubscribed && (
        <div>
          <button
            onClick={handleEnablePush}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 font-mono text-xs font-bold uppercase tracking-wider transition-colors"
          >
            <Bell className="w-4 h-4" />
            Avisar quando começar
          </button>
          <p className="text-[11px] text-muted-foreground mt-2">
            Você recebe push instantâneo quando um sinal forte é aprovado.
          </p>
        </div>
      )}
    </div>
  );
}
