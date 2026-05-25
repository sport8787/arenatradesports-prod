import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import EventosRarosPanel from '@/components/eventos-raros/EventosRarosPanel';
import { useHorusTrigger } from '@/hooks/useHorusTrigger';

export default function ArenaTraderSportsEventosRarosPage() {
  const navigate = useNavigate();
  useHorusTrigger('eventos_raros_first_visit');
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/arena-trader-sports')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para Arena Trader Sports"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Sparkles className="w-4 h-4 text-primary" />
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
            EVENTOS RAROS — PLACARES INCOMUNS (LAY)
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-6xl space-y-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Oportunidades raras de Lay</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Candidatos pré-live aprovados pelo Mycroft para Lay Goleada, 2x2, 1x3 e 3x1.
            Sinais ao vivo são enviados automaticamente para o Telegram.
          </p>
        </div>
        <EventosRarosPanel arena="trader_sports" />
      </main>
    </div>
  );
}
