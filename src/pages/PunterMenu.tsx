import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut } from 'lucide-react';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import PunterNavGrid from '@/components/punter/PunterNavGrid';
import HorusAudioFallback from '@/components/punter/HorusAudioFallback';
import { useHorusPunterAudio } from '@/hooks/useHorusPunterAudio';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export default function PunterMenuPage() {
  const navigate = useNavigate();
  const { playOnce, pendingAudio, playPending, dismissPending } = useHorusPunterAudio();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: 'Erro ao sair', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Sessão encerrada', description: 'Até a próxima.' });
    navigate('/auth', { replace: true });
  };

  useEffect(() => {
    // Toca apresentação do Hórus na primeira visita ao /menu
    const t = setTimeout(() => playOnce('apresentacao_horus'), 600);
    return () => clearTimeout(t);
  }, [playOnce]);
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/punter')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para Arena Punter"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight flex-1">
            FUNÇÕES DO ORÁCULO MYCROFT
          </h1>
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors text-xs font-mono font-semibold"
            aria-label="Sair da conta"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">SAIR</span>
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 max-w-5xl space-y-5">
        <PunterBreadcrumb items={[{ label: 'Funções' }]} />
        <div>
          <h2 className="text-xl font-bold text-foreground">Acesse rapidamente</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Todas as ferramentas, ajustes e canais oficiais da Arena Punter.
          </p>
        </div>
        <PunterNavGrid />
      </main>

      <HorusAudioFallback
        visible={pendingAudio?.chave === 'apresentacao_horus'}
        label="Ouvir apresentação do Hórus"
        onPlay={playPending}
        onDismiss={dismissPending}
      />
    </div>
  );
}
