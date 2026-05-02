import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SignalsFeed from '@/components/punter/SignalsFeed';
import EventosRarosPanel from '@/components/eventos-raros/EventosRarosPanel';

export default function PunterFeedEventosPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
            FEED DE SINAIS & EVENTOS RAROS
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-5xl space-y-6">
        <SignalsFeed />
        <div id="eventos-raros" className="scroll-mt-20">
          <EventosRarosPanel arena="punter" compactWhenIdle />
        </div>
      </main>
    </div>
  );
}
