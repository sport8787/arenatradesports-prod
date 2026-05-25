import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import SignalsFeed from '@/components/punter/SignalsFeed';
import { useAdmin } from '@/hooks/useAdmin';

export default function PunterAprovadasPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAdmin();
  const [running, setRunning] = useState(false);

  const runSportmonks = async () => {
    setRunning(true);
    const t = toast.loading('Rodando análise Sportmonks…', {
      description: 'Segunda opinião nos jogos pré-live (até ~2 min).',
    });
    try {
      const { data, error } = await supabase.functions.invoke('mycroft-punter-sportmonks', { body: {} });
      if (error) throw error;
      toast.success('Análise Sportmonks concluída', {
        id: t,
        description: `Aprovados: ${data?.approved ?? 0} · Vetados: ${data?.vetoed ?? 0} · Erros: ${data?.errors ?? 0}`,
      });
    } catch (e: any) {
      toast.error('Falha na análise Sportmonks', { id: t, description: e?.message || 'Tente novamente em instantes.' });
    } finally {
      setRunning(false);
    }
  };

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
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight flex-1">
            ENTRADAS APROVADAS GREENS/REDS
          </h1>
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              onClick={runSportmonks}
              disabled={running}
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
              title="Roda uma segunda análise pré-live usando dados Sportmonks (admin)"
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {running ? 'Analisando…' : 'Sportmonks'}
            </Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-5xl space-y-4">
        <PunterBreadcrumb items={[{ label: 'Entradas Aprovadas' }]} />
        <div>
          <h2 className="text-xl font-bold text-foreground">Entradas ativas</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Todas as entradas aprovadas pelo Mycroft com análise completa.
          </p>
          {isAdmin && (
            <p className="font-mono text-[11px] text-primary/80 mt-2">
              <Sparkles className="w-3 h-3 inline mr-1" />
              <strong>Admin:</strong> use o botão <em>Sportmonks</em> para rodar uma segunda opinião pré-live com dados da Sportmonks (cobre melhor sul-americano e 2ª divisão). Os sinais aparecerão marcados com <code className="text-[10px]">analyzed_by: sportmonks</code>.
            </p>
          )}
        </div>
        <SignalsFeed />
      </main>
    </div>
  );
}
