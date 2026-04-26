import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import SignalsFeed from '@/components/punter/SignalsFeed';

export default function PunterAprovadasPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter/menu')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para Arena Punter"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight">
            SINAIS APROVADOS GREENS/REDS
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-5xl space-y-4">
        <PunterBreadcrumb items={[{ label: 'Sinais Aprovados' }]} />
        <div>
          <h2 className="text-xl font-bold text-foreground">Sinais ativos</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Todos os sinais aprovados pelo Mycroft com análise completa.
          </p>
        </div>
        <SignalsFeed />
      </main>
    </div>
  );
}
