import { Clock, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getNextPunterAnalysisWindow, formatMinutesUntil } from '@/lib/punterSchedule';

interface Props {
  /** Categoria atual do feed: live | unread | all | green | red */
  category?: string;
}

/**
 * Empty state honesto do Punter.
 * Em vez de "Nenhum entrada nesta categoria" mostra:
 *  - Próxima janela de análise (cron diário 11:30 BRT)
 *  - Contagem regressiva
 *  - Atalhos para Liquidações e Arena Live (engajamento)
 */
export default function PunterEmptyState({ category = 'all' }: Props) {
  const navigate = useNavigate();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const next = getNextPunterAnalysisWindow(now);
  const isResultCategory = category === 'green' || category === 'red';
  const isLive = category === 'live';

  return (
    <div className="py-10 px-4 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
        {isLive ? (
          <Search className="h-5 w-5 text-primary" />
        ) : (
          <Clock className="h-5 w-5 text-primary" />
        )}
      </div>

      <div className="space-y-1">
        <p className="font-mono text-sm font-semibold text-foreground">
          {isResultCategory
            ? `Nenhum ${category === 'green' ? 'GREEN' : 'RED'} ainda nesta janela`
            : isLive
              ? 'Nenhum jogo ao vivo no momento'
              : 'Nenhum entrada aprovado agora'}
        </p>
        <p className="font-mono text-[11px] text-muted-foreground max-w-md mx-auto leading-relaxed">
          O Mycroft não força entradas. Quando os jogos do dia não passam pelos critérios,
          a tela fica limpa — isso é proteção da banca, não falha do sistema.
        </p>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5">
        <Clock className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-[11px] text-foreground">
          Próxima análise: <strong className="text-primary">{next.label}</strong>
          <span className="text-muted-foreground"> ({formatMinutesUntil(next.minutesUntil)})</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/punter/liquidacoes')}
          className="font-mono text-[11px]"
        >
          Ver liquidações recentes
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/arena-trader-sports')}
          className="font-mono text-[11px]"
        >
          Ir para a Arena Live
        </Button>
      </div>
    </div>
  );
}
