import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Eye } from 'lucide-react';
import PunterBreadcrumb from '@/components/punter/PunterBreadcrumb';
import PunterNavGrid from '@/components/punter/PunterNavGrid';
import PunterMenuHeroStatus from '@/components/punter/PunterMenuHeroStatus';
import ActivationChecklist from '@/components/punter/ActivationChecklist';
import BCRewardsBanner from '@/components/punter/BCRewardsBanner';
import NextPrizeProgress from '@/components/punter/NextPrizeProgress';
import LigaMycroftMiniRank from '@/components/punter/LigaMycroftMiniRank';
import HorusAudioFallback from '@/components/punter/HorusAudioFallback';
import { HeroParticles } from '@/components/landing/HeroParticles';
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
    // Toca apresentação do Hórus na primeira visita ao menu principal
    const t = setTimeout(() => playOnce('apresentacao_horus'), 600);
    return () => clearTimeout(t);
  }, [playOnce]);
  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Olho do Mycroft no fundo + partículas flutuantes */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <HeroParticles />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative w-[min(80vw,640px)] h-[min(80vw,640px)] opacity-[0.07]">
            {/* Glow externo */}
            <div
              className="absolute inset-0 rounded-full blur-3xl"
              style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.6), transparent 65%)' }}
            />
            {/* Eye SVG */}
            <svg viewBox="0 0 200 200" className="relative w-full h-full text-primary" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 100 Q100 20 190 100 Q100 180 10 100 Z" />
              <circle cx="100" cy="100" r="42" />
              <circle cx="100" cy="100" r="22" fill="currentColor" fillOpacity="0.4" />
              <circle cx="100" cy="100" r="8" fill="currentColor" />
              {/* Raios */}
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * Math.PI * 2) / 24;
                const x1 = 100 + Math.cos(angle) * 50;
                const y1 = 100 + Math.sin(angle) * 50;
                const x2 = 100 + Math.cos(angle) * 64;
                const y2 = 100 + Math.sin(angle) * 64;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" />;
              })}
            </svg>
          </div>
        </div>
        {/* Vinheta */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />
      </div>

      <header className="relative z-10 sticky top-0 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-2.5 flex items-center gap-3">
          <button
            onClick={() => navigate('/lobby')}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para o lobby"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-mono text-sm font-semibold text-foreground tracking-tight flex-1 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-primary">
              <Eye className="h-3.5 w-3.5" />
            </span>
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

      <main className="relative z-10 container mx-auto px-4 py-5 max-w-5xl space-y-5">
        <PunterBreadcrumb items={[{ label: 'Funções' }]} />
        <div>
          <h2 className="text-xl font-bold text-foreground">Acesse rapidamente</h2>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            Todas as ferramentas, ajustes e canais oficiais do Oráculo Mycroft.
          </p>
        </div>
        <PunterMenuHeroStatus />
        <ActivationChecklist />
        <BCRewardsBanner />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <NextPrizeProgress />
          <LigaMycroftMiniRank />
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
